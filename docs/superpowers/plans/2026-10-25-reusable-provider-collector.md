# Reusable Provider Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide one reusable Windows companion that captures verified CLI, plugin, hook, API, and event-stream telemetry and forwards it to SmallTV without guessing provider identity or quota.

**Architecture:** A single collector owns the loopback bridge and one provider adapter per source. Adapters normalize events into the existing `/provider-event` schema; the collector selects the freshest verified observation and pushes the backward-compatible `/api/tokens` payload to the device. Firmware remains provider-agnostic and contains no desktop credentials.

**Tech Stack:** Python 3 standard library, Windows process/task integration, Codex hooks/app-server, Claude hooks/OAuth usage source, OpenCode HTTP/SSE, Antigravity transcript watcher, existing Node dashboard, ESP8266 REST contract.

**Spec:** `docs/superpowers/specs/2026-10-25-realtime-provider-telemetry-and-theme5-design.md`

## Current implementation status

- [x] Reused the existing companion as the single collector/bridge instead of creating a second process.
- [x] Added Docker packaging, environment overrides, read-only provider mounts, and a bridge healthcheck.
- [x] Hardened Docker defaults: non-root user, read-only filesystem, dropped capabilities, required random bridge token, and no provider-file mounts by default.
- [x] Added `companion/setup_windows.ps1` for one-command setup; local file scans are an explicit opt-in override.
- [x] Added Windows/Docker setup and stop instructions to `docs/BUILD_GUIDE.md`.
- [x] Verified Python regression tests, syntax, Compose interpolation, image build, and an isolated container bridge smoke test.
- [ ] Provider-specific Codex hooks, Claude hooks, OpenCode SSE, and Antigravity plugin emitters remain follow-up adapter work; Docker cannot create those events by itself.

## Global Constraints

- Never synthesize provider, model, quota percentage, or reset time.
- Auto mode selects the freshest genuine event and never cycles providers.
- Browser process detection is status-only and cannot claim a model or quota.
- Provider credentials remain on the laptop and never enter firmware or committed files.
- Bind the bridge to `127.0.0.1`; require an optional local bridge token for plugin posts.
- Keep the existing flat `/api/tokens` fields and nullable telemetry metadata.
- Keep `geekmagic-tv-esp8266-master` and `codelight-master` untouched; reuse their patterns only.

## File map

- Create: `smalltv-dashboard/companion/providers/contract.py` — normalized observation type and validation.
- Create: `smalltv-dashboard/companion/providers/codex.py` — Codex hook/app-server adapter.
- Create: `smalltv-dashboard/companion/providers/claude.py` — Claude hook/usage adapter.
- Create: `smalltv-dashboard/companion/providers/opencode.py` — OpenCode HTTP/SSE adapter.
- Create: `smalltv-dashboard/companion/providers/antigravity.py` — transcript activity adapter.
- Existing: `smalltv-dashboard/companion/companion.py` — retained as the single bridge process, source registry, freshness selection, and device push.
- Deferred: `smalltv-dashboard/companion/setup_windows.ps1` — add only if Docker/foreground startup proves insufficient.
- Modify: `smalltv-dashboard/companion/companion.py` — retain CLI compatibility and add container environment overrides.
- Create: `smalltv-dashboard/Dockerfile`, `docker-compose.yml`, `.dockerignore`, and `.env.example` — reproducible collector packaging.
- Modify: `smalltv-dashboard/companion/config.json` — source paths, bridge port/token, device IP, freshness timeout.
- Create: `smalltv-dashboard/companion/test_providers.py` — adapter and freshness fixtures.
- Modify: `smalltv-dashboard/companion/test_companion.py` — bridge/collector regression tests.
- Modify: `smalltv-dashboard/docs/BUILD_GUIDE.md` — installation, provider capabilities, and troubleshooting.
- Modify: `smalltv-dashboard/context.md` — milestone and known provider limitations.

### Task 1: Freeze the normalized event contract

**Interfaces:** `Observation.from_payload(payload) -> Observation | None`; `Observation.to_device_payload() -> dict`; fields are `provider`, nullable `model`, `state`, `observedAt`, `source`, nullable quota/reset/window fields.

- [ ] Write failing tests for valid Codex, status-only Gemini, rejected missing provider, rejected invalid timestamp, and nullable quota fields.
- [ ] Implement the dataclass and range validation; preserve `None` for unavailable values.
- [ ] Run `py -m unittest companion.test_providers -v` and confirm all contract tests pass.

