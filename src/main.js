import { createInitialState, reduce } from "./state.js";
import { api } from "./api.js";

const pages = ["overview", "display", "weather", "time", "network", "media", "system"];

const themes = [
  "Weather Clock Today",
  "Weather Forecast",
  "Photo Album",
  "Time Style 1",
  "Time Style 2",
  "Time Style 3",
  "Simple Weather Clock",
];

function titleFor(page) {
  return page[0].toUpperCase() + page.slice(1);
}

function renderClockDigits(colors, hourFormat, colonBlink) {
  const d = new Date();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  if (hourFormat === "12-Hour") {
    hours = hours % 12 || 12;
  }
  const hh = String(hours).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return `
    <div class="clock-preview-box">
      <span class="clock-digits" style="color: ${colors.hour}">${hh}</span>
      <span class="clock-colon ${colonBlink ? "blink" : ""}" style="color: ${colors.minute}">:</span>
      <span class="clock-digits" style="color: ${colors.minute}">${mm}</span>
      <span class="clock-colon ${colonBlink ? "blink" : ""}" style="color: ${colors.second}">:</span>
      <span class="clock-digits" style="color: ${colors.second}">${ss}</span>
      ${hourFormat === "12-Hour" ? `<span class="clock-ampm">${ampm}</span>` : ""}
    </div>
  `;
}

function overviewContent(state) {
  return `
    <div class="metric-grid">
      <article class="metric-card metric-card-wide">
        <p class="metric-label">Display Theme</p>
        <p class="metric-value">${state.display.theme}</p>
        <p class="metric-detail">Brightness ${state.display.brightness}% · Night Mode ${state.display.nightMode.enabled ? "Active" : "Off"}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Connection</p>
        <p class="metric-value">${state.network.status}</p>
        <p class="metric-detail">${state.network.ssid} (${state.network.signal}%) · ${state.device.ip}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Time & Zone</p>
        <p class="metric-value">${state.time.mode}</p>
        <p class="metric-detail">${state.time.timezone} · ${state.time.hourFormat}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Weather Location</p>
        <p class="metric-value">${state.weather.city}</p>
        <p class="metric-detail">${state.weather.tempUnit} · Every ${state.weather.updateInterval}m</p>
      </article>
    </div>

    <section class="details-panel" aria-labelledby="clock-preview-title">
      <div>
        <p class="section-kicker">Live Screen Simulation</p>
        <h2 id="clock-preview-title">ST7789 Display Preview (240×240px)</h2>
        <p class="section-subtitle">Real-time simulation using your configured time styles and colors.</p>
      </div>
      <div class="screen-frame">
        <div class="screen-inner">
          <div class="screen-top-bar">
            <span>${state.weather.city} 28${state.weather.tempUnit}</span>
            <span>📶 ${state.network.signal}%</span>
          </div>
          ${renderClockDigits(state.time.colors, state.time.hourFormat, state.time.colonBlink)}
          <div class="screen-bottom-bar">
            <span>${state.time.dateFormat}</span>
            <span>${state.display.theme}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="details-panel" aria-labelledby="device-summary-title">
      <div>
        <p class="section-kicker">Device summary</p>
        <h2 id="device-summary-title">Hardware & Firmware Telemetry</h2>
      </div>
      <dl class="details-list">
        <div><dt>Model</dt><dd>${state.device.model}</dd></div>
        <div><dt>Firmware</dt><dd>${state.device.firmware}</dd></div>
        <div><dt>SoC / MCU</dt><dd>${state.device.chip}</dd></div>
        <div><dt>Flash Memory</dt><dd>${state.device.flashSize}</dd></div>
        <div><dt>Free Heap RAM</dt><dd>${state.device.freeHeap}</dd></div>
        <div><dt>Device Uptime</dt><dd>${state.device.uptime}</dd></div>
        <div><dt>IP Address</dt><dd><code>${state.device.ip}</code></dd></div>
        <div><dt>MAC Address</dt><dd><code>${state.device.mac}</code></dd></div>
      </dl>
    </section>`;
}

function displayContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Display Themes</p>
        <h2>Select Screen Theme</h2>
        <p class="section-subtitle">Choose the default theme displayed on the 1.54" ST7789 IPS display.</p>
      </div>
      <div class="theme-grid">
        ${themes.map((t) => {
          const isCurrent = state.display.theme === t;
          return `
            <button type="button" class="theme-card ${isCurrent ? "is-selected" : ""}" data-action="select-theme" data-theme="${t}">
              <div class="theme-card-indicator"></div>
              <div class="theme-card-info">
                <span class="theme-name">${t}</span>
                <span class="theme-meta">${isCurrent ? "Active on screen" : "Click to activate"}</span>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Backlight & Brightness</p>
        <h2>Brightness Controls</h2>
      </div>
      <div class="control-stack">
        <label for="brightness">Day Brightness <output for="brightness" class="tag-badge">${state.display.brightness}%</output></label>
        <input id="brightness" name="brightness" type="range" min="0" max="100" value="${state.display.brightness}" class="slider" />
        
        <label class="check-control" for="auto-switch">
          <input id="auto-switch" name="auto-switch" type="checkbox"${state.display.autoSwitch ? " checked" : ""} />
          <span>Rotate display themes automatically</span>
        </label>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Scheduled Dimming</p>
        <h2>Night Mode</h2>
        <p class="section-subtitle">Automatically dims the screen at night to prevent glare.</p>
      </div>
      <div class="control-stack">
        <label class="check-control" for="night-mode-toggle">
          <input id="night-mode-toggle" type="checkbox"${state.display.nightMode.enabled ? " checked" : ""} />
          <span>Enable night mode schedule</span>
        </label>
        <div class="input-grid">
          <div>
            <label for="night-start">Start Time</label>
            <input id="night-start" type="time" value="${state.display.nightMode.startTime}" class="text-input" />
          </div>
          <div>
            <label for="night-end">End Time</label>
            <input id="night-end" type="time" value="${state.display.nightMode.endTime}" class="text-input" />
          </div>
          <div>
            <label for="night-brightness">Night Brightness (${state.display.nightMode.brightness}%)</label>
            <input id="night-brightness" type="range" min="0" max="100" value="${state.display.nightMode.brightness}" class="slider" />
          </div>
        </div>
      </div>
    </section>`;
}

function weatherContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Weather Location</p>
        <h2>City & Region</h2>
        <p class="section-subtitle">Location used for OpenWeatherMap polling.</p>
      </div>
      <div class="input-grid">
        <div>
          <label for="weather-city">City Name</label>
          <input id="weather-city" type="text" value="${state.weather.city}" class="text-input" />
        </div>
        <div>
          <label for="weather-city-id">City ID (Optional)</label>
          <input id="weather-city-id" type="text" value="${state.weather.cityId}" class="text-input" />
        </div>
        <div>
          <label for="weather-interval">Update Interval (Minutes)</label>
          <input id="weather-interval" type="number" min="5" max="180" value="${state.weather.updateInterval}" class="text-input" />
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Measurement Units</p>
        <h2>Format Preferences</h2>
      </div>
      <div class="input-grid">
        <div>
          <label for="unit-temp">Temperature</label>
          <select id="unit-temp" class="select-input">
            <option value="°C"${state.weather.tempUnit === "°C" ? " selected" : ""}>Celsius (°C)</option>
            <option value="°F"${state.weather.tempUnit === "°F" ? " selected" : ""}>Fahrenheit (°F)</option>
          </select>
        </div>
        <div>
          <label for="unit-wind">Wind Speed</label>
          <select id="unit-wind" class="select-input">
            <option value="m/s"${state.weather.windSpeedUnit === "m/s" ? " selected" : ""}>Meters/second (m/s)</option>
            <option value="km/h"${state.weather.windSpeedUnit === "km/h" ? " selected" : ""}>Kilometers/hour (km/h)</option>
            <option value="mph"${state.weather.windSpeedUnit === "mph" ? " selected" : ""}>Miles/hour (mph)</option>
          </select>
        </div>
        <div>
          <label for="unit-pressure">Atmospheric Pressure</label>
          <select id="unit-pressure" class="select-input">
            <option value="hPa"${state.weather.pressureUnit === "hPa" ? " selected" : ""}>hPa</option>
            <option value="kPa"${state.weather.pressureUnit === "kPa" ? " selected" : ""}>kPa</option>
            <option value="mmHg"${state.weather.pressureUnit === "mmHg" ? " selected" : ""}>mmHg</option>
          </select>
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">API Access Keys</p>
        <h2>OpenWeatherMap Integration</h2>
        <p class="section-subtitle">Using your own free API key avoids shared quota limits.</p>
      </div>
      <div class="input-grid">
        <div class="col-span-2">
          <label for="weather-api-key">Weather API Key</label>
          <input id="weather-api-key" type="password" value="${state.weather.apiKey}" class="text-input font-mono" />
        </div>
        <div class="col-span-2">
          <label for="forecast-api-key">Forecast API Key (Optional)</label>
          <input id="forecast-api-key" type="password" placeholder="Leave empty to use standard API" value="${state.weather.forecastApiKey}" class="text-input font-mono" />
        </div>
      </div>
    </section>`;
}

function timeContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Live Color Preview</p>
        <h2>Digit Colors & Style</h2>
        <p class="section-subtitle">Change individual segment colors for Hours, Minutes, and Seconds.</p>
      </div>
      
      <div class="screen-frame my-4">
        <div class="screen-inner">
          ${renderClockDigits(state.time.colors, state.time.hourFormat, state.time.colonBlink)}
        </div>
      </div>

      <div class="input-grid">
        <div>
          <label for="color-hour">Hour Color</label>
          <div class="color-picker-wrap">
            <input id="color-hour" type="color" value="${state.time.colors.hour}" data-color="hour" class="color-input" />
            <span class="color-hex">${state.time.colors.hour}</span>
          </div>
        </div>
        <div>
          <label for="color-minute">Minute Color</label>
          <div class="color-picker-wrap">
            <input id="color-minute" type="color" value="${state.time.colors.minute}" data-color="minute" class="color-input" />
            <span class="color-hex">${state.time.colors.minute}</span>
          </div>
        </div>
        <div>
          <label for="color-second">Second Color</label>
          <div class="color-picker-wrap">
            <input id="color-second" type="color" value="${state.time.colors.second}" data-color="second" class="color-input" />
            <span class="color-hex">${state.time.colors.second}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Time Synchronization</p>
        <h2>Timezone & NTP</h2>
      </div>
      <div class="input-grid">
        <div>
          <label for="time-format">Hour Format</label>
          <select id="time-format" class="select-input" data-timefield="hourFormat">
            <option value="24-Hour"${state.time.hourFormat === "24-Hour" ? " selected" : ""}>24-Hour (18:30:00)</option>
            <option value="12-Hour"${state.time.hourFormat === "12-Hour" ? " selected" : ""}>12-Hour (06:30:00 PM)</option>
          </select>
        </div>
        <div>
          <label for="date-format">Date Format</label>
          <select id="date-format" class="select-input" data-timefield="dateFormat">
            <option value="DD/MM/YYYY"${state.time.dateFormat === "DD/MM/YYYY" ? " selected" : ""}>DD/MM/YYYY</option>
            <option value="YYYY/MM/DD"${state.time.dateFormat === "YYYY/MM/DD" ? " selected" : ""}>YYYY/MM/DD</option>
            <option value="MM/DD/YYYY"${state.time.dateFormat === "MM/DD/YYYY" ? " selected" : ""}>MM/DD/YYYY</option>
          </select>
        </div>
        <div>
          <label for="font-style">Time Font</label>
          <select id="font-style" class="select-input" data-timefield="fontStyle">
            <option value="Default Big Font"${state.time.fontStyle === "Default Big Font" ? " selected" : ""}>Default Big Font</option>
            <option value="Digital Font"${state.time.fontStyle === "Digital Font" ? " selected" : ""}>Digital Font</option>
          </select>
        </div>
        <div class="col-span-2">
          <label for="ntp-server">NTP Server Address</label>
          <input id="ntp-server" type="text" value="${state.time.ntp}" class="text-input font-mono" />
        </div>
      </div>
    </section>`;
}

function networkContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Wi-Fi Connection</p>
        <h2>Available 2.4 GHz Networks</h2>
        <p class="section-subtitle">Click any discovered network below to auto-populate the SSID.</p>
      </div>
      
      <div class="wifi-table-wrap">
        <table class="wifi-table">
          <thead>
            <tr>
              <th>Network SSID</th>
              <th>Signal</th>
              <th>Security</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${state.network.scannedNetworks.map((net) => {
              const isCurrent = state.network.ssid === net.ssid;
              return `
                <tr class="${isCurrent ? "is-connected-row" : ""}">
                  <td>
                    <strong>${net.ssid}</strong>
                    ${isCurrent ? `<span class="tag-badge">Current</span>` : ""}
                  </td>
                  <td>${net.signal} (${net.rssi}%)</td>
                  <td>${net.security}</td>
                  <td>
                    <button type="button" class="btn-sm" data-action="select-wifi" data-ssid="${net.ssid}">
                      ${isCurrent ? "Connected" : "Select"}
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Credentials</p>
        <h2>Connect to Network</h2>
      </div>
      <div class="input-grid">
        <div>
          <label for="wifi-ssid">Network SSID</label>
          <input id="wifi-ssid" type="text" value="${state.network.ssid}" class="text-input" />
        </div>
        <div>
          <label for="wifi-pass">Wi-Fi Password</label>
          <input id="wifi-pass" type="password" placeholder="••••••••••••" class="text-input" />
        </div>
        <div>
          <label for="boot-delay">Boot Delay (Seconds)</label>
          <input id="boot-delay" type="number" min="0" max="60" value="${state.network.bootDelay}" class="text-input" />
        </div>
      </div>
    </section>`;
}

function mediaContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Slideshow Settings</p>
        <h2>Photo Album Mode</h2>
      </div>
      <div class="control-stack">
        <label class="check-control" for="media-auto">
          <input id="media-auto" type="checkbox"${state.media.autoDisplay ? " checked" : ""} />
          <span>Enable image auto-display slideshow</span>
        </label>
        <div>
          <label for="media-interval">Display Interval: ${state.media.intervalSeconds}s</label>
          <input id="media-interval" type="range" min="5" max="120" value="${state.media.intervalSeconds}" class="slider" />
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Storage (LittleFS)</p>
        <h2>Uploaded Images & GIFs (240×240px)</h2>
        <p class="section-subtitle">Images stored in flash filesystem for the Photo Album theme.</p>
      </div>

      <div class="file-grid">
        ${state.media.files.map((file) => `
          <div class="file-card">
            <div class="file-thumb">🖼️</div>
            <div class="file-info">
              <span class="file-name">${file.name}</span>
              <span class="file-meta">${file.size} · ${file.type}</span>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="dropzone">
        <p><strong>Drag & drop 240×240 JPG or GIF</strong> or click to browse</p>
        <span class="dropzone-hint">(Upload is disabled in local prototype mode)</span>
      </div>
    </section>`;
}

function systemContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">OTA Update</p>
        <h2>Firmware Upgrade</h2>
        <p class="section-subtitle">Flash compiled <code>.bin</code> firmware images over Wi-Fi.</p>
      </div>
      <div class="ota-box">
        <div class="ota-info">
          <p><strong>Current Version:</strong> ${state.device.firmware}</p>
          <p><strong>Target Hardware:</strong> ${state.device.model} (${state.device.chip})</p>
          <p class="text-sm text-muted">Upload binary compiled for ESP8266 + ST7789 display.</p>
        </div>
        <div class="file-upload-mock">
          <input type="file" id="firmware-file" accept=".bin" disabled class="file-input" />
          <button type="button" disabled class="btn-disabled">Upload .bin (Disabled in Prototype)</button>
        </div>
      </div>
    </section>

    <section class="details-panel system-panel">
      <div>
        <p class="section-kicker">Protected Controls</p>
        <h2>Reboot & Factory Reset</h2>
        <p class="section-subtitle">Potentially destructive hardware operations are safely locked in prototype mode.</p>
      </div>
      <div class="button-row">
        <button type="button" class="btn-danger-outline" disabled data-action="mock-dialog" data-msg="Reboot action is simulated in prototype mode.">
          Reboot unavailable in prototype
        </button>
        <button type="button" class="btn-danger-outline" disabled data-action="mock-dialog" data-msg="Factory reset action is simulated in prototype mode.">
          Reset unavailable in prototype
        </button>
      </div>
    </section>`;
}

function pageContent(state) {
  if (state.page === "overview") return overviewContent(state);
  if (state.page === "display") return displayContent(state);
  if (state.page === "weather") return weatherContent(state);
  if (state.page === "time") return timeContent(state);
  if (state.page === "network") return networkContent(state);
  if (state.page === "media") return mediaContent(state);
  if (state.page === "system") return systemContent(state);
  return overviewContent(state);
}

export function renderDashboard(state) {
  const pageTitle = titleFor(state.page);

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="wordmark" href="#app" aria-label="SmallTV dashboard home">SmallTV<span>control</span></a>
        <nav aria-label="Dashboard sections" class="nav-list">
          ${pages.map((page) => {
            const active = state.page === page;
            return `<button class="nav-link${active ? " is-active" : ""}" type="button" data-page="${page}"${active ? ' aria-current="page"' : ""}>${titleFor(page)}</button>`;
          }).join("")}
        </nav>
        <div class="sidebar-status-box">
          <p class="sidebar-note"><strong>SmallTV-Ultra</strong><br />IP: ${state.device.ip}<br />RAM: ${state.device.freeHeap}</p>
        </div>
      </aside>
      <main class="content" id="main-content">
        <header class="page-header">
          <div>
            <p class="section-kicker">GeekMagic SmallTV-Ultra</p>
            <h1 id="page-title">${pageTitle}</h1>
          </div>
          <div class="header-badges">
            ${state.notification ? `<span class="notification-toast">${state.notification}</span>` : ""}
            <span class="sample-badge">Sample data only</span>
          </div>
        </header>
        ${pageContent(state)}
      </main>
    </div>`;
}

if (typeof document !== "undefined") {
  let state = createInitialState();
  const app = document.querySelector("#app");

  let saveTimeout = null;
  function triggerSave() {
    clearTimeout(saveTimeout);
    state = reduce(state, { type: "set-notification", message: "Saving to flash..." });
    render();
    saveTimeout = setTimeout(async () => {
      const res = await api.saveSettings({
        display: state.display,
        weather: state.weather,
        time: state.time,
        network: state.network,
      });
      state = reduce(state, {
        type: "set-notification",
        message: res.success ? (api.isLiveServer ? "✓ Saved to flash" : "✓ Saved (Offline)") : "Error saving",
      });
      render();
      setTimeout(() => {
        state = reduce(state, { type: "set-notification", message: null });
        render();
      }, 2500);
    }, 400);
  }

  function render() {
    app.innerHTML = renderDashboard(state);
  }

  // Initial sync with live server if available
  if (api.isLiveServer) {
    (async () => {
      const [remoteStatus, remoteSettings] = await Promise.all([
        api.getStatus(),
        api.getSettings(),
      ]);
      if (remoteStatus) {
        state = {
          ...state,
          device: { ...state.device, ...remoteStatus },
        };
      }
      if (remoteSettings) {
        state = {
          ...state,
          display: { ...state.display, ...remoteSettings.display },
          weather: { ...state.weather, ...remoteSettings.weather },
          time: { ...state.time, ...remoteSettings.time },
          network: { ...state.network, ...remoteSettings.network },
        };
      }
      render();
    })();
  }

  app.addEventListener("click", (event) => {
    const page = event.target.closest("[data-page]")?.dataset.page;
    if (page) {
      state = reduce(state, { type: "navigate", page });
      render();
      return;
    }

    const themeBtn = event.target.closest("[data-action='select-theme']");
    if (themeBtn) {
      state = reduce(state, { type: "set-theme", theme: themeBtn.dataset.theme });
      render();
      triggerSave();
      return;
    }

    const wifiBtn = event.target.closest("[data-action='select-wifi']");
    if (wifiBtn) {
      const ssid = wifiBtn.dataset.ssid;
      state = reduce(state, { type: "select-wifi", ssid });
      render();
      api.connectWifi(ssid, "", state.network.bootDelay).then((res) => {
        state = reduce(state, {
          type: "set-notification",
          message: res.message || `Connected to ${ssid}`,
        });
        render();
      });
      return;
    }

    const dialogBtn = event.target.closest("[data-action='mock-dialog']");
    if (dialogBtn) {
      state = reduce(state, { type: "set-notification", message: dialogBtn.dataset.msg });
      render();
      return;
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.id === "brightness") {
      state = reduce(state, { type: "set-brightness", value: event.target.value });
      render();
      triggerSave();
      return;
    }

    if (event.target.dataset.color) {
      state = reduce(state, {
        type: "set-clock-color",
        colorKey: event.target.dataset.color,
        value: event.target.value,
      });
      render();
      triggerSave();
      return;
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.id === "auto-switch") {
      state = reduce(state, { type: "toggle-auto-switch" });
      render();
      triggerSave();
      return;
    }

    if (event.target.dataset.timefield) {
      state = reduce(state, {
        type: "set-time-field",
        field: event.target.dataset.timefield,
        value: event.target.value,
      });
      render();
      triggerSave();
      return;
    }
  });

  render();
}
