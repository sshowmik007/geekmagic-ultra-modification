param(
    [Parameter(Mandatory = $false)]
    [string]$DeviceIp,
    [switch]$EnableLocalFileScans
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $Root '.env'

# If DeviceIp was not passed via CLI, reuse existing from .env if present
if (-not $DeviceIp -and (Test-Path -LiteralPath $EnvPath)) {
    $ExistingEnv = Get-Content -LiteralPath $EnvPath -Raw
    $IpMatch = [regex]::Match($ExistingEnv, '(?m)^SMALLTV_IP=(.+)$')
    if ($IpMatch.Success -and $IpMatch.Groups[1].Value.Trim()) {
        $DeviceIp = $IpMatch.Groups[1].Value.Trim()
    }
}

# If still not provided, prompt the user interactively
if (-not $DeviceIp) {
    $DeviceIp = Read-Host "Enter your SmallTV-Ultra IP address (e.g. 192.168.0.82)"
}

if (-not $DeviceIp) {
    Write-Error "SmallTV IP address is required."
    exit 1
}

# A per-install token prevents another local process from posting provider events silently.
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$Token = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })

if (Test-Path -LiteralPath $EnvPath) {
    $Existing = Get-Content -LiteralPath $EnvPath -Raw
    $TokenMatch = [regex]::Match($Existing, '(?m)^SMALLTV_BRIDGE_TOKEN=(.+)$')
    if ($TokenMatch.Success -and $TokenMatch.Groups[1].Value.Trim()) { $Token = $TokenMatch.Groups[1].Value.Trim() }
}

@"
SMALLTV_IP=$DeviceIp
SMALLTV_DEVICE_URL=http://$DeviceIp
SMALLTV_PROVIDER_MODE=auto
SMALLTV_PUSH_INTERVAL_SEC=10
SMALLTV_FRESHNESS_TIMEOUT_SEC=90
SMALLTV_BRIDGE_TOKEN=$Token
"@ | Set-Content -LiteralPath $EnvPath -Encoding ascii

$ComposeFiles = @('-f', (Join-Path $Root 'docker-compose.yml'))
if ($EnableLocalFileScans) {
    # The secure default uses hooks/events; file scanning is retained only for compatibility.
    $ComposeFiles += @('-f', (Join-Path $Root 'docker-compose.local-files.yml'))
    Write-Warning 'Local provider directories are mounted read-only into Docker. Use only on a trusted machine.'
}

Push-Location $Root
try {
    docker compose @ComposeFiles up -d --build
    Write-Host "Collector started for $DeviceIp. Bridge token stored in $EnvPath."
} finally {
    Pop-Location
}
