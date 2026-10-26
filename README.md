# GeekMagic SmallTV-Ultra Custom Firmware & Web Dashboard

A complete, production-grade custom firmware and responsive web control dashboard engineered specifically for the **GeekMagic SmallTV-Ultra** (ESP8266EX 80 MHz MCU, 4 MB Flash, 1.54" 240×240 ST7789 IPS LCD).

Featuring **True Inky Black IPS display rendering**, **7 selectable high-contrast themes**, **Islamic Prayer Times (AlAdhan API integration)**, **12h/24h clock and date format organizer**, **captive portal Wi-Fi manager**, and **direct in-browser OTA updates**.

> 🛠️ **Build & Environment Setup Guide:** See [docs/BUILD_GUIDE.md](docs/BUILD_GUIDE.md) for required software, dependencies, and step-by-step compilation instructions.

---

## 🌟 Comprehensive Feature List

### 1. Pure Inky Black IPS Panel Calibration
- **Zero Backlight Bleed**: Uses hardware `TFT_BLACK` (`0x0000`) combined with ST7789 inversion mode (`tft.invertDisplay(true)`), forcing liquid crystals to block 100% of light for deep, OLED-like blacks.
- **Flicker-Free Rendering**: Eliminated periodic full-screen wipe flickers; the display refreshes only on minute transitions.
- **Active-Low PWM Brightness**: Hardware-accurate backlight regulation (0–100%) mapped to GPIO 5 (`0` = 100% full bright, `1023` = 0% off).

### 2. Seven Selectable Display Themes
1. **Weather & Prayer Station (Theme 1)**:
   - Dynamic real-time clock (12-Hour with AM/PM pill indicator or 24-Hour) with kinetic blinking colons.
   - Configurable regional date string (e.g. `24 Oct . Fri`).
   - Location weather header (Dhaka / Custom location).
   - Real-time network status tag (`ONLINE` in green or `192.168.4.1` in orange when in AP setup mode).
   - Stylized golden sun and soft cloud illustration.
   - **5-Waqt Salah Grid Strip**: Displays Fajr, Dhuhr, Asr, Maghrib, and Isha in clean 12-Hour format with a highlighted pill badge dynamically tracking the upcoming prayer (Dhuhr, Asr, Maghrib, Isha, Fajr).
   - Streamlined 3-column telemetry: **Temperature (°C)**, **Humidity (%)**, and **Sunset** time in 12-Hour format (e.g., `05:27`).
2. **Editorial Weather Clock (Theme 2)**:
   - Minimalist Swiss typography with high type-contrast hierarchy.
   - Massive centered digital clock digits with separator bar and pulsing colons.
   - Single weather hero card showing sky condition, temperature, and humidity.
3. **Minimalist Clean Clock (Theme 3)**:
   - Ultra-clean aesthetic focusing strictly on time and date.
   - Large centered digital clock, AM/PM tag (in 12h mode), clean full date string, and subtle connectivity dot.
4. **AI Token & Rate Limit Monitor (Theme 4)**:
   - Live telemetry monitor for coding agents: **Google Gemini**, **OpenAI / Codex**, **Anthropic Claude**, and **OpenCode**.
   - Top Header: Monospace digital clock + colored AI Provider pill badge.
   - **Official Provider Logos**: Precision vector rendering for **Google Gemini** (4-pointed star sparkle), **OpenAI / Codex** (swirl flower knot), **Anthropic Claude** (8-pointed spark), and **OpenCode** (terminal bracket) on both the web simulator and the physical ST7789 LCD.
   - **Dual Progress Meters**:
     - **Session Context Window**: Live token count, limit, and reset countdown.
     - **Daily / Weekly Quota**: Total usage and reset countdown.
   - **Laptop Companion Dock**: Live agent status (`IDLE`, `WORKING`, `WAITING`).
5. **Cosmic Shuttle & Prayer Station (Theme 5)**:
   - **Kinetic Space Shuttle Animation**: Miniature vector orbiter with fiery plasma exhaust trail (`@keyframes thrusterPulse`) and hovering physics (`@keyframes shuttleFloat`) replacing static mosque imagery.
   - **Full Salah Schedule Table**: Displays `START` and `END` times for all 5 daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) in 12-Hour format.
   - **Dynamic Real-Time Waqt Focusing**: Automatically tracks the current wall-clock time and focuses the active upcoming prayer row (e.g., glows on Dhuhr during morning, switches to Asr, then Maghrib, Isha, Fajr) with a luminous golden border and background gradient.
   - **Live Countdown Hero Card**: Displays `NEXT: [WAQT] / STARTS IN` with a real-time `HH:MM:SS` countdown timer.
