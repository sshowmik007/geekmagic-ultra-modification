import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../src/main.js";
import { createInitialState, reduce } from "../src/state.js";

test("initial state identifies its device data as sample data", () => {
  const state = createInitialState();

  assert.equal(state.page, "overview");
  assert.equal(state.device.isSample, true);
});

test("brightness stays within the visible 0 to 100 range", () => {
  const state = createInitialState();

  assert.equal(reduce(state, { type: "set-brightness", value: 120 }).display.brightness, 100);
  assert.equal(reduce(state, { type: "set-brightness", value: -1 }).display.brightness, 0);
});

test("navigation changes only the visible prototype page", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "navigate", page: "network" });

  assert.equal(next.page, "network");
  assert.equal(next.device, state.device);
});

test("automatic theme switching changes only local display state", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "toggle-auto-switch" });

  assert.equal(next.display.autoSwitch, true);
  assert.equal(state.display.autoSwitch, false);
});

test("display page exposes labelled local-only controls", () => {
  const state = reduce(createInitialState(), { type: "navigate", page: "display" });
  const markup = renderDashboard(state);

  assert.match(markup, /for="brightness"/);
  assert.match(markup, /id="brightness"/);
  assert.match(markup, /for="auto-switch"/);
  assert.match(markup, /id="auto-switch"/);
});

test("system page exposes live firmware upload form and reboot controls", () => {
  const state = reduce(createInitialState(), { type: "navigate", page: "system" });
  const markup = renderDashboard(state);

  assert.match(markup, /action="\/update"/);
  assert.match(markup, /name="firmware"/);
  assert.match(markup, /Reboot Device/);
});

test("selecting a theme updates display theme", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "set-theme", theme: "Photo Album" });

  assert.equal(next.display.theme, "Photo Album");
});

test("updating clock digit colors changes color state", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "set-clock-color", colorKey: "hour", value: "#ff0055" });

  assert.equal(next.time.colors.hour, "#ff0055");
});

test("selecting a Wi-Fi network updates ssid and notification", () => {
  const state = createInitialState();
  const next = reduce(state, { type: "select-wifi", ssid: "Ovi's 2.4" });

  assert.equal(next.network.ssid, "Ovi's 2.4");
  assert.match(next.notification, /Ovi's 2.4/);
});
