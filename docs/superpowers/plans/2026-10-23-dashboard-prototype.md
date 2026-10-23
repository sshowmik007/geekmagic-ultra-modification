# SmallTV Dashboard Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, mock-only local browser prototype for a clearer SmallTV-Ultra control dashboard.

**Architecture:** The prototype is a static HTML page with Tailwind-generated CSS. A small state module holds sample-only data and pure state transitions, while a browser module renders the selected page and handles non-persistent mock actions. It has no device URL, API client, firmware code, or real form submission.

**Tech Stack:** HTML5, Tailwind CSS v4 CLI, vanilla JavaScript ES modules, Node.js built-in test runner.

**Spec:** `smalltv-dashboard/docs/superpowers/specs/2026-10-23-dashboard-prototype-design.md`

## Global Constraints

- All new work stays under `smalltv-dashboard/`; do not edit either reference repository.
- Use mock data only. Do not include `192.168.0.198`, `fetch`, `XMLHttpRequest`, firmware uploads, Wi-Fi scans, or device-side actions.
- Use one light, warm monochrome theme, one muted blue accent, 8px radii, one-pixel borders, and no gradients or heavy shadows.
- All input controls require visible labels, keyboard focus styles, and readable text contrast.
- Respect `prefers-reduced-motion` by disabling entrance animations.
- Use plain, specific copy. Label sample data clearly.
- The workspace is not a Git repository, so omit commit steps until the user initializes one.

---

## File structure

```text
smalltv-dashboard/
  index.html                         # Semantic prototype layout and controls
  package.json                       # Local build/test scripts and Tailwind CLI dependencies
  src/
    input.css                        # Tailwind import and project-level component styles
    state.js                         # Sample-only dashboard data and pure state transitions
    main.js                          # DOM rendering and event wiring
  test/
    state.test.js                    # Node tests for safe mock state behavior
  docs/superpowers/
    specs/2026-10-23-dashboard-prototype-design.md
    plans/2026-10-23-dashboard-prototype.md
```

### Task 1: Establish the static prototype build

**Files:**

- Create: `smalltv-dashboard/package.json`
- Create: `smalltv-dashboard/src/input.css`
- Create: `smalltv-dashboard/index.html`

**Interfaces:**

- Produces: `npm run build`, which writes `dist/styles.css` from `src/input.css` and the HTML class scan.
- Produces: `#app` in `index.html`, which Task 3 populates.

- [ ] **Step 1: Create the package manifest with only Tailwind tooling**

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "build": "npx @tailwindcss/cli -i ./src/input.css -o ./dist/styles.css --minify",
    "dev": "npx @tailwindcss/cli -i ./src/input.css -o ./dist/styles.css --watch",
    "test": "node --test"
  },
  "devDependencies": {
    "@tailwindcss/cli": "^4.1.0",
    "tailwindcss": "^4.1.0"
  }
}
```

- [ ] **Step 2: Install the locked local development dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and no application framework is installed.

- [ ] **Step 3: Add the Tailwind entry stylesheet**

```css
@import "tailwindcss";

@theme {
  --color-canvas: #f7f6f3;
  --color-ink: #2f3437;
  --color-muted: #787774;
  --color-line: #eaeaea;
  --color-accent: #1f6c9f;
  --radius-panel: 8px;
}

