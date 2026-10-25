# SmallTV-Ultra Firmware & Dashboard Build Guide

This document outlines all required software, system prerequisites, and step-by-step instructions for building the custom web dashboard and compiling the ESP8266 firmware binary for the **GeekMagic SmallTV-Ultra**.

---

## 1. System Requirements & Softwares

You only need **two core runtimes** on your machine: **Node.js** and **Python**.

| Tool / Software | Required Version | Purpose | Download / Install |
| :--- | :--- | :--- | :--- |
| **Node.js & npm** | Node.js v18+ / v20+ LTS | Compiles Tailwind CSS, inlines/bundles web assets, runs unit tests | [nodejs.org](https://nodejs.org/) |
| **Python** | Python 3.9 – 3.14 | Runs the build toolchain & the laptop companion sync daemon | [python.org](https://www.python.org/) |
| **PlatformIO Core (CLI)** | Latest | Manages ESP8266 toolchains, downloads libraries, builds `firmware.bin` | Installed via `pip` (see below) |

> [!NOTE]
> You do **not** need the full Arduino IDE. PlatformIO Core automatically provisions the Xtensa GCC toolchain (`toolchain-xtensa`), Espressif 8266 framework (`framework-arduinoespressif8266`), and all required libraries (`TFT_eSPI`, `ArduinoJson`) into its isolated environment on first compilation.

---

## 2. One-Time Environment Setup

Open PowerShell or Command Prompt and run the following setup commands:

### A. Verify Runtimes
```powershell
node -v
npm -v
py --version
```
*(On Windows, standard Python installations are invoked using the `py` launcher).*

### B. Install Node.js Project Dependencies
From the repository root (`smalltv-ultra-main`):
```powershell
npm install --prefix smalltv-dashboard
```
This installs:
- `@tailwindcss/cli` & `tailwindcss` (v4)
- Dev dependencies and test harness packages

### C. Install PlatformIO Core CLI
```powershell
py -m pip install --upgrade platformio
```
Verify the installation:
```powershell
py -m platformio --version
```

---

## 3. Build Pipeline & Commands

Building the complete release consists of two main steps: **Web Assets Bundling** and **ESP8266 C++ Compilation**.

```
┌──────────────────┐     npm run build      ┌────────────────────┐
│ src/input.css    │ ────────────────────►  │ dist/styles.css    │
└──────────────────┘                        └────────────────────┘
                                                       │
┌──────────────────┐    npm run build:esp              ▼
│ index.html + JS  │ ────────────────────►  firmware/include/    │
└──────────────────┘                        web_assets.h (Gzip)  │
                                                       │
                                                       ▼
┌──────────────────┐     platformio run     ┌────────────────────┐
│ firmware/src/    │ ────────────────────►  │ firmware.bin       │
│ main.cpp         │                        │ (~448 KB ROM)      │
└──────────────────┘                        └────────────────────┘
```

### Step 1: Compile CSS & Bundle Web Assets
```powershell
# 1. Compile Tailwind CSS (minified)
npx @tailwindcss/cli -i smalltv-dashboard/src/input.css -o smalltv-dashboard/dist/styles.css --minify

# 2. Bundle HTML, CSS, and JS into gzipped PROGMEM C-header
npm run build:esp --prefix smalltv-dashboard
```
* **Output:** Generates `smalltv-dashboard/dist/web_assets.h` and synchronizes `smalltv-dashboard/firmware/include/web_assets.h`.
* **Flash Footprint:** Inlined and compressed down to ~27 KB (only ~2.6% of the 1 MB SPIFFS/LittleFS budget).

### Step 2: Compile Firmware with PlatformIO
```powershell
py -m platformio run -d smalltv-dashboard/firmware
```
* **Output Binary:** `smalltv-dashboard/firmware/.pio/build/smalltv-ultra/firmware.bin`

### Step 3: Copy & Validate Binary Safety
```powershell
Copy-Item smalltv-dashboard/firmware/.pio/build/smalltv-ultra/firmware.bin smalltv-dashboard/releases/custom_dashboard_firmware.bin -Force
node smalltv-dashboard/scripts/validate-binary.js smalltv-dashboard/releases/custom_dashboard_firmware.bin
```

---

## 4. Running the AI Companion Daemon (`companion.py`)

The companion streams real-time AI quota, context window, and model telemetry from your laptop (Antigravity/Gemini, OpenAI/Codex, OpenCode) directly to the SmallTV:

* **Zero external dependencies**: Built purely with Python standard libraries (`urllib.request`, `json`, `time`, `os`, `argparse`). No extra `pip install` commands required.
* **To run via PowerShell**:
  ```powershell
  py smalltv-dashboard/companion/companion.py
  ```
* **To run via Double-Click**:
  Double-click `run-companion.bat` in the repository root.

### Optional Mode Flags:
* **Auto (Default)**: Selects the freshest verified provider event; it does not fabricate or rotate providers.
* **Lock to Gemini**: `py smalltv-dashboard/companion/companion.py --mode gemini`
* **Lock to Codex**: `py smalltv-dashboard/companion/companion.py --mode codex`
* **Lock to OpenCode**: `py smalltv-dashboard/companion/companion.py --mode opencode`

---

## 5. Troubleshooting & FAQ

### 1. `python : The term 'python' is not recognized...` or `Python was not found...`
On Windows 10 & 11, the command `python` defaults to a Microsoft Store placeholder.
* **Option A (Instant Fix)**: Use **`py`** instead (the standard Windows Python Launcher):
  ```powershell
  py smalltv-dashboard/companion/companion.py
  ```
* **Option B (Docker - Zero Python Install Needed)**:
  Since Docker is installed and running, simply run:
  ```powershell
  cd smalltv-dashboard
  docker compose -f docker-compose.yml -f docker-compose.local-files.yml up -d
  ```
* **Option C (Permanent `python` command fix)**:
  Open Windows Settings -> **Apps** -> **Advanced app settings** -> **App execution aliases**, and toggle OFF `python.exe` and `python3.exe`. Then ensure your Python directory is in your user `PATH`.

### 2. Changes in Web UI not appearing on the SmallTV after flashing
Ensure you ran `npm run build:esp --prefix smalltv-dashboard` before compiling with PlatformIO. The firmware embeds the web bundle directly into flash memory via `firmware/include/web_assets.h`.

### 3. Firmware Flashing via Web Browser
1. Connect to the same Wi-Fi network as your SmallTV.
2. Open `http://<SMALLTV_IP>/update` (e.g. `http://192.168.0.198/update`).
3. Select `custom_dashboard_firmware.bin` and click **Update Firmware**.
4. The device reboots automatically in ~15 seconds into the new version.

## Local CLI/plugin telemetry bridge

Run one companion process. It exposes a loopback-only plugin endpoint:

```powershell
py companion/companion.py --ip 192.168.0.198 --mode auto
```

Opening `http://127.0.0.1:4310/provider-event` in a browser now returns bridge health and the last accepted plugin sources. Plugins or provider hooks can post a verified event to
`http://127.0.0.1:4310/provider-event`:

```powershell
$token = (Get-Content .env | Select-String '^SMALLTV_BRIDGE_TOKEN=').ToString().Split('=',2)[1]
Invoke-RestMethod http://127.0.0.1:4310/provider-event -Method Post -ContentType 'application/json' -Body (@{
  provider = 'Codex'; model = 'GPT-5.6'; state = 'WORKING';
  observedAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); source = 'codex-plugin'
} | ConvertTo-Json) -Headers @{ 'X-SmallTV-Bridge-Token' = $token }
```

The bridge is only a receiver; it does not discover or activate plugins. A plugin must explicitly POST a fresh event and include the bridge token. It accepts provider/model/status and optional real quota fields, never invents missing values, and marks events stale after the freshness timeout. Run only one collector for a target device.

## Reusable collector with Docker Desktop

Docker packages the same companion process for repeatable installation. Provider hooks/plugins still run on the host and post events to the collector; Docker does not scrape private desktop conversations by itself.

From `smalltv-dashboard` (recommended secure setup):

```powershell
.\companion\setup_windows.ps1 -DeviceIp 192.168.0.198
```

Verify the collector and bridge:

```powershell
Invoke-RestMethod http://127.0.0.1:4310/provider-event
docker compose logs -f smalltv-collector
```

The secure default mounts no provider directories and publishes only `127.0.0.1:4310`. The setup script generates a random bridge token and keeps it in the local `.env` file. Stop it with `docker compose down`.

For your existing Antigravity/Codex file-scan workflow only, explicitly opt in:

```powershell
.\companion\setup_windows.ps1 -DeviceIp 192.168.0.198 -EnableLocalFileScans
```

This mounts `.codex`, `.gemini`, and `.claude` read-only. Those folders can contain sensitive transcripts or credentials, so this option is intentionally not the default.

The device firmware does not need to be reflashed when only collector/provider integrations change. Reflash/OTA is required only when the firmware API or embedded dashboard changes. Keep one collector instance per device.
