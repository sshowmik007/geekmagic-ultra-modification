# SmallTV Firmware Integration & Pre-Flash Verification Plan

> **Goal:** Create the standalone PlatformIO firmware project structure within `smalltv-dashboard/firmware/`, wire `web_assets.h` into the ESP8266 web server, and implement automated pre-flash safety validation scripts.

---

## Tasks

### Task 1: Create Pre-Flash Binary Validator (`scripts/validate-binary.js`)
- [ ] **Step 1:** Create `scripts/validate-binary.js`.
- [ ] **Step 2:** Validate ESP8266 magic byte (`0xE9`).
- [ ] **Step 3:** Validate binary size is strictly under 1,048,576 bytes.
- [ ] **Step 4:** Compute and display MD5 checksum.
- [ ] **Step 5:** Test validator against the known-good stock `Ultra-V9.0.50.bin`.

### Task 2: Create PlatformIO Firmware Scaffold (`smalltv-dashboard/firmware/`)
- [ ] **Step 1:** Create `smalltv-dashboard/firmware/platformio.ini` with exact SmallTV-Ultra ST7789 pin flags and nodemcuv2 configuration.
- [ ] **Step 2:** Copy or symlink `dist/web_assets.h` into `firmware/include/`.
- [ ] **Step 3:** Implement `firmware/src/main.cpp` providing:
  - Backlight PWM on GPIO 5
  - Hardware ST7789 display initialization
  - LittleFS filesystem mounting
  - Wi-Fi AP + Station fallback
  - `ESP8266WebServer` serving `serveDashboard(server)` on `/`
  - JSON REST endpoints matching `/api/status`, `/api/settings`, `/api/wifi/scan`

### Task 3: Automated Tests & Verification
- [ ] **Step 1:** Add validator unit tests in `test/validator.test.js`.
- [ ] **Step 2:** Run `npm test` to verify all suites pass.
- [ ] **Step 3:** Update `context.md` with complete Phase 4 status.