@layer base {
  :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
}
```

- [ ] **Step 4: Add the minimal semantic document shell**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SmallTV Dashboard Prototype</title>
    <link rel="stylesheet" href="./dist/styles.css" />
  </head>
  <body class="bg-canvas text-ink">
    <main id="app" aria-live="polite"></main>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Build the stylesheet**

Run: `npm run build`

Expected: `dist/styles.css` exists and has no CDN dependency.

### Task 2: Create mock state with unit coverage

**Files:**

- Create: `smalltv-dashboard/src/state.js`
- Create: `smalltv-dashboard/test/state.test.js`

**Interfaces:**

- Produces: `createInitialState(): DashboardState`.
- Produces: `reduce(state: DashboardState, action: { type: "navigate"; page: PageId } | { type: "set-brightness"; value: number }): DashboardState`.
- Consumed by: `src/main.js` in Task 3.

- [ ] **Step 1: Write the failing state tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reduce } from "../src/state.js";

test("initial state is sample-only and starts on Overview", () => {
  const state = createInitialState();
  assert.equal(state.page, "overview");
  assert.equal(state.device.isSample, true);
});

test("brightness is clamped to the supported UI range", () => {
  const state = createInitialState();
  assert.equal(reduce(state, { type: "set-brightness", value: 120 }).display.brightness, 100);
  assert.equal(reduce(state, { type: "set-brightness", value: -1 }).display.brightness, 0);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`

Expected: FAIL because `src/state.js` does not yet exist.

- [ ] **Step 3: Implement the pure state module**

```js
export function createInitialState() {
  return {
    page: "overview",
    device: { isSample: true, model: "SmallTV-Ultra", firmware: "Sample v9.0.51" },
    display: { theme: "Weather Clock Today", brightness: 65, autoSwitch: false },
    time: { mode: "Automatic", timezone: "Asia/Dhaka", ntp: "pool.ntp.org" },
    network: { ssid: "Sample network", status: "Connected" },
    media: { autoDisplay: false, intervalMinutes: 15 },
  };
}

export function reduce(state, action) {
  if (action.type === "navigate") return { ...state, page: action.page };
  if (action.type === "set-brightness") return { ...state, display: { ...state.display, brightness: Math.max(0, Math.min(100, Number(action.value))) } };
  return state;
}
```

- [ ] **Step 4: Run unit tests**

Run: `npm test`

Expected: PASS with both tests passing.

### Task 3: Render the overview and navigation

**Files:**

- Create: `smalltv-dashboard/src/main.js`
- Modify: `smalltv-dashboard/src/input.css`

**Interfaces:**

- Consumes: `createInitialState` and `reduce` from `./state.js`.
- Produces: a navigation control for Overview, Display, Time, Network, Media, and System, plus a sample-only overview page.

- [ ] **Step 1: Write the initial DOM contract as static markup in `index.html` for review**

```html
<main id="app">
  <nav aria-label="Dashboard sections"></nav>
  <section aria-labelledby="page-title"></section>
</main>
```

- [ ] **Step 2: Implement the render function and event delegation**

```js
import { createInitialState, reduce } from "./state.js";

let state = createInitialState();
const app = document.querySelector("#app");

function render() {
  const pageTitle = state.page[0].toUpperCase() + state.page.slice(1);
  app.innerHTML = `
    <div class="min-h-[100dvh] p-4 md:grid md:grid-cols-[15rem_1fr] md:gap-6 md:p-6">
      <nav aria-label="Dashboard sections" class="border border-line bg-white p-4">
        <p class="font-mono text-xs text-muted">SmallTV · Sample data only</p>
        ${["overview", "display", "time", "network", "media", "system"].map((page) => `
          <button type="button" data-page="${page}" aria-current="${state.page === page ? "page" : "false"}">
            ${page[0].toUpperCase() + page.slice(1)}
          </button>`).join("")}
      </nav>
      <section aria-labelledby="page-title" class="border border-line bg-white p-6">
        <p class="font-mono text-xs text-muted">Sample data only</p>
        <h1 id="page-title">${pageTitle}</h1>
        <dl>
          <dt>Model</dt><dd>${state.device.model}</dd>
          <dt>Firmware</dt><dd>${state.device.firmware}</dd>
          <dt>Connection</dt><dd>${state.network.status}</dd>
          <dt>Theme</dt><dd>${state.display.theme}</dd>
          <dt>Brightness</dt><dd>${state.display.brightness}%</dd>
          <dt>Time zone</dt><dd>${state.time.timezone}</dd>
          <dt>NTP</dt><dd>${state.time.ntp}</dd>
          <dt>Media</dt><dd>${state.media.autoDisplay ? "Auto display on" : "Auto display off"}</dd>
        </dl>
        ${state.page === "system" ? `
          <button type="button" disabled>Reset unavailable in prototype</button>
          <button type="button" disabled>Reboot unavailable in prototype</button>` : ""}
      </section>
    </div>`;
}

app.addEventListener("click", (event) => {
  const page = event.target.closest("[data-page]")?.dataset.page;
  if (page) state = reduce(state, { type: "navigate", page });
  render();
});

render();
```

