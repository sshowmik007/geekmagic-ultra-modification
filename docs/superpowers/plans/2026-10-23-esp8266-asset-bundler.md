# ESP8266 Asset Bundling Implementation Plan

> **Goal:** Build the asset packaging pipeline that transforms our web dashboard into a production-ready Gzip C++ PROGMEM header (`web_assets.h`) and LittleFS gzipped files for the ESP8266 firmware.

**Tech Stack:** Node.js (`node:fs`, `node:zlib`, `node:path`), Tailwind CSS v4 CLI, Node test runner.

---

## Tasks

### Task 1: Create Asset Bundling Script (`scripts/build-esp.js`)
- [ ] **Step 1:** Create `scripts/build-esp.js`.
- [ ] **Step 2:** Read `index.html`, `dist/styles.css`, and modular JS files (`main.js`, `state.js`, `api.js`).
- [ ] **Step 3:** Inline CSS into a `<style>` block and JS into a `<script>` block, removing external `<link>` and `<script src>` tags so the entire app is served in **1 single HTTP request**.
- [ ] **Step 4:** Compress the bundle using `zlib.gzipSync(..., { level: 9 })`.
- [ ] **Step 5:** Generate `dist/web_assets.h` with hex formatted C array (`const uint8_t DASHBOARD_GZ[] PROGMEM = { ... };`).
- [ ] **Step 6:** Generate `dist/littlefs/index.html.gz`.
- [ ] **Step 7:** Print a terminal summary table showing Uncompressed size, Gzip size, and % of 1 MB Flash budget.

### Task 2: Automated Tests for the Bundler (`test/bundler.test.js`)
- [ ] **Step 1:** Create `test/bundler.test.js`.
- [ ] **Step 2:** Assert `dist/web_assets.h` exists and contains valid C/C++ syntax (`PROGMEM`, array length, `#ifndef WEB_ASSETS_H`).
- [ ] **Step 3:** Assert gzipped size is strictly under 50 KB.
- [ ] **Step 4:** Assert decompressing `DASHBOARD_GZ` yields valid HTML containing our page elements.

### Task 3: Integrate with NPM Scripts & Context Update
- [ ] **Step 1:** Add `"build:esp": "node scripts/build-esp.js"` to `package.json`.
- [ ] **Step 2:** Run `npm test` and verify all tests pass.
- [ ] **Step 3:** Update `context.md` with new deliverables and bundle metrics.
