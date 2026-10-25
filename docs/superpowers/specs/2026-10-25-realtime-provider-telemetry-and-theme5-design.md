# Real-Time Provider Telemetry, Honest Limits, and Theme 5 Parity

## Goal

Make the SmallTV report only telemetry that can be proven from a current local provider source. Remove simulated provider/model/quota data, correct the meaning and colors of remaining quota, provide a useful animated disconnected state, and align the physical Cosmic Shuttle theme with the 240×240 web preview.

Normal OTA updates will continue to preserve Wi-Fi and settings. The System page will provide a separate explicit factory-reset action that deletes `/config.json` and reboots into `SmallTV-Setup` mode.

## Current Problems Confirmed

- OTA updates replace the application partition but preserve LittleFS. The live v9.0.59 device retained SSID `Home`, brightness, theme, city, and time settings by design; this is persistent configuration, not browser cache.
- The running device companion is forced to `--mode codex`, so it cannot select another active provider.
- Codex is the only currently proven complete source. Its newest `token_count` record contains the exact model context plus real primary `300` minute and secondary `10,080` minute windows, used percentages, and reset epochs.
- Antigravity/Gemini transcripts contain real token events and timestamps but no observed model identity or quota/reset data in the inspected records.
- Claude has plugin metadata but no local conversation/session telemetry on this machine.
- OpenCode/OpenRouter local telemetry storage was not found.
- Gemini quota values/countdowns and all OpenCode values are simulated. Claude is advertised but not implemented.
- Auto mode rotates providers instead of selecting the freshest genuine event.
- Percentage colors are reversed for a remaining-value meter: `90% left` currently becomes red.
- The provider selector looks manually authoritative even when the value is stale or inferred.
- Theme 5 firmware uses different geometry and fills than the web preview. The physical clock/AM-PM/sun strip collide, the gray table dominates the screen, and the sunset value comes from the stale weather fallback instead of the prayer Maghrib value.

## Telemetry Rules

### Provider adapters

Each adapter returns either a verified observation or no observation. It must never synthesize a provider, model, quota percentage, or reset time.

- **Codex:** read the newest valid local rollout event. Extract the latest `turn_context.model`, token usage, model context window, rate-limit window minutes, used percentage, and reset epoch.
- **Antigravity/Gemini:** read actual transcript events for activity and token usage. Model and quota fields remain unavailable until a real local source containing those values is found.
- **Claude:** inspect real Claude session records only when they exist. With the currently observed plugin-only directory, return unavailable.
- **OpenCode/OpenRouter:** inspect a documented local session or usage source only when it exists. With no source currently present, return unavailable.
- **ChatGPT desktop:** a running process proves only that the app is open. It does not prove the active conversation model or quota and must not be presented as model telemetry.

### Active-provider selection

Auto mode will not rotate.

1. Parse all available adapters.
2. Use the timestamp of the latest genuine provider event, not a fabricated timer.
3. Select the freshest provider only when its event is within the active threshold.
4. If no provider is active, publish a disconnected observation rather than the last provider as if it were live.
5. CLI `--mode` remains a diagnostic override, but the normal launcher uses `auto`.

### Backward-compatible device contract

Keep the existing flat `/api/tokens` fields to limit ESP8266 RAM usage and add:

- `telemetryState`: `live`, `stale`, or `unavailable`
- `sourceLabel`: human-readable local source
- `observedAt`: source event epoch
- `sessionWindowMinutes` and `weeklyWindowMinutes`
- `sessionPct` / `weeklyPct`: nullable remaining percentages
- `sessionResetAt` / `weeklyResetAt`: nullable reset epochs

Existing labels/text remain for rendering compatibility, but the companion derives them only from real window metadata. The device accepts null/unavailable values and never turns them into zero-percent usage.

## Limit Meaning and Colors

Context usage and rate limits are separate:

- Context: `used tokens / model context window`
- Rate limit: `remaining percent`, window duration, and reset countdown

Window names are generated from source metadata: `300` minutes becomes `5-HOUR LIMIT`; `10,080` minutes becomes `7-DAY LIMIT`. Unknown windows use `RATE LIMIT`, not a guessed duration.

Remaining-capacity colors on web and ST7789:

- `75–100%`: green
- `40–74%`: yellow
- `15–39%`: orange
- `0–14%`: red
- unavailable: muted gray/cyan, with no filled meter

## Connected and Disconnected UI

The provider/model control becomes a read-only detected-source card:

- Provider/product
- Exact observed model, or `Model unavailable`
- `LIVE`, `STALE`, or `CONNECT PROVIDER`
- Source and last-seen age

Remove the prominent generated curl command from the normal panel; keep it only in an advanced diagnostic disclosure if still useful.

When no fresh provider exists:

- Web: an orbiting three-node connection animation around a central link glyph, with `Connect provider` and a short companion command hint.
- ST7789: a non-blocking three-dot orbit/pulse driven by `millis()`, with `CONNECT PROVIDER` and `RUN COMPANION`.
- No provider logo, model, percentage, reset time, or fake progress bar is shown.

The requested `kinetics-animation` skill is unavailable in this environment, so the animation will reuse the repository's existing CSS keyframe and firmware frame-loop patterns without adding a dependency.

## Theme 5 Physical/Web Parity

Both renderers use one explicit 240×240 layout map:

- Header: location/date and online state
- Hero: shuttle on the left; clock and AM/PM on the right, with reserved non-overlapping bounds
- Sun strip: sunrise and prayer-cache Maghrib sunset
- Prayer table: black background, subtle separators, fixed three-column alignment, one dark amber outlined upcoming row
- Countdown: compact bottom card with unclipped next-prayer text and timer

Firmware animation redraws only bounded regions for the shuttle plume, colon, and countdown. It must not clear the full screen each second. Prayer calculations remain based on 24-hour internal values and render according to the configured 12/24-hour format.

## OTA and Factory Reset

- Normal OTA preserves LittleFS settings so routine firmware upgrades do not require Wi-Fi reconnection.
- Add `POST /api/system/reset` on firmware. It removes `/config.json`, returns success, and reboots.
- Add a clearly destructive `Erase settings & reconnect` System-page button with a confirmation explaining that Wi-Fi access will be lost and the device will return to `SmallTV-Setup`.
- Do not automatically erase the entire filesystem during OTA.

## Runtime and Process Hygiene

- The normal device companion starts once in `auto` mode.
- Prevent or report duplicate companions targeting the same device.
- The localhost development companion remains separate and cannot affect the physical device.
- On shutdown or missing updates, the device changes to stale/unavailable after the configured freshness timeout.

## Verification

- Python fixtures for every adapter, provider selection, stale/unavailable handling, real window-label derivation, and no fabricated fallback.
- Node tests for remaining-color thresholds, disconnected markup, read-only source display, and unavailable meters.
- Mock API contract tests for nullable telemetry and reset behavior.
- PlatformIO build and binary validation.
- Browser comparison at a 240×240 viewport against the firmware coordinate map.
- After explicit user approval to flash: verify version, factory-reset behavior, provider freshness, Theme 5 layout, and disconnected animation on physical hardware.

## Out of Scope

- Scraping private provider web pages or browser sessions.
- Guessing quota data from token totals.
- Claiming ChatGPT subscription usage from Codex CLI records.
- Adding cloud credentials merely to populate the display.