6. **Photo Frame & Ambient Album (Theme 6)**:
   - Displays a 240×240 LittleFS image with an unobtrusive time badge.
7. **Analog Calendar Clock (Theme 7)**:
   - Live analogue clock face with Bengali, Hijri, and English date lines.

### 3. Real-Time AI Agent Companion (Live Auto-Detection & Multi-Agent Rotation)
- **Zero Hardcoding & Honest Real Data**: Live telemetry is read dynamically from real local agent databases, session rollouts, and language server RPC endpoints without mock or bluff values:
  - **Google Gemini (Antigravity)**: Automatically connects to the local Antigravity Language Server RPC endpoint (`RetrieveUserQuotaSummary`) to pull authentic cloud quota metrics: **5-Hour Limit** (`% Left`, reset countdown, green progress bar) and **Weekly Limit** (`% Left`, reset countdown, green progress bar). Gracefully falls back to real session token counting from `~/.gemini/antigravity/brain/*/transcript.jsonl` if offline.
  - **OpenAI / Codex**: Reads active session rollouts from `~/.codex/sessions/**/rollout-*.jsonl`. Automatically filters out internal background review tasks (`codex-auto-review`) to lock onto your real interactive model (`GPT-5.6-LUNA`), showing **5-Hour Limit** and **Weekly Limit** quota percentages and reset countdowns.
  - **OpenCode**: Reads `~/.local/share/opencode/opencode.db` (`session_v2` and `session_message`). Displays the active model badge (`DeepSeek-V4.1`), **Context Window Limit** (`100% Left` / `1M window`, green progress bar), and cumulative **Session Total** tokens (`1.2M total`).
- **Multi-Agent Auto-Rotation**: In `auto` mode, when multiple agents (Gemini, Codex, OpenCode) have active sessions, the companion smoothly alternates between providers every 10 seconds. You can observe all active coding agents on your SmallTV display without manual switching!
- **Local Plugin & CLI Bridge**: Built-in HTTP receiver at `http://127.0.0.1:4310/provider-event` accepting custom agent events and token stats secured with a per-install bridge token.
- **Dynamic Configuration via `.env`**: All IP addresses, tokens, and ports are managed dynamically via `.env` with zero hardcoded credentials.

---

## 🐳 Docker Collector Setup & Maintenance

The companion daemon streams real-time token telemetry to the SmallTV over your local Wi-Fi network.

### Quick Start with Docker
```powershell
# 1. Run the automated Windows setup script:
powershell -ExecutionPolicy Bypass -File companion/setup_windows.ps1 -DeviceIp <YOUR_SMALLTV_IP> -EnableLocalFileScans
```
This automatically:
- Discovers your SmallTV device IP (or prompts for it).
- Generates a cryptographically secure 32-byte hex bridge token.
- Auto-detects the running Antigravity Language Server port and CSRF token for live Gemini quota metrics.
- Writes these parameters into your local `.env` file.
- Builds and launches the Docker collector in the background.

### Manual Docker Compose Commands
```powershell
# Start the collector with local file scanning enabled
docker compose -f docker-compose.yml -f docker-compose.local-files.yml up -d --build

# View real-time collector streaming logs
docker logs -f geekmagic-ultra-modification-smalltv-collector-1

# Stop the collector
docker compose -f docker-compose.yml -f docker-compose.local-files.yml down
```

### ⚙️ What To Do When Device IP or Wi-Fi Changes
If your router assigns a new IP address to your SmallTV, or you move to another network:

1. **Option A (Automated)**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File companion/setup_windows.ps1 -DeviceIp <NEW-DEVICE-IP> -EnableLocalFileScans
   ```

2. **Option B (Manual `.env` update)**:
   - Open `.env` in any text editor.
   - Update `SMALLTV_IP` to your new device IP (e.g. `SMALLTV_IP=192.168.0.X`).
   - Recreate the Docker container so it picks up the new IP immediately:
     ```powershell
     docker compose -f docker-compose.yml -f docker-compose.local-files.yml up -d --build --force-recreate
     ```

### Environment Variables Reference (`.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `SMALLTV_IP` | IP address of your SmallTV-Ultra on your local Wi-Fi | `192.168.0.82` |
| `SMALLTV_DEVICE_URL` | Web dashboard reverse-proxy target URL | `http://192.168.0.82` |
| `SMALLTV_PROVIDER_MODE` | Active provider mode: `auto`, `gemini`, `codex`, `opencode` | `auto` |
| `SMALLTV_PUSH_INTERVAL_SEC` | Telemetry push interval in seconds | `10` |
| `SMALLTV_FRESHNESS_TIMEOUT_SEC` | Inactivity seconds before agent state becomes `[IDLE]` | `90` |
| `SMALLTV_BRIDGE_TOKEN` | 32-byte hex security token for `/provider-event` bridge | *(Generated)* |
| `SMALLTV_ANTIGRAVITY_HUB_PORT` | Port of running Antigravity Language Server hub | *(Auto-detected)* |
| `SMALLTV_ANTIGRAVITY_CSRF_TOKEN` | CSRF token of running Antigravity Language Server | *(Auto-detected)* |

