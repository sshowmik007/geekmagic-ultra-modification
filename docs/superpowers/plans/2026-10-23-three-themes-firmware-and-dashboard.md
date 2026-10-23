# Implementation Plan: Three-Theme Firmware Engine & Precision Dashboard

## Task Breakdown

### Phase 1: Web Dashboard Enhancements
- [x] Create comprehensive `.gitignore` in workspace and `smalltv-dashboard/`.
- [ ] Update `src/state.js` to store:
  - 3 themes: `"Weather & Prayer Station"`, `"Editorial Weather Clock"`, `"Minimalist Clean Clock"`.
  - Prayer location & calculation parameters (latitude, longitude, method, asrMethod, timings).
- [ ] Update `src/main.js`:
  - Render 3 distinct theme selection cards with badges.
  - Add Prayer Times configuration section (coordinates, method dropdown, Asr method).
  - Add dedicated **"Save Settings"** button with immediate toast feedback.
- [ ] Build CSS and update unit tests (`npm run build`, `npm test`).

### Phase 2: Firmware C++ Engine Implementation
- [ ] In `smalltv-dashboard/firmware/src/main.cpp`:
  - Integrate NTP synchronization (`configTime`).
  - Implement dynamic screen rendering switch for:
    1. `renderThemePrayerWeather()` (Theme 1: 5-Waqt Salah Grid + Weather + 4 telemetry cards).
    2. `renderThemeEditorialClock()` (Theme 2: Large 58px digits + Sun + Weather metrics).
    3. `renderThemeMinimalClock()` (Theme 3: Time + Date + AM/PM).
  - Add REST API handlers for prayer settings & status.
  - Implement active-low backlight & ST7789 display inversion.
  - Keep `/update` OTA endpoint active.

### Phase 3: Bundling, Compilation & Verification
- [ ] Rebuild web assets header: `npm run build:esp` -> `firmware/include/web_assets.h`.
- [ ] Compile with PlatformIO Xtensa toolchain (`pio.exe run -d smalltv-dashboard/firmware`).
- [ ] Validate binary (<1 MB, Magic Byte `0xE9`, MD5 checksum).
- [ ] Stage `smalltv-dashboard/releases/custom_dashboard_firmware.bin`.

### Phase 4: Verification & Handoff
- [ ] Test local dashboard server.
- [ ] Update `context.md`.
- [ ] Present ready-to-flash binary to user with instructions.

