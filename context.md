# Project Context: GeekMagic SmallTV-Ultra Custom Firmware & Dashboard

## Current Status (October 2026 - V9.0.59)
- **Target Hardware**: GeekMagic SmallTV-Ultra (ESP8266EX 80 MHz, 4 MB Flash, 1.54" ST7789 IPS LCD 240×240, active-low PWM backlight on GPIO 5).
- **Firmware Binary**: `smalltv-dashboard/releases/custom_dashboard_firmware_v9.0.59.bin` and `releases/custom_dashboard_firmware.bin` (571,728 bytes, MD5 `b1c60f353648c6bd23f3ee2bf5adc4cb`).
- **Factory Rollback Binary**: `smalltv-dashboard/releases/STOCK_ROLLBACK_Ultra-V9.0.50.bin` (Size: 505,200 bytes).
- **Build & Environment Guide**: [`smalltv-dashboard/docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md).
- **Web Dashboard Bundle**: Inlined & gzipped into `dist/web_assets.h` (27.30 KB Gzip, 2.67% of 1 MB flash).
- **Mock Server**: Running at `http://localhost:3000` with live `/api/tokens` REST endpoints.
- **Build Verification**: PlatformIO build succeeded; binary validator confirmed the ESP8266 header and 54.5% OTA partition usage. All 14 Node tests and the Codex companion regression test passed.

### Version 9.0.65 UI & Model Parity Update (October 25, 2026 — built & validated)
- **Physical ST7789 Display & Web UI Parity**:
  - `renderThemeTokenMonitor()` in `main.cpp` now renders the authentic model sub-badge (e.g. `[ GPT-5.6-LUNA ]` or `[ 3.8 FLASH ]`) directly inside the top-right pill beside the provider name, matching the web simulator.
  - Added the official 6-spoke spiral rosette for OpenAI/Codex, refined 4-pointed sparkle for Gemini, and 8-pointed star for Claude on hardware ST7789 display.
- **AI Model Visibility in Telemetry Tables**:
  - Added dedicated **Live AI Telemetry** table (`Active AI Agent & Model`) to both Overview and Display tabs, displaying AI Provider, Active AI Model, Agent Live Status, Session Context, Turn Tokens, Total Tokens, and Telemetry Source.
  - Added dynamic real-time DOM updater in `updateTokenControls` so whenever live telemetry arrives from the companion daemon, the table fields immediately update without page refresh or flicker.
- **Official SVGs from svglogos.dev**:
  - Integrated official SVG logomarks for OpenAI, Google Gemini, and Anthropic Claude directly from `svglogos.dev`.
- **Pre-flash Binary Safety**:
  - Binary `custom_dashboard_firmware_v9.0.65.bin` and `custom_dashboard_firmware.bin` (582,576 bytes, MD5 `946cfcb499031a9ed26eb3a01b819628`, 55.6% OTA partition usage) built and validated.

### Version 9.0.59 prayer display correction (October 25, 2026 — built, not flashed)
- The live device was confirmed on an earlier v9.0.58 build, but `/api/settings` still returned the old seeded Asr `15:01` and the Prayer Times page rendered raw 24-hour values.
- The Prayer Times page now follows `12-Hour` mode explicitly and includes AM/PM; Dhaka Hanafi Asr renders as `03:48 PM`.
- Updated the Dhaka fallback schedule to the verified 25 October values, reduced BearSSL buffers for the ESP8266 prayer request, and wait for valid NTP time before the first request.
- Use `releases/custom_dashboard_firmware_v9.0.59.bin`; v9.0.58 is retained only as the currently flashed rollback point.

### Version 9.0.58 live prayer and Codex telemetry fixes (October 25, 2026 — flashed, superseded by v9.0.59)
- Confirmed the device was using seeded prayer values. The firmware now fetches the current day's timings from AlAdhan using the configured coordinates, Karachi method, and Hanafi school after Wi-Fi/NTP become available, then refreshes every six hours.
- For Dhaka on 25 October 2026, the verified Hanafi result is Fajr `04:44`, Sunrise `06:00`, Dhuhr `11:42`, Asr `15:48`, Maghrib `17:24`, and Isha `18:40`; display formatting remains 12-hour.
- Fixed Codex extraction so it continues past the newest token event to find the latest `turn_context` model. Missing limits now show `Unavailable` instead of hardcoded percentages/reset dates.
- The firmware and initial dashboard state now start the laptop companion as offline with zero/unavailable telemetry until a real push arrives.
- The dashboard adds the actual live provider/model to its selector when it is not in the static model list and uses the pushed 5-hour/7-day labels and text.
- A Codex-only companion daemon was started against `192.168.0.198` and live device values were verified through the browser.

### Version 9.0.57 display fixes (October 25, 2026 — flashed and verified live)
- Theme 1 firmware layout was aligned more closely with the HTML preview: two-digit clock hour, separate AM/PM placement, clearer full prayer names, lower compact telemetry row, and 12-hour sunset formatting.
- Added a small monochrome clock sprite so the clock and blinking colon update without clearing the full 240×240 display.
- Added localized sun pulse/cloud drift animation and minute-only prayer/date refreshes; the full-screen minute blink is removed for Theme 1.
- Added a short `SMALLTV` startup/loading animation before the dashboard is rendered.
- These changes are packaged in `releases/custom_dashboard_firmware_v9.0.57.bin`; the previous v9.0.56 binary remains available for rollback.

---

## Key Architectures & Feature Implementations

### 1. Pure Inky Black IPS Display (`TFT_BLACK` + ST7789 Inversion)
- Hardwired `TFT_BLACK` (`0x0000`) and ST7789 inversion mode (`tft.invertDisplay(true)`).
- Complete elimination of backlight bleed and grayish haze.
- Active-low PWM backlight mapping on GPIO 5 (`0` = 100% full bright, `1023` = 0% off).

### 2. Five Production Display Themes
1. **Weather & Prayer Station (Theme 1)**:
   - 12h/24h clock with animated kinetic pulsing colons.
   - Regional date format organizer.
   - 5-Waqt Salah grid (Fajr, Dhuhr, Asr, Maghrib, Isha) with upcoming prayer pill.
   - Streamlined 3-column telemetry (Temperature, Humidity, Sunset).
2. **Editorial Weather Clock (Theme 2)**:
   - Minimalist Swiss typography with high type-contrast hierarchy.
   - Massive centered digits with separator bar and weather hero card.
3. **Minimalist Clean Clock (Theme 3)**:
   - True OLED black minimalism focusing strictly on time and date.
   - Centered digital clock, AM/PM tag, full date string, connectivity dot.
4. **AI Token & Rate Limit Monitor (Theme 4)**:
   - Live telemetry monitor for **Google Gemini**, **OpenAI / Codex**, **Anthropic Claude**, and **OpenCode**.
   - Dual dynamic progress bars (Session context window, Daily/Weekly quota limit).
   - Dynamic model badge (e.g. `GEMINI 3.8 FLASH`, `GPT-5.6-TERRA`, `CLAUDE 3.7 SONNET`).
   - Official precision vector logos rendered on both ST7789 LCD and web dashboard.
5. **Cosmic Shuttle & Prayer Station (Theme 5)**:
   - **Kinetic Space Shuttle Animation**: Miniature vector orbiter with fiery plasma exhaust trail (`@keyframes thrusterPulse`) and hovering physics (`@keyframes shuttleFloat`).
   - **Full Salah Schedule Table**: Displays `START` and `END` times for all 5 daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha).
   - **Dynamic Real-Time Waqt Focusing**: Automatically tracks the current wall-clock time and focuses the active upcoming prayer row (e.g., glows on Dhuhr during morning, switches to Asr, then Maghrib, Isha, Fajr) with a luminous golden border and background gradient.
   - **Live Countdown Hero Card**: Displays `NEXT: [WAQT] / STARTS IN` with a real-time `HH:MM:SS` countdown timer.

### 3. Dynamic Telemetry Engine (`companion.py` v2.0 - No Hardcoded Data)
- **Zero Hardcoding**: Tokens, limits, percentages, and reset countdowns are read directly from local agent storage:
  - **Google Gemini (Antigravity)**: Scans newest `~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl`. Sums active turn tokens (`input_tokens + cache_read_tokens + output_tokens`) and cumulative conversation tokens. Uses dynamic 1M (`1,048,576`) context limit.
  - **OpenAI / Codex**: Scans `~/.codex/sessions/**/*.jsonl`. Parses `turn_context` for model and `event_msg -> token_count` for `model_context_window` (`258,400`), `last_token_usage`, `primary` (session rate-limit % and reset countdown), and `secondary` (weekly quota % and reset countdown).
- **Auto-Provider Switching**: Compares modification timestamps (`mtime`) and automatically follows whichever agent is actively coding.
- **Dynamic State Sensing**: Marks `[WORKING]` if active within 90 seconds, otherwise `[IDLE]`.
- **Live Auto-Sync Poller**: Web dashboard polls `/api/tokens` every 2.5 seconds, immediately updating the UI whenever the companion sends a telemetry push.

### 6. Version 9.0.56 Enhancements (Percentage-Based Limits & Complete Web Assets Sync)
- **Resolved 4 Themes on Web Interface (`192.168.0.198/#display`)**:
  - *Root Cause*: `scripts/build-esp.js` originally wrote only to `dist/web_assets.h`, leaving `firmware/include/web_assets.h` on an older 8:01 AM timestamp. PlatformIO compiles from `firmware/include/web_assets.h`.
  - *Fix*: Updated `scripts/build-esp.js` to automatically synchronize `firmware/include/web_assets.h` on every build. All 5 themes (including Theme 5 Cosmic Shuttle) now render in the web browser.
- **Resolved Unexpected "Claude" Data (Stale Daemon Elimination)**:
  - *Root Cause*: An old Python companion background process (PID 23032 started at 7:21 AM) was still running on Windows and sending stale hardcoded Claude packets every 5 seconds.
  - *Fix*: Terminated the stale daemon.
- **Percentage-Based Limits Architecture (Gemini, Codex, OpenCode)**:
  - **Gemini (Antigravity)**: Shows **5-Hour Limit Remaining** (`63%`, `2h 58m`) and **Weekly Limit Remaining** (`62%`, `5d 03h`), matching the exact Antigravity Quota panel.
  - **OpenAI / Codex**: Shows **5-Hour Limit** (`100% Left` / `resets 1:59 PM`) and **7-Day Limit** (`100% Left` / `resets Oct 31`), matching the VS Code / OpenCode status bar.
  - **OpenCode**: Shows `100% Left` (5h and 7d) with purple terminal icon.
  - Hardware ST7789 display renders dynamic labels (`5-HOUR LIMIT`, `WEEKLY LIMIT`) with colored fill meters and percentage tags.

## 2026-10-25 — Realtime telemetry and Theme 5 implementation

- Installed local `kinetics-animation` and `motion-react` skills under `C:\Users\SadmanShowmik\.codex\skills`; dashboard uses Kinetics CSS orbit motion and existing firmware frame-loop patterns, with no new runtime dependency.
- Implemented honest provider telemetry: Codex remains the only complete verified quota source; Gemini/Antigravity exposes transcript activity only, OpenCode/Claude/OpenRouter remain unavailable when no local source exists, and auto mode selects freshest evidence instead of cycling.
- Web token controls are read-only detected-source UI with live/stale/unavailable state, nullable meters, corrected remaining-capacity colors, and animated Connect Provider state. Added explicit settings reset control.
- Firmware token contract now accepts telemetry metadata/nulls, uses corrected colors, adds `POST /api/system/reset`, and Theme 5 uses prayer Maghrib for sunset with black table treatment.
- Firmware build succeeded via `py -m platformio run`; latest binary is `Ultra-V9.0.62-Custom` and has not been flashed. v9.0.61+ clears retained reset strings when telemetry sends null and only marks the laptop connected when a provider source is present; v9.0.62 packages the updated unavailable-model UI.
- Companion unavailable-mode crash fixed: the streaming loop now reads nullable token fields with safe defaults instead of indexing missing `sessionTokens`/`sessionLimit` keys.
- Added a loopback CLI/plugin bridge at `POST http://127.0.0.1:4310/provider-event`; normalized plugin events participate in freshest-source selection alongside CLI adapters, with optional bridge token support and no fabricated fields.
- Built `Ultra-V9.0.63-Custom` to package the web fallback fix (`--`/Unavailable instead of `null%`) for the device-served dashboard; manual plugin events still provide identity/status only unless real quota fields are included.
- Added reusable Docker collector packaging: `Dockerfile`, `docker-compose.yml`, `.env.example`, and `.dockerignore`. The existing companion now accepts container environment overrides and can bind the bridge to `0.0.0.0` inside Docker while publishing only host loopback `127.0.0.1:4310`. Provider directories are mounted read-only; firmware does not need reflashing for collector-only changes.
- Hardened the public Docker defaults: no provider-session mounts by default, mandatory generated bridge token, non-root/read-only container, dropped capabilities, and explicit `docker-compose.local-files.yml` opt-in for the existing local transcript scans. Added `companion/setup_windows.ps1` for one-command setup.
- Built `Ultra-V9.0.64-Custom`: Theme 4 now shows verified Gemini/Codex token usage counts (`TOKENS USED` / `SESSION TOTAL`) when quota percentages are unavailable, while keeping unknown quotas as `--`. OTA is required for the physical display to receive this UI change.
- Fixed stale telemetry retention: when the collector reports an unavailable source, firmware now clears prior session/weekly token counts, limits, and observation time instead of exposing old values alongside `UNAVAILABLE`. This is packaged for the next firmware build.
