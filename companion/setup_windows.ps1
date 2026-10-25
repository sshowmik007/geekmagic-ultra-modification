param(
    [Parameter(Mandatory = $true)]
    [string]$DeviceIp,
    [switch]$EnableLocalFileScans
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $Root '.env'
# A per-install token prevents another local process from posting provider events silently.
$Token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()

if (Test-Path -LiteralPath $EnvPath) {
    $Existing = Get-Content -LiteralPath $EnvPath -Raw
    $TokenMatch = [regex]::Match($Existing, '(?m)^SMALLTV_BRIDGE_TOKEN=(.+)$')
    if ($TokenMatch.Success -and $TokenMatch.Groups[1].Value.Trim()) { $Token = $TokenMatch.Groups[1].Value.Trim() }
}

@"
SMALLTV_IP=$DeviceIp
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
