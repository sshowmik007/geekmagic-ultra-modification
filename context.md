# SmallTV Dashboard Context

## Start here

This folder is a safe local design prototype for a clearer SmallTV-Ultra browser dashboard. It is not firmware, does not communicate with a device, and must not be flashed.

Read these files before changing anything:

1. `docs/superpowers/specs/2026-10-23-dashboard-prototype-design.md`
2. `docs/superpowers/plans/2026-10-23-dashboard-prototype.md`

## What has been confirmed

- The target hardware is a GeekMagic SmallTV-Ultra using ESP8266.
- The stock dashboard was inspected read-only in a browser. Its pages are Network, Weather, Time, Pictures, and Settings.
- The inspected device reported model `SmallTV-Ultra` and firmware `Ultra-V9.0.51`.
- The stock dashboard supports Wi-Fi configuration, weather location and refresh settings, time/NTP controls, image/GIF upload, display themes, brightness, night mode, factory reset, reboot, and firmware upload.
- The vendor package in this workspace contains release firmware binaries and checksums, not editable source code.

## Reference repositories

Do not modify either of these folders.

- `../geekmagic-tv-esp8266-master/` is the main source reference for an ESP8266 SmallTV firmware, its server routes, display code, embedded dashboard assets, PlatformIO configuration, OTA, and LittleFS use.
- `../codelight-master/screen/` is a hardware and bootstrapping reference for the same class of device. It is useful for display wiring assumptions, first-stage OTA constraints, and recovery planning.

## Work completed

- Created `smalltv-dashboard/` as the isolated workspace for the custom dashboard.
- Created the prototype design specification (`docs/superpowers/specs/2026-10-23-dashboard-prototype-design.md`).
- Created the implementation plan (`docs/superpowers/plans/2026-10-23-dashboard-prototype.md`).
- Confirmed local development tooling: Node.js `v24.19.0`, npm `11.17.0`, Tailwind CSS v4 CLI (`@tailwindcss/cli`).
- Implemented full interactive prototype in `index.html`, `src/input.css`, `src/state.js`, and `src/main.js` covering Overview, Display themes, Weather, Time with color pickers, Network with Wi-Fi discovery, Media storage, and System controls.
- **Phase 2 Complete - Mock API & Dev Server**:
  - Authored ESP8266 REST API Specification: `docs/superpowers/specs/2026-10-23-api-contract-and-mock-server.md`.
  - Authored Implementation Plan: `docs/superpowers/plans/2026-10-23-api-and-dev-server.md`.
  - Built zero-dependency Node development server (`server.js`) using `node:http`.
  - Implemented `/api/status`, `/api/settings`, `/api/wifi/scan`, `/api/wifi/connect`, `/api/system/reboot`, `/api/system/reset`.
  - Built frontend client adapter (`src/api.js`) with automatic offline/`file://` fallback and toast feedback.
  - Added unit test suite covering state and server REST APIs in `test/server.test.js`.
  - **10 automated tests passing** with `npm test`.
  - Minified production CSS compiled to `dist/styles.css` (88ms build time).
- **Phase 3 Complete - ESP8266 Asset Bundling & C++ PROGMEM Exporter**:
  - Authored Asset Bundling Specification: `docs/superpowers/specs/2026-10-23-esp8266-asset-bundler.md`.
  - Authored Implementation Plan: `docs/superpowers/plans/2026-10-23-esp8266-asset-bundler.md`.
  - Created automated bundler script `scripts/build-esp.js` (`npm run build:esp`).
  - Automatically inlines HTML, CSS, and JS into a single-request self-contained payload.
  - Generates Gzip-compressed C++ header: `dist/web_assets.h` (using `PROGMEM`).
  - Generates standalone LittleFS image: `dist/littlefs/index.html.gz`.
  - Bundle size metrics:
    - Raw uncompressed: 42.4 KB
    - **Gzip compressed: 11.0 KB** (Only **1.08%** of the 1 MB sketch Flash budget!)
  - Added unit test suite in `test/bundler.test.js` validating decompression and C++ syntax.
  - **11 automated tests passing** across state, server, and bundler suites.
- Safety boundary strictly upheld: Zero HTTP/fetch requests to device IP `192.168.0.198`, zero device writes, no firmware touched.

## Current implementation boundary

The local environment can run in two modes:
1. **Local Server Mode (`npm start` or `npm run dev`)**: Serves on `http://localhost:3000`. Full REST API simulation with async saving, live toasts, and Wi-Fi scan responses.
2. **Offline File Mode**: Opening `index.html` directly in any browser. Automatically detects `file://` protocol and operates using in-memory state with zero network calls.

## Next action

1. Start the local server (`npm start`) and inspect the dashboard in your browser at `http://localhost:3000`.
2. Test the responsive layouts, theme switching, brightness slider, and clock color pickers.
3. Review the API contract in `docs/superpowers/specs/2026-10-23-api-contract-and-mock-server.md` before moving to firmware C++ asset embedding.

## Safety rules

- Never modify the reference repositories without new explicit user approval.
- Never upload firmware, click device save/reboot/reset, alter Wi-Fi, or send device HTTP requests without explicit user approval for that exact action.
- Do not treat the vendor firmware binary as editable source.
- Keep this prototype independent from the device until the user explicitly starts the firmware integration stage.

## Workspace note

The workspace currently has no Git repository. Do not assume commits, branches, or rollback history exist. Initialize Git only if the user asks.
