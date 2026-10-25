# Real-Time Provider Telemetry and Theme 5 Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove fabricated provider telemetry, show honest live/stale/unavailable states, and align the Cosmic Shuttle prayer screen with its 240×240 preview.

**Architecture:** Keep the existing flat `/api/tokens` contract for ESP8266 compatibility, adding nullable telemetry metadata. The companion becomes an adapter-based observer that selects the freshest genuine source; the web and firmware render unavailable data as a connected-provider prompt. Theme 5 uses fixed bounds and localized animation updates without changing the OTA persistence model.

**Tech Stack:** Python 3 companion, Node.js browser dashboard/mock server, Arduino C++/TFT_eSPI, Node test runner, unittest, PlatformIO.

**Spec:** `docs/superpowers/specs/2026-10-25-realtime-provider-telemetry-and-theme5-design.md`

## Global Constraints

- Never synthesize provider, model, quota percentage, or reset time.
- Auto mode selects the freshest genuine event and never cycles providers.
- Remaining-capacity colors are green 75–100, yellow 40–74, orange 15–39, red 0–14; unavailable is muted.
- Normal OTA preserves LittleFS; reset is explicit and destructive.
- Keep reference repositories untouched and avoid adding dependencies.

### Task 1: Install and document local animation skills

**Files:**
- Create: `C:/Users/SadmanShowmik/.codex/skills/kinetics-animation/**`
- Create: `C:/Users/SadmanShowmik/.codex/skills/motion-react/**`
- Modify: `smalltv-dashboard/context.md`

- [ ] Copy both supplied skill folders into the Codex skills directory and verify each `SKILL.md` is readable.
- [ ] Add a context entry noting that Kinetics CSS/frame-loop guidance is used and Motion is reference-only because the dashboard is vanilla DOM.

### Task 2: Make companion telemetry honest and freshest-source based

**Files:**
- Modify: `smalltv-dashboard/companion/companion.py`
- Modify: `smalltv-dashboard/companion/test_companion.py`
- Modify: `smalltv-dashboard/companion/config.json`

**Interfaces:** `get_codex_telemetry`, `get_gemini_telemetry`, `get_opencode_telemetry`, and `detect_live_telemetry` return either a verified observation or `None`; payload adds `telemetryState`, `sourceLabel`, `observedAt`, window minutes, and nullable percentages/resets.

- [ ] Add failing tests proving OpenCode returns `None`, Gemini leaves model/quota/reset unavailable, and auto chooses the newest genuine mtime without cycling.
- [ ] Remove synthetic Gemini defaults/countdowns and the hardcoded OpenCode observation.
- [ ] Derive Codex labels from real `window_minutes`; preserve `None` for missing limits instead of zero/fake values.
- [ ] Implement stale/unavailable selection and emit the extended nullable payload.
- [ ] Change the normal launcher/config to `auto`; keep `--mode` only as an explicit diagnostic override.
- [ ] Run `python -m unittest discover -s companion -p 'test_*.py' -v`.

### Task 3: Update mock API contract and reset behavior

**Files:**
- Modify: `smalltv-dashboard/server.js`
- Modify: `smalltv-dashboard/mock_settings.json`
- Modify: `smalltv-dashboard/test/server.test.js`

- [ ] Add a test for nullable telemetry fields and `POST /api/system/reset` success.
- [ ] Change mock token defaults to unavailable rather than fabricated provider/model/percentages.
- [ ] Preserve token fields on POST while accepting the new metadata.
- [ ] Keep reset behavior explicit and clearly simulated in the mock.

### Task 4: Replace misleading web token controls with detected-source UI

**Files:**
- Modify: `smalltv-dashboard/src/main.js`
- Modify: `smalltv-dashboard/src/input.css`
- Modify: `smalltv-dashboard/src/state.js`
- Modify: `smalltv-dashboard/test/state.test.js`

- [ ] Add tests for remaining-color thresholds and unavailable values.
- [ ] Make provider/model/status read-only and display source plus last-seen age.
- [ ] Render the orbiting three-node `Connect provider` animation with reduced-motion support; remove the generated curl command from the primary panel.
- [ ] Do not render unavailable percentages as 0%; show muted unavailable meters.
- [ ] Reverse remaining-meter color logic and use real window labels/reset metadata.
- [ ] Preserve existing state/reducer compatibility for legacy flat fields.

### Task 5: Firmware telemetry, reset endpoint, and Theme 5 parity

**Files:**
- Modify: `smalltv-dashboard/firmware/src/main.cpp`
- Modify: `smalltv-dashboard/scripts/validate-binary.js` only if endpoint/assets require it

- [ ] Extend `TokenUsage` and `/api/tokens` parsing/serialization with nullable state/source/observed/window fields.
- [ ] Render muted unavailable meters and a non-blocking three-dot connect-provider animation; correct remaining color thresholds.
- [ ] Add `POST /api/system/reset` that removes `/config.json`, responds, and reboots into setup mode.
- [ ] Refactor Theme 5 to fixed 240×240 bounds, use prayer Maghrib for sunset, outline the upcoming row, and update shuttle/colon/countdown locally without full-screen blinking.
- [ ] Build and validate the firmware binary with the existing PlatformIO/build scripts; do not flash automatically.

### Task 6: System-page reset control and documentation

**Files:**
- Modify: `smalltv-dashboard/src/main.js`
- Modify: `smalltv-dashboard/context.md`
- Modify: `smalltv-dashboard/docs/BUILD_GUIDE.md` if endpoint/build steps changed

- [ ] Add a confirmed destructive `Erase settings & reconnect` action explaining Wi-Fi loss and `SmallTV-Setup` recovery.
- [ ] Document the new telemetry states, normal `auto` companion launch, and firmware version/hash after build.
- [ ] Run Node tests, companion tests, and `git diff --check`.

## Self-review checklist

- Spec sections covered: provider adapters (Task 2), selection (Task 2), contract (Tasks 2–3), colors/UI (Task 4), disconnected animation (Tasks 4–5), Theme 5 (Task 5), reset/OTA (Tasks 5–6), runtime hygiene (Task 2), verification (Tasks 2–6).
- No fabricated values remain in companion or mock defaults.
- Existing callers retain flat token fields and nullable values are handled before rendering.