### Native Windows Execution (Without Docker)
If you prefer running natively on Windows without Docker:
```powershell
# Using Python directly (auto-detects .env and running processes)
py companion/companion.py

# Or run silent in background
cscript //nologo companion/start-companion-silent.vbs
```

### 4. Dynamic Theme Looping (Auto-Rotation)
- **Analog Calendar Clock**: A live analogue face with Bengali, Hijri, and English calendar lines in the dashboard and firmware.
- **Automatic Sequential Loop**: Cycles through your selected themes automatically after a configurable interval (10s, 15s, 30s, 60s, 120s).
- **Custom Active Theme Selection**: Interactive checkboxes / chips let you choose exactly which themes participate in the rotation.
- **In-Browser Real-Time Preview**: When enabled, the web dashboard's live simulation automatically rotates in sync with the hardware.
- **Animated Colons & Kinetic Motion**: Smooth breathing pulse animation (`kineticPulse`) for digital clock colons across all themes.

### 3. Date, Time & Timezone Customization
- **12-Hour vs. 24-Hour Toggle**: Switch between 12-hour format with AM/PM badge and 24-hour military clock.
- **Date Format Organizer**:
  - `DD MMM . Day` (e.g., `24 Oct . Fri`)
  - `DD/MM/YYYY` (e.g., `24/10/2026`)
  - `YYYY/MM/DD` (e.g., `2026/10/24`)
  - `MM/DD/YYYY` (e.g., `10/24/2026`)
  - `DD.MM.YYYY` (e.g., `24.10.2026`)
- **Timezone Presets**: Built-in support for Dhaka (`UTC+6:00`), New Delhi (`UTC+5:30`), Karachi (`UTC+5:00`), Dubai (`UTC+4:00`), London (`UTC+0:00`), New York (`UTC-5:00`), and worldwide offsets.
- **Instant LittleFS Flash Sync**: Explicit **Save Time & Date Settings** button writes directly to `/config.json` on flash and immediately updates the physical screen.

### 4. Interactive Responsive Web Dashboard
- **Modern UI & Micro-interactions**: Built with Tailwind CSS v4 and Kinetics spring physics transitions.
- **Mobile Drawer Navigation**: Slide-out off-canvas menu with hamburger button (`☰`), dedicated close button (`✕`), and backdrop blur overlay.
- **Captive Portal Wi-Fi Manager**:
  - Automatically launches DNS server on port 53 in AP mode (`SmallTV-Setup`) with IP `192.168.4.1`.
  - Captive redirects ensure phones/laptops don't fail DHCP or report "No internet".
  - **Rescan Networks**: Scans nearby 2.4 GHz SSIDs with signal bars.
  - **Single-Click Selection**: Selecting an SSID populates credentials and focuses the password field.
  - **Connect to Wi-Fi**: Sends credentials to `/api/wifi/connect`, saves to flash, and automatically connects to your router on boot.
- **Ultra-Compact PROGMEM Footprint**: The entire web application (HTML + CSS + JS) is bundled, inlined, and gzipped into a **14.54 KB header** (`web_assets.h`), consuming only **1.42%** of the 1 MB flash budget.

### 5. In-Browser OTA Firmware Upgrades
- Web-based multipart firmware flasher available at `/update` and inside the **System** tab.
- Allows upgrading or rolling back firmware wirelessly over Wi-Fi in ~15 seconds without USB cables or serial adapters.

---

## 📂 Repository & Project Structure