### Task 2: Make one collector process own the bridge and device stream

**Interfaces:** `Collector.register(observation)`, `Collector.latest()`, `Collector.select(freshness_seconds)`, `start_bridge(port, token)`, and `Collector.push(device_ip)`.

- [ ] Add tests proving the freshest event wins, stale events become unavailable, and duplicate bridge startup fails clearly.
- [x] Keep the current loopback POST/GET bridge and in-memory event store in the existing companion to avoid a duplicate collector implementation.
- [ ] Add a single-instance lock file or localhost PID lock so two collectors cannot race on port 4310/device writes.
- [ ] Keep `companion.py` as a compatibility launcher that starts exactly one collector.
- [ ] Run the companion test suite and a real POST/GET bridge smoke test.

### Task 3: Add Codex CLI/plugin capture

**Interfaces:** `CodexAdapter.scan() -> Observation | None`; `install_codex_hooks(config) -> InstallResult`; optional app-server usage reader returning verified rate-limit windows.

- [ ] Add fixtures for a Codex rollout event containing `turn_context.model` and `token_count.rate_limits`.
- [ ] Implement the existing rollout-file reader as an adapter with a 90-second freshness threshold.
- [ ] Add an opt-in Codex hook command that posts lifecycle/model events to `/provider-event`; never infer model from a running process alone.
- [ ] Add an app-server usage adapter only when the local Codex installation supports the documented RPC; return unavailable on failure.
- [ ] Document hook trust/review and test the installer in a temporary `CODEX_HOME`.

### Task 4: Add Claude, OpenCode, and Antigravity adapters

**Interfaces:** `ClaudeAdapter.scan()`, `OpenCodeAdapter.listen()`, and `AntigravityAdapter.scan()` all return `Observation | None`.

- [ ] Claude: read real hook/session events and optional OAuth usage only when credentials/source exist; otherwise return unavailable.
- [ ] OpenCode: connect only to a configured local HTTP/SSE server; report activity/cost when available, never invent a percentage.
- [ ] Antigravity: retain transcript activity/token extraction but leave model/quota/reset nullable unless records prove them.
- [ ] Add stale, disconnected, malformed-event, and provider-priority fixtures.
- [ ] Verify auto mode switches from Antigravity to Codex when a fresh Codex hook event arrives, then back to unavailable after timeout.

### Task 5: Add repeatable Windows setup and diagnostics

**Interfaces:** `setup_windows.ps1 -DeviceIp <ip> [-InstallCodexHooks] [-CreateStartupTask]` and `collector --diagnose`.

- [ ] Write setup tests/checks for Python availability, config creation, bridge-port availability, and device `/api/status` reachability.
- [x] Implemented a reversible setup script that creates `.env` and starts the collector; startup-task registration remains optional follow-up work.
- [ ] Add diagnostics showing each provider source, last observed time, freshness, capabilities, and why it is unavailable.
- [ ] Ensure uninstall removes only SmallTV-owned hooks/task entries.

### Task 6: Keep dashboard/firmware consumers honest

**Files:** `src/main.js`, `src/api.js`, `firmware/src/main.cpp`, generated assets only through existing build scripts.

- [ ] Add contract tests for live, stale, unavailable, status-only, and quota-bearing observations.
- [ ] Show provider identity/status when known and `Unavailable`/`--` for missing model, quota, and reset values.
- [ ] Preserve the current firmware nullable token handling and explicit reset endpoint.
- [ ] Build assets and firmware; validate OTA binary size/hash without flashing automatically.

### Task 7: Documentation and release verification

- [x] Document Docker setup, provider mounts, bridge POST schema, credential boundaries, and duplicate-process guidance.
- [ ] Run Python tests, Node tests, asset packaging, PlatformIO build, binary validation, and live bridge smoke test.
- [ ] Record firmware version/hash and the exact sources verified in `context.md`.
- [ ] Confirm the physical device only needs OTA after firmware/UI changes; laptop provider setup remains a separate one-time step.

## Self-review

- CLI capture: Task 3.
- Plugin/hook capture: Tasks 2–3.
- Claude/OpenCode/Gemini alternatives: Task 4.
- Desktop/tray setup: Task 5.
- Device contract/UI/firmware: Task 6.
- No browser scraping, fabricated quotas, or firmware credentials are introduced.
