# SmallTV Mock API Server & Asynchronous Client Plan

> **Goal:** Create a lightweight, zero-dependency local Node.js development server and an asynchronous client module to simulate the exact ESP8266 REST API and provide realistic local testing at `http://localhost:3000`.

**Tech Stack:** Node.js (`node:http`, `node:fs`, `node:test`), Vanilla JS Fetch API, Tailwind CLI.

---

## Tasks

### Task 1: Create the Local Mock Server (`server.js`)
- [ ] **Step 1:** Create `server.js` using `node:http`, `node:fs`, and `node:path`.
- [ ] **Step 2:** Serve static files (`index.html`, `dist/styles.css`, `src/*.js`) with proper MIME types.
- [ ] **Step 3:** Implement mock REST endpoints:
  - `GET /api/status`
  - `GET /api/settings`
  - `POST /api/settings`
  - `GET /api/wifi/scan`
  - `POST /api/wifi/connect`
  - `POST /api/system/reboot`
  - `POST /api/system/reset`
- [ ] **Step 4:** Write automated tests in `test/server.test.js` verifying each endpoint returns expected status and JSON schema.

### Task 2: Create Frontend API Adapter (`src/api.js`)
- [ ] **Step 1:** Create `src/api.js` with client methods (`getStatus()`, `getSettings()`, `saveSettings()`, `scanWifi()`).
- [ ] **Step 2:** Add environment detection: fallback to in-memory state if loaded from `file://` protocol.
- [ ] **Step 3:** Wire `api.js` into `src/main.js` with asynchronous toast feedback ("Saving...", "Saved to flash", etc.).

### Task 3: Update NPM Scripts & Verify
- [ ] **Step 1:** Update `package.json` with `"start": "node server.js"` and `"dev": "node server.js"`.
- [ ] **Step 2:** Run `npm test` to verify all state and API tests pass.
- [ ] **Step 3:** Rebuild CSS with `npm run build`.

### Task 4: Documentation & Context Update
- [ ] **Step 1:** Update `smalltv-dashboard/context.md` with new test counts, API specifications, and local server instructions.