```
geekmagic-ultra-modification/
├── README.md                                  # Complete project documentation & guide
├── .env                                       # Local device IP, tokens & ports (git-ignored)
├── .env.example                               # Environment template for Docker & companion
├── docker-compose.yml                         # Hardened base collector container configuration
├── docker-compose.local-files.yml             # Volume mounts for local AI agent data
├── Dockerfile                                 # Non-root, read-only Python 3.12 companion container
├── server.js                                  # Local mock & reverse-proxy dashboard server
├── companion/                                 # AI Agent Telemetry Companion
│   ├── companion.py                           # Multi-agent live telemetry sync engine
│   ├── setup_windows.ps1                      # 1-command Windows setup & container deployer
│   └── test_companion.py                      # Companion test suite (9 unit tests)
├── firmware/                                  # PlatformIO ESP8266 project
│   ├── include/
│   │   └── web_assets.h                       # Gzipped PROGMEM bundle of web dashboard
│   ├── src/
│   │   └── main.cpp                           # Core firmware: ST7789 drivers, themes, REST API
│   └── platformio.ini                         # Build flags & TFT_eSPI hardware configuration
├── releases/                                  # Production-ready compiled firmware binaries
│   ├── custom_dashboard_firmware_v9.0.69.bin  # Latest custom firmware with multi-agent support
│   ├── custom_dashboard_firmware.bin          # Direct OTA binary symlink / copy
│   └── STOCK_ROLLBACK_Ultra-V9.0.50.bin       # Original factory firmware for instant rollback
├── src/                                       # Frontend web dashboard application
├── scripts/                                   # ESP8266 asset bundling & binary validation tools
└── test/                                      # Automated web dashboard tests (14 Node tests)
```

---

## ⚡ Step-by-Step Flashing Instructions

### Method 1: Web Browser OTA (Fastest & Safest)
1. Power on your SmallTV-Ultra via USB-C.
2. Connect your phone or computer to the Wi-Fi:
   - **If in AP mode**: Connect to `SmallTV-Setup` and open `http://192.168.4.1/update`.
   - **If connected to your router**: Open `http://[DEVICE-IP]/update` (e.g., `http://192.168.0.198/update`).
3. Click **Choose File** and select:
   ```
   releases/custom_dashboard_firmware_v9.0.69.bin
   ```
   *(MD5: `1CB78828E56DBEE3B478162E4E4E8B6C`, Size: 575,008 bytes)*
4. Click **Update**. The browser will upload the firmware, and the device will flash and reboot in ~15 seconds.
5. Once rebooted, visit `http://192.168.4.1/` (or your device IP) to access the dashboard.

### Method 2: PlatformIO (USB-C Flash)
1. Connect the SmallTV to your computer with a USB-C data cable.
2. In your terminal, build and flash the firmware:
   ```powershell
   pio run -d firmware -t upload
   ```
3. Open serial monitor at 115200 baud:
   ```powershell
   pio device monitor -b 115200
   ```

### Method 3: Factory Rollback Guarantee
If you ever want to restore the original stock GeekMagic factory firmware:
1. Open `http://[DEVICE-IP]/update`.
2. Choose `releases/STOCK_ROLLBACK_Ultra-V9.0.50.bin`.
3. Click **Update** to return to factory V9.0.50.

---

## 🔌 Hardware Specifications & Pinout

| Pin / Function | ESP8266 GPIO | Description |
|---|---|---|
| **TFT MOSI** | GPIO 13 | Hardware SPI Data Out |
| **TFT SCLK** | GPIO 14 | Hardware SPI Clock |
| **TFT DC** | GPIO 0 | Data / Command Select |
| **TFT RST** | GPIO 2 | Hardware Reset |
| **TFT BL** | GPIO 5 | Backlight PWM Control (Active-Low) |
| **TFT CS** | Tied to GND | Chip Select (Hardwired on PCB) |
| **MCU** | ESP8266EX | 80 MHz, 80 KB RAM, 4 MB SPI Flash |
| **Display** | ST7789V | 1.54-inch IPS LCD, 240×240 pixels |
| **Input Power** | 5.0 V DC | USB Type-C (~80 mA to 140 mA) |

---

## 🛡️ Electrical & Thermal Safety Guidelines

- **Linear Voltage Regulator (AMS1117-3.3)**: The PCB uses an AMS1117-3.3 LDO to step down 5V USB to 3.3V logic. Linear regulators convert excess voltage directly into heat.
- **Backlight Duty Cycle**: Running the display backlight continuously at 100% in a compact, sealed enclosure increases thermal stress.
- **Recommended Brightness**:
  - **Daytime Desk Use**: **60% to 75%** provides vivid contrast with minimal heat generation.
  - **Night Mode**: Built-in schedule dims to **20%** between 22:00 and 07:00, keeping the device cool and prolonging LED lifetime.

---

## 💻 Local Simulation & Testing

To preview or modify the web dashboard locally without hardware:
```powershell
# Navigate to the dashboard directory
cd smalltv-dashboard

# Install dependencies
npm install

# Start local mock server
npm run dev
# Open in browser: http://localhost:3000

# Run automated tests
npm test
```
