import { createInitialState, reduce } from "./state.js";
import { api } from "./api.js";

const pages = ["overview", "display", "weather", "prayer", "time", "network", "media", "system"];

const themes = [
  "Weather & Prayer Station",
  "Editorial Weather Clock",
  "Minimalist Clean Clock",
];

function titleFor(page) {
  if (page === "prayer") return "Prayer Times";
  return page[0].toUpperCase() + page.slice(1);
}

function formatDatePreview(dateFormat) {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (dateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
  if (dateFormat === "YYYY/MM/DD") return `${year}/${month}/${day}`;
  if (dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (dateFormat === "DD.MM.YYYY") return `${day}.${month}.${year}`;
  return `${d.getDate()} ${months[d.getMonth()]} . ${days[d.getDay()]}`;
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
            <span>${formatDatePreview(state.time.dateFormat)}</span>
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
      <div class="action-footer mt-6">
        <button type="button" class="btn-primary" data-action="save-settings">Save Display Settings</button>
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
      <div class="action-footer mt-6">
        <button type="button" class="btn-primary" data-action="save-settings">Save Weather Settings</button>
      </div>
    </section>`;
}

function prayerContent(state) {
  const p = state.prayer || {};
  const t = p.timings || { fajr: "04:43", dhuhr: "11:43", asr: "15:01", maghrib: "17:27", isha: "18:43" };
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Islamic Prayer Times</p>
        <h2>Location & Geocoordinates</h2>
        <p class="section-subtitle">Accurate 5-waqt salah schedule calculated via AlAdhan API.</p>
      </div>
      <div class="input-grid">
        <div>
          <label for="prayer-city">City</label>
          <input id="prayer-city" type="text" value="${p.city || "Dhaka"}" class="text-input" data-prayerfield="city" />
        </div>
        <div>
          <label for="prayer-country">Country</label>
          <input id="prayer-country" type="text" value="${p.country || "Bangladesh"}" class="text-input" data-prayerfield="country" />
        </div>
        <div>
          <label for="prayer-lat">Latitude</label>
          <input id="prayer-lat" type="number" step="0.0001" value="${p.latitude ?? 23.8103}" class="text-input font-mono" data-prayerfield="latitude" />
        </div>
        <div>
          <label for="prayer-lng">Longitude</label>
          <input id="prayer-lng" type="number" step="0.0001" value="${p.longitude ?? 90.4125}" class="text-input font-mono" data-prayerfield="longitude" />
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Calculation Method</p>
        <h2>Juristic Standards</h2>
      </div>
      <div class="input-grid">
        <div class="col-span-2">
          <label for="prayer-method">Calculation Standard</label>
          <select id="prayer-method" class="select-input" data-prayerfield="method">
            <option value="1"${p.method === "1" ? " selected" : ""}>University of Islamic Sciences, Karachi (Standard for Bangladesh / Pakistan / India)</option>
            <option value="3"${p.method === "3" ? " selected" : ""}>Muslim World League (MWL)</option>
            <option value="4"${p.method === "4" ? " selected" : ""}>Umm Al-Qura University, Makkah</option>
            <option value="5"${p.method === "5" ? " selected" : ""}>Egyptian General Authority of Survey</option>
            <option value="2"${p.method === "2" ? " selected" : ""}>Islamic Society of North America (ISNA)</option>
          </select>
        </div>
        <div>
          <label for="prayer-asr">Asr Calculation Method</label>
          <select id="prayer-asr" class="select-input" data-prayerfield="asrMethod">
            <option value="Hanafi"${p.asrMethod === "Hanafi" ? " selected" : ""}>Hanafi (Standard in Bangladesh)</option>
            <option value="Standard"${p.asrMethod === "Standard" ? " selected" : ""}>Standard (Shafi, Maliki, Hanbali)</option>
          </select>
        </div>
      </div>

      <div class="prayer-table-preview my-4">
        <p style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem;">Live Prayer Schedule for ${p.city || "Dhaka"}</p>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; text-align: center;">
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">FAJR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${t.fajr}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">DHUHR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${t.dhuhr}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">ASR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${t.asr}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">MAGHRIB</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${t.maghrib}</div>
          </div>
          <div style="padding: 0.5rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #b45309; font-weight: 700;">ISHA</div>
            <div style="font-family: monospace; font-weight: 700; color: #92400e; margin-top: 0.25rem;">${t.isha}</div>
          </div>
        </div>
      </div>

      <div class="action-footer mt-6">
        <button type="button" class="btn-primary" data-action="save-settings">Save Prayer Settings</button>
      </div>
    </section>
  `;
}

function timeContent(state) {
  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Live Screen Preview</p>
        <h2>Time & Date Display</h2>
        <p class="section-subtitle">Real-time simulation using your configured time styles and colors.</p>
      </div>
      
      <div class="screen-frame my-4">
        <div class="screen-inner">
          <div class="screen-top-bar">
            <span>${state.weather.city} 28${state.weather.tempUnit}</span>
            <span>📶 ${state.network.signal}%</span>
          </div>
          ${renderClockDigits(state.time.colors, state.time.hourFormat, state.time.colonBlink)}
          <div class="screen-bottom-bar">
            <span>${formatDatePreview(state.time.dateFormat)}</span>
            <span>${state.time.hourFormat}</span>
          </div>
        </div>
      </div>

      <div>
        <p class="section-kicker">Custom Digit Colors</p>
        <h3>Segment Colors</h3>
      </div>
      <div class="input-grid mt-2">
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
        <p class="section-kicker">Format Configuration</p>
        <h2>Time, Date & Timezone</h2>
        <p class="section-subtitle">Select your preferred clock format and regional calendar format.</p>
      </div>
      <div class="input-grid">
        <div>
          <label for="time-format">Hour Format</label>
          <select id="time-format" class="select-input" data-timefield="hourFormat">
            <option value="12-Hour"${state.time.hourFormat === "12-Hour" ? " selected" : ""}>12-Hour (09:44 PM)</option>
            <option value="24-Hour"${state.time.hourFormat === "24-Hour" ? " selected" : ""}>24-Hour (21:44)</option>
          </select>
        </div>
        <div>
          <label for="date-format">Date Format</label>
          <select id="date-format" class="select-input" data-timefield="dateFormat">
            <option value="DD MMM . Day"${state.time.dateFormat === "DD MMM . Day" ? " selected" : ""}>DD MMM . Day (24 Oct . Fri)</option>
            <option value="DD/MM/YYYY"${state.time.dateFormat === "DD/MM/YYYY" ? " selected" : ""}>DD/MM/YYYY (24/10/2026)</option>
            <option value="YYYY/MM/DD"${state.time.dateFormat === "YYYY/MM/DD" ? " selected" : ""}>YYYY/MM/DD (2026/10/24)</option>
            <option value="MM/DD/YYYY"${state.time.dateFormat === "MM/DD/YYYY" ? " selected" : ""}>MM/DD/YYYY (10/24/2026)</option>
            <option value="DD.MM.YYYY"${state.time.dateFormat === "DD.MM.YYYY" ? " selected" : ""}>DD.MM.YYYY (24.10.2026)</option>
          </select>
        </div>
        <div>
          <label for="timezone-select">Timezone / UTC Offset</label>
          <select id="timezone-select" class="select-input" data-timefield="timezone">
            <option value="Asia/Dhaka (UTC+6:00)"${state.time.timezone.includes("UTC+6") ? " selected" : ""}>UTC+6:00 (Dhaka, Almaty)</option>
            <option value="Asia/Kolkata (UTC+5:30)"${state.time.timezone.includes("UTC+5:30") ? " selected" : ""}>UTC+5:30 (New Delhi, Colombo)</option>
            <option value="Asia/Karachi (UTC+5:00)"${state.time.timezone.includes("UTC+5:00") ? " selected" : ""}>UTC+5:00 (Karachi, Tashkent)</option>
            <option value="Asia/Dubai (UTC+4:00)"${state.time.timezone.includes("UTC+4:00") ? " selected" : ""}>UTC+4:00 (Dubai, Baku)</option>
            <option value="Asia/Riyadh (UTC+3:00)"${state.time.timezone.includes("UTC+3:00") ? " selected" : ""}>UTC+3:00 (Riyadh, Istanbul, Moscow)</option>
            <option value="Africa/Cairo (UTC+2:00)"${state.time.timezone.includes("UTC+2:00") ? " selected" : ""}>UTC+2:00 (Cairo, Athens)</option>
            <option value="Europe/Berlin (UTC+1:00)"${state.time.timezone.includes("UTC+1:00") ? " selected" : ""}>UTC+1:00 (Berlin, Paris, Rome)</option>
            <option value="Europe/London (UTC+0:00)"${state.time.timezone.includes("UTC+0") ? " selected" : ""}>UTC+0:00 (London, GMT/UTC)</option>
            <option value="America/New_York (UTC-5:00)"${state.time.timezone.includes("UTC-5") ? " selected" : ""}>UTC-5:00 (New York, EST)</option>
            <option value="America/Los_Angeles (UTC-8:00)"${state.time.timezone.includes("UTC-8") ? " selected" : ""}>UTC-8:00 (Los Angeles, PST)</option>
            <option value="Asia/Singapore (UTC+8:00)"${state.time.timezone.includes("UTC+8") ? " selected" : ""}>UTC+8:00 (Singapore, Beijing, Taipei)</option>
            <option value="Asia/Tokyo (UTC+9:00)"${state.time.timezone.includes("UTC+9") ? " selected" : ""}>UTC+9:00 (Tokyo, Seoul)</option>
          </select>
        </div>
        <div>
          <label for="colon-blink">Colon Blink Animation</label>
          <select id="colon-blink" class="select-input" data-timefield="colonBlink">
            <option value="true"${state.time.colonBlink ? " selected" : ""}>Enabled (Blinks every second)</option>
            <option value="false"${!state.time.colonBlink ? " selected" : ""}>Disabled (Solid)</option>
          </select>
        </div>
        <div>
          <label for="font-style">Time Font</label>
          <select id="font-style" class="select-input" data-timefield="fontStyle">
            <option value="Default Big Font"${state.time.fontStyle === "Default Big Font" ? " selected" : ""}>Default Big Font</option>
            <option value="Digital Font"${state.time.fontStyle === "Digital Font" ? " selected" : ""}>Digital Font</option>
          </select>
        </div>
        <div>
          <label for="ntp-server">NTP Server Address</label>
          <input id="ntp-server" type="text" value="${state.time.ntp}" data-timefield="ntp" class="text-input font-mono" />
        </div>
      </div>

      <div class="action-footer mt-6">
        <button type="button" class="btn-primary" data-action="save-settings">Save Time & Date Settings</button>
      </div>
    </section>`;
}

function networkContent(state) {
  return `
    <section class="details-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <p class="section-kicker">Wi-Fi Connection</p>
          <h2>Available 2.4 GHz Networks</h2>
          <p class="section-subtitle">Click "Select" on any network below to auto-populate credentials.</p>
        </div>
        <button type="button" class="btn-secondary" data-action="scan-wifi">🔄 Rescan Networks</button>
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
                    ${isCurrent ? `<span class="tag-badge">Selected</span>` : ""}
                  </td>
                  <td>${net.signal || "Strong"} (${net.rssi || 70}%)</td>
                  <td>${net.security || "WPA2"}</td>
                  <td>
                    <button type="button" class="btn-sm" data-action="select-wifi" data-ssid="${net.ssid}">
                      ${isCurrent ? "Selected" : "Select"}
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="details-panel" id="wifi-credentials-section">
      <div>
        <p class="section-kicker">Credentials</p>
        <h2>Connect to Network</h2>
        <p class="section-subtitle">Enter your Wi-Fi password and click "Connect to Wi-Fi" to connect the SmallTV.</p>
      </div>
      <div class="input-grid">
        <div>
          <label for="wifi-ssid">Network SSID</label>
          <input id="wifi-ssid" type="text" value="${state.network.ssid}" class="text-input" />
        </div>
        <div>
          <label for="wifi-pass">Wi-Fi Password</label>
          <input id="wifi-pass" type="password" placeholder="Enter network password" class="text-input" />
        </div>
        <div>
          <label for="boot-delay">Boot Delay (Seconds)</label>
          <input id="boot-delay" type="number" min="0" max="60" value="${state.network.bootDelay}" class="text-input" />
        </div>
      </div>
      <div class="action-footer mt-6 flex gap-3">
        <button type="button" class="btn-primary" data-action="connect-wifi">Connect to Wi-Fi</button>
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
        <p class="section-subtitle">Flash compiled <code>.bin</code> firmware images directly over Wi-Fi.</p>
      </div>
      <form action="/update" method="POST" enctype="multipart/form-data" class="ota-box mt-4">
        <div class="ota-info">
          <p><strong>Current Version:</strong> ${state.device.firmware}</p>
          <p><strong>Target Hardware:</strong> ${state.device.model} (${state.device.chip})</p>
          <p class="text-sm text-muted">Upload <code>custom_dashboard_firmware.bin</code> or stock rollback <code>.bin</code> image.</p>
        </div>
        <div class="file-upload-active mt-4">
          <label for="firmware" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem;">Select Firmware Binary (.bin):</label>
          <input type="file" name="firmware" id="firmware" accept=".bin,.bin.gz" required class="file-input" style="width: 100%; padding: 0.5rem; border: 1px solid var(--color-line); border-radius: 4px; margin-bottom: 1rem;" />
          <button type="submit" class="btn-primary" style="width: 100%;">Upload & Flash Firmware</button>
        </div>
      </form>
    </section>

    <section class="details-panel system-panel">
      <div>
        <p class="section-kicker">Device Controls</p>
        <h2>Reboot & Diagnostics</h2>
        <p class="section-subtitle">Manage runtime and reboot the ESP8266 controller.</p>
      </div>
      <div class="button-row mt-4">
        <button type="button" class="btn-primary" data-action="device-reboot">
          Reboot Device
        </button>
      </div>
    </section>`;
}

function pageContent(state) {
  if (state.page === "overview") return overviewContent(state);
  if (state.page === "display") return displayContent(state);
  if (state.page === "weather") return weatherContent(state);
  if (state.page === "prayer") return prayerContent(state);
  if (state.page === "time") return timeContent(state);
  if (state.page === "network") return networkContent(state);
  if (state.page === "media") return mediaContent(state);
  if (state.page === "system") return systemContent(state);
  return overviewContent(state);
}

export function renderDashboard(state) {
  const pageTitle = titleFor(state.page);

  return `
    <div class="mobile-nav-bar">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <button class="hamburger-btn" type="button" data-action="toggle-mobile-menu" aria-label="Toggle navigation">☰</button>
        <span class="wordmark">SmallTV<span>control</span></span>
      </div>
      <div class="header-badges">
        ${state.notification ? `<span class="notification-toast">${state.notification}</span>` : ""}
      </div>
    </div>
    <div class="sidebar-overlay" data-action="close-mobile-menu"></div>
    <div class="app-shell">
      <aside class="sidebar">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <a class="wordmark" href="#app" aria-label="SmallTV dashboard home">SmallTV<span>control</span></a>
          <button class="close-drawer-btn md:hidden" type="button" data-action="close-mobile-menu" aria-label="Close navigation menu">✕</button>
        </div>
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
          </div>
        </header>
        ${pageContent(state)}
      </main>
    </div>`;
}

if (typeof document !== "undefined") {
  function getInitialPage() {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, "").toLowerCase();
      if (pages.includes(hash)) return hash;
    }
    return "overview";
  }

  let state = createInitialState();
  state.page = getInitialPage();
  const app = document.querySelector("#app");

  let saveTimeout = null;
  async function triggerSave(immediate = false) {
    clearTimeout(saveTimeout);
    const executeSave = async () => {
      const res = await api.saveSettings({
        display: state.display,
        weather: state.weather,
        prayer: state.prayer,
        time: state.time,
        network: state.network,
        media: state.media,
      });
      state = reduce(state, {
        type: "set-notification",
        message: res.success ? (api.isLiveServer ? "✓ Settings saved to flash" : "✓ Saved (Offline)") : "Error saving",
      });
      render();
      setTimeout(() => {
        state = reduce(state, { type: "set-notification", message: null });
        render();
      }, 3000);
    };

    if (immediate) {
      state = reduce(state, { type: "set-notification", message: "Saving to flash..." });
      render();
      await executeSave();
    } else {
      saveTimeout = setTimeout(executeSave, 400);
    }
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
          display: {
            ...state.display,
            ...remoteSettings.display,
            nightMode: { ...state.display.nightMode, ...(remoteSettings.display?.nightMode || {}) },
          },
          weather: { ...state.weather, ...remoteSettings.weather },
          prayer: { ...state.prayer, ...(remoteSettings.prayer || {}) },
          time: {
            ...state.time,
            ...remoteSettings.time,
            colors: { ...state.time.colors, ...(remoteSettings.time?.colors || {}) },
          },
          network: { ...state.network, ...remoteSettings.network },
          media: { ...state.media, ...remoteSettings.media },
        };
      }
      render();
    })();
  }

  // Listen to hash changes (back/forward or external navigation)
  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", () => {
      const page = getInitialPage();
      if (state.page !== page) {
        state = reduce(state, { type: "navigate", page });
        render();
      }
    });
  }

  app.addEventListener("click", (event) => {
    if (event.target.closest("[data-action='toggle-mobile-menu']")) {
      document.querySelector(".sidebar")?.classList.toggle("is-open");
      document.querySelector(".sidebar-overlay")?.classList.toggle("is-active");
      return;
    }

    if (event.target.closest("[data-action='close-mobile-menu']")) {
      document.querySelector(".sidebar")?.classList.remove("is-open");
      document.querySelector(".sidebar-overlay")?.classList.remove("is-active");
      return;
    }

    const page = event.target.closest("[data-page]")?.dataset.page;
    if (page) {
      if (typeof window !== "undefined") {
        window.location.hash = page;
      }
      document.querySelector(".sidebar")?.classList.remove("is-open");
      document.querySelector(".sidebar-overlay")?.classList.remove("is-active");
      state = reduce(state, { type: "navigate", page });
      render();
      return;
    }

    if (event.target.closest("[data-action='device-reboot']")) {
      if (confirm("Reboot the SmallTV device now?")) {
        api.reboot().then(() => {
          state = reduce(state, { type: "set-notification", message: "Rebooting device..." });
          render();
        });
      }
      return;
    }

    const saveBtn = event.target.closest("[data-action='save-settings']");
    if (saveBtn) {
      triggerSave(true);
      return;
    }

    const themeBtn = event.target.closest("[data-action='select-theme']");
    if (themeBtn) {
      state = reduce(state, { type: "set-theme", theme: themeBtn.dataset.theme });
      render();
      triggerSave(true);
      return;
    }

    const wifiBtn = event.target.closest("[data-action='select-wifi']");
    if (wifiBtn) {
      const ssid = wifiBtn.dataset.ssid;
      state = reduce(state, { type: "select-wifi", ssid });
      render();
      const passEl = document.querySelector("#wifi-pass");
      if (passEl) {
        passEl.scrollIntoView({ behavior: "smooth", block: "center" });
        passEl.focus();
      }
      return;
    }

    const connectWifiBtn = event.target.closest("[data-action='connect-wifi']");
    if (connectWifiBtn) {
      const ssid = document.querySelector("#wifi-ssid")?.value || state.network.ssid;
      const password = document.querySelector("#wifi-pass")?.value || "";
      const bootDelay = Number(document.querySelector("#boot-delay")?.value || state.network.bootDelay || 0);

      if (!ssid) {
        state = reduce(state, { type: "set-notification", message: "Please enter or select a Wi-Fi SSID." });
        render();
        return;
      }

      state = reduce(state, {
        type: "set-notification",
        message: `Connecting to "${ssid}"...`,
      });
      render();

      api.connectWifi(ssid, password, bootDelay).then((res) => {
        state = reduce(state, {
          type: "set-notification",
          message: res.success ? `Connected to ${ssid}. Device IP updated.` : `Connection failed: ${res.error || "Unknown error"}`,
        });
        render();
      });
      return;
    }

    const scanWifiBtn = event.target.closest("[data-action='scan-wifi']");
    if (scanWifiBtn) {
      state = reduce(state, { type: "set-notification", message: "Scanning for 2.4 GHz Wi-Fi networks..." });
      render();
      api.scanWifi().then((res) => {
        if (res && res.networks && res.networks.length > 0) {
          state = {
            ...state,
            network: {
              ...state.network,
              scannedNetworks: res.networks,
            },
            notification: `Found ${res.networks.length} networks.`,
          };
        } else {
          state = reduce(state, { type: "set-notification", message: "Scan complete. No networks found." });
        }
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

    if (event.target.dataset.prayerfield) {
      state = reduce(state, {
        type: "set-prayer-field",
        field: event.target.dataset.prayerfield,
        value: event.target.value,
      });
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