The rendered Overview must show model, sample firmware, connection status, selected theme, brightness, time zone, NTP host, media status, and a visible “Sample data only” notice. Use native `button`, `input`, `label`, `section`, `nav`, and heading elements. The System page must show Reset and Reboot as disabled buttons with explanatory text.

- [ ] **Step 3: Add component styling to `src/input.css`**

Implement one-column mobile and sidebar-plus-main desktop layout at `768px`. Apply `border: 1px solid #eaeaea`, 8px panel corners, no gradients, and no heavy shadows. Add an opacity/transform entrance within `@media (prefers-reduced-motion: no-preference)` and a reduced-motion override that leaves content visible at rest.

- [ ] **Step 4: Build and smoke-test the browser page**

Run: `npm run build`

Open: `smalltv-dashboard/index.html`

Expected: all six navigation choices switch the visible page locally; no page makes a network request; Reset and Reboot cannot be activated.

### Task 4: Add controlled mock interactions and complete verification

**Files:**

- Modify: `smalltv-dashboard/src/main.js`
- Modify: `smalltv-dashboard/src/input.css`
- Modify: `smalltv-dashboard/test/state.test.js`

**Interfaces:**

- Consumes: the reducer action types from Task 2 and adds the `toggle-auto-switch` action.
- Produces: local-only brightness and auto-switch controls with visible sample-state updates.

- [ ] **Step 1: Add failing reducer tests for the remaining mock interaction**

```js
test("auto-switch changes only local display state", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "toggle-auto-switch" });
  assert.equal(next.display.autoSwitch, true);
  assert.equal(state.display.autoSwitch, false);
});
```

- [ ] **Step 2: Run the test and confirm it fails if the transition is missing**

Run: `npm test`

Expected: FAIL only when `toggle-auto-switch` is absent or mutates the prior state.

- [ ] **Step 3: Wire the controls to reducer actions**

Use an `input[type="range"]` with a visible `label` for brightness and a labelled checkbox for automatic theme switching. On `input` or `change`, dispatch the appropriate reducer action and re-render only the local mock state. Do not add save buttons because no state is persistent.

Add the following reducer branch before the final fallback:

```js
if (action.type === "toggle-auto-switch") {
  return { ...state, display: { ...state.display, autoSwitch: !state.display.autoSwitch } };
}
```

- [ ] **Step 4: Run the automated checks**

Run: `npm test; npm run build`

Expected: all state tests pass and `dist/styles.css` is generated.

- [ ] **Step 5: Perform the manual browser check**

Check desktop width and a narrow viewport. Confirm navigation is keyboard reachable, the current page is apparent, focus is visible, labels remain associated with controls, reduced motion removes the entrance animation, and browser developer tools show no request to a device address.

## Plan self-review

- Spec coverage: Tasks 1-4 cover the local-only directory boundary, static Tailwind output, sample state, overview content, all six named navigation sections, safe disabled system actions, accessibility, reduced motion, and local verification.
- No placeholders: All planned file paths, commands, state shape, test cases, and required DOM structure are concrete.
- Type consistency: Task 2 defines `createInitialState` and `reduce`; Tasks 3 and 4 consume those exact exports and action names.
