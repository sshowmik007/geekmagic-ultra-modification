import { createInitialState, reduce } from "./state.js";
import { api } from "./api.js";

const pages = ["overview", "display", "weather", "prayer", "time", "network", "media", "system"];

const themes = [
  "Weather & Prayer Station",
  "Editorial Weather Clock",
  "Minimalist Clean Clock",
  "AI Token & Rate Monitor",
  "Cosmic Shuttle & Prayer Station",
  "Photo Frame & Ambient Album",
  "Analog Calendar Clock",
  "Network Health Monitor",
  "Now Playing",
  "Focus Timer",
  "Notifications & Diagnostics",
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function updateTokenControls(tokens) {
  const providerSelect = document.querySelector("#token-provider");
  const providerValue = tokens.provider ? `${tokens.provider}:${tokens.model || "Model unavailable"}` : "unavailable";
  if (providerSelect && ![...providerSelect.options].some((option) => option.value === providerValue)) {
    const option = document.createElement("option");
    option.value = providerValue;
    option.textContent = tokens.provider ? `${tokens.provider} — ${tokens.model || "Model unavailable"}` : "No verified provider source";
    providerSelect.prepend(option);
  }
  if (providerSelect) providerSelect.value = providerValue;

  const agentState = document.querySelector("#agent-state");
  if (agentState) agentState.value = tokens.agentState;
  const laptopSync = document.querySelector("#laptop-sync-toggle");
  if (laptopSync) laptopSync.checked = Boolean(tokens.isLaptopOnline);

  const sessionOutput = document.querySelector("#session-limit-output");
  const sessionLabel = document.querySelector("#session-limit-label");
  if (sessionLabel) sessionLabel.textContent = `${tokens.sessionLabel || "5-HOUR LIMIT"} Remaining:`;
  if (sessionOutput) sessionOutput.textContent = tokens.sessionPct == null || Number(tokens.sessionPct) < 0 ? "Unavailable" : `${tokens.sessionPct}% (${tokens.sessionReset || "--"})`;
  const sessionRange = document.querySelector("#session-tokens");
  if (sessionRange) sessionRange.value = tokens.sessionPct ?? 0;

  const weeklyOutput = document.querySelector("#weekly-limit-output");
  const weeklyLabel = document.querySelector("#weekly-limit-label");
  if (weeklyLabel) weeklyLabel.textContent = `${tokens.weeklyLabel || "7-DAY LIMIT"} Remaining:`;
  if (weeklyOutput) weeklyOutput.textContent = tokens.weeklyPct == null || Number(tokens.weeklyPct) < 0 ? "Unavailable" : `${tokens.weeklyPct}% (${tokens.weeklyReset || "--"})`;
  const weeklyRange = document.querySelector("#weekly-tokens");
  if (weeklyRange) weeklyRange.value = tokens.weeklyPct ?? 0;

  // Live Telemetry Table Elements (Overview & Display tabs)
  document.querySelectorAll("[data-telemetry='provider']").forEach((el) => {
    el.textContent = tokens.provider || "Waiting for stream";
  });
  document.querySelectorAll("[data-telemetry='model']").forEach((el) => {
    el.textContent = tokens.model || "Waiting for sync";
  });
  document.querySelectorAll("[data-telemetry='agentState']").forEach((el) => {
    el.textContent = tokens.agentState || "IDLE";
  });
  document.querySelectorAll("[data-telemetry='sessionTokens']").forEach((el) => {
    el.textContent = tokens.sessionTokens ? `${tokens.sessionTokens.toLocaleString()} tok` : "--";
  });
  document.querySelectorAll("[data-telemetry='weeklyTokens']").forEach((el) => {
    el.textContent = tokens.weeklyTokens ? `${tokens.weeklyTokens.toLocaleString()} tok` : "--";
  });
  document.querySelectorAll("[data-telemetry='sessionPct']").forEach((el) => {
    el.textContent = tokens.sessionPct != null ? `${tokens.sessionPct}% (${tokens.sessionReset || "--"})` : "Unavailable";
  });
  document.querySelectorAll("[data-telemetry='weeklyPct']").forEach((el) => {
    el.textContent = tokens.weeklyPct != null ? `${tokens.weeklyPct}% (${tokens.weeklyReset || "--"})` : "Unavailable";
  });
  document.querySelectorAll("[data-telemetry='sourceLabel']").forEach((el) => {
    el.textContent = tokens.sourceLabel || "Local companion stream";
  });
}

export function getUsageColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "#64748b";
  if (pct >= 75) return "#10b981";
  if (pct >= 40) return "#eab308";
  if (pct >= 15) return "#f97316";
  return "#ef4444";
}

function formatTime12(timeStr, is12h, includePeriod = false) {
  if (!timeStr || !is12h) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m}${includePeriod ? ` ${period}` : ""}`;
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

function formatCalendarDates(date = new Date()) {
  const localized = (locale, options, fallback) => {
    try { return new Intl.DateTimeFormat(locale, options).format(date); } catch { return fallback; }
  };
  return {
    bangla: localized("bn-BD-u-ca-beng", { day: "numeric", month: "long", year: "numeric" }, "বাংলা তারিখ"),
    hijri: localized("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }, "التاريخ الهجري"),
    english: localized("en-GB", { day: "2-digit", month: "short", year: "numeric", weekday: "short" }, "25 Oct 2026 Sun"),
  };
}

function analogClockSvg(date) {
  const hourAngle = ((date.getHours() % 12) + date.getMinutes() / 60) * 30;
  const minuteAngle = (date.getMinutes() + date.getSeconds() / 60) * 6;
  const secondAngle = date.getSeconds() * 6;
  const hand = (angle, length, width, color, className = "") => `<line class="${className}" x1="120" y1="78" x2="120" y2="${78 - length}" transform="rotate(${angle} 120 78)" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="120" y1="17" x2="120" y2="24" transform="rotate(${i * 30} 120 78)" stroke="#94a3b8" stroke-width="1.6"/>`).join("");
  return `<svg class="analog-clock-svg" viewBox="0 0 240 160" role="img" aria-label="Live analogue clock">
    <circle cx="120" cy="78" r="61" fill="#0b1220" stroke="#f59e0b" stroke-width="2"/>
    <circle cx="120" cy="78" r="55" fill="none" stroke="#263247" stroke-width="1"/>
    ${ticks}${hand(hourAngle, 32, 4, "#f8fafc")}${hand(minuteAngle, 44, 2.5, "#f59e0b")}${hand(secondAngle, 53, 1, "#38bdf8", "analog-second")}
    <circle cx="120" cy="78" r="4" fill="#f59e0b"/><circle cx="120" cy="78" r="1.5" fill="#0b1220"/>
  </svg>`;
}

function titleFor(page) {
  if (page === "prayer") return "Prayer Times";
  return page[0].toUpperCase() + page.slice(1);
}

function renderThemeSimulation(state) {
  const d = new Date();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const is12h = state.time.hourFormat === "12-Hour";
  if (is12h) {
    hours = hours % 12 || 12;
  }
  const hh = String(hours).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dateStr = formatDatePreview(state.time.dateFormat);
  const calendarDates = formatCalendarDates(d);
  const theme = state.display.theme;

  if (theme === "Analog Calendar Clock") {
    return `<div class="screen-inner theme-sim-analog-calendar">
      <div class="analog-topline"><span>${escapeHtml(state.weather.city || "Unavailable")}</span><span class="analog-live"><i></i> LIVE</span></div>
      ${analogClockSvg(d)}
      <div class="analog-date-stack" role="status" aria-live="polite">
        <div><b>বাংলা</b><span>${calendarDates.bangla}</span></div>
        <div><b>ه‍جري</b><span>${calendarDates.hijri}</span></div>
        <div><b>EN</b><span>${calendarDates.english}</span></div>
      </div>
    </div>`;
  }

  if (theme === "Network Health Monitor") {
    return `<div class="screen-inner feature-theme network-theme">
      <div class="feature-kicker">NETWORK HEALTH</div><div class="feature-value">${state.network.signal == null ? "--" : `${state.network.signal}%`}</div>
      <div class="feature-row"><span>Wi-Fi</span><b>${escapeHtml(state.network.status)}</b></div>
      <div class="feature-row"><span>SSID</span><b>${escapeHtml(state.network.ssid)}</b></div>
      <div class="feature-row"><span>IP</span><b>${escapeHtml(state.device.ip)}</b></div>
      <div class="feature-row"><span>UPTIME</span><b>${escapeHtml(state.device.uptime)}</b></div>
    </div>`;
  }

  if (theme === "Now Playing") {
    const nowPlaying = state.media.nowPlaying || {};
    return `<div class="screen-inner feature-theme now-playing-theme">
      <div class="feature-kicker">NOW PLAYING</div><div class="now-playing-art">▶</div>
      <h3>${escapeHtml(nowPlaying.title || "No title connected")}</h3><p>${escapeHtml(nowPlaying.source || "Metadata bridge")}</p>
      <div class="feature-progress"><i style="width:${Math.max(0, Math.min(100, Number(nowPlaying.progress) || 0))}%"></i></div>
      <div class="feature-row"><span>${escapeHtml(nowPlaying.status || "Offline")}</span><b>${Math.round(Number(nowPlaying.progress) || 0)}%</b></div>
    </div>`;
  }

  if (theme === "Focus Timer") {
    const focus = state.focus || {};
    const total = Math.max(1, Number(focus.minutes) || 25) * 60;
    const remaining = Math.max(0, Number(focus.remaining) || total);
    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");
    return `<div class="screen-inner feature-theme focus-theme"><div class="feature-kicker">FOCUS SESSION</div>
      <div class="focus-ring"><strong>${mins}:${secs}</strong><span>${focus.running ? "FOCUSING" : "READY"}</span></div>
      <p>Pomodoro · ${Number(focus.minutes) || 25} minutes</p><div class="feature-progress"><i style="width:${Math.max(0, Math.min(100, ((total - remaining) / total) * 100))}%"></i></div>
    </div>`;
  }

  if (theme === "Notifications & Diagnostics") {
    const center = state.notificationCenter || {};
    return `<div class="screen-inner feature-theme diagnostics-theme"><div class="feature-kicker">DEVICE STATUS</div>
      <div class="feature-value">${state.device.freeHeap}</div><div class="feature-row"><span>HEAP FREE</span><b>${escapeHtml(state.device.freeHeap)}</b></div>
      <div class="feature-row"><span>UPTIME</span><b>${escapeHtml(state.device.uptime)}</b></div><div class="feature-row"><span>NOTICE</span><b>${escapeHtml(center.message || "All clear")}</b></div>
    </div>`;
  }

  if (theme === "Editorial Weather Clock") {
    return `
      <div class="screen-inner theme-sim-editorial">
        <div class="sim-header">
          <span style="color: #94a3b8; font-size: 10px;">${dateStr.toUpperCase()}</span>
          <span class="anim-live-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
        </div>
        <div class="sim-editorial-time">
          ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
          ${is12h ? `<span style="font-size: 14px; color: #fda000; margin-left: 4px; vertical-align: super;">${ampm}</span>` : ""}
        </div>
        <div class="sim-editorial-hero">
          <div class="anim-sun" style="width: 32px; height: 32px; border-radius: 50%; background: #fda000; border: 2px solid #fc0000; flex-shrink: 0;"></div>
          <div>
            <div style="font-size: 20px; font-weight: 800; line-height: 1.1; color: #fff;">--<span style="font-size: 12px; color: #94a3b8;">${state.weather.tempUnit}</span></div>
            <div style="font-size: 9px; color: #cbd5e1;">${state.weather.city} · Clear Sky</div>
            <div style="font-size: 8px; color: #38bdf8;">HUM 64% · 1013hPa</div>
          </div>
        </div>
      </div>
    `;
  }

  if (theme === "Minimalist Clean Clock") {
    return `
      <div class="screen-inner theme-sim-minimal">
        <div class="sim-minimal-time">${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}</div>
        ${is12h ? `<div class="sim-ampm-pill">${ampm}</div>` : ""}
        <div style="color: #94a3b8; font-size: 11px; font-weight: 600; margin-top: 4px;">${dateStr}</div>
        <span class="anim-live-dot" style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #22c55e; margin-top: 8px;"></span>
      </div>
    `;
  }

  if (theme === "AI Token & Rate Monitor") {
    const tokens = state.tokens || {
      provider: null,
      model: null,
      status: "idle",
      agentState: "IDLE",
      sessionTokens: 0,
      sessionLimit: null,
      sessionReset: "--",
      weeklyTokens: 0,
      weeklyLimit: null,
      weeklyReset: "Daily Reset",
      tokensPerSec: 0,
      isLaptopOnline: false,
      telemetryState: "unavailable",
      sourceLabel: "No verified provider source",
    };

    if (tokens.telemetryState === "unavailable" || !tokens.provider) {
      return `<div class="screen-inner theme-sim-tokens token-disconnected" role="status" aria-label="Connect provider">
        <div class="connect-orbit" aria-hidden="true"><i></i><i></i><i></i><b>↔</b></div>
        <h3>CONNECT PROVIDER</h3>
        <p>No verified local telemetry is available.</p>
        <small>Run the companion daemon to start live updates.</small>
      </div>`;
    }

    const sessionPct = tokens.sessionPct !== undefined && tokens.sessionPct !== null && Number(tokens.sessionPct) >= 0
      ? Number(tokens.sessionPct)
      : null;
    const weeklyPct = tokens.weeklyPct !== undefined && tokens.weeklyPct !== null && Number(tokens.weeklyPct) >= 0
      ? Number(tokens.weeklyPct)
      : null;
    const sessionColor = getUsageColor(sessionPct);
    const weeklyColor = getUsageColor(weeklyPct);

    const isGemini = (tokens.provider || "").toLowerCase().includes("gemini");
    const isClaude = (tokens.provider || "").toLowerCase().includes("claude");
    const isCodex = (tokens.provider || "").toLowerCase().includes("codex") || (tokens.provider || "").toLowerCase().includes("open");

    const formatTokenCount = (value) => {
      const count = Number(value || 0);
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return `${count}`;
    };
    const hasSessionUsage = Number(tokens.sessionTokens || 0) > 0;
    const hasWeeklyUsage = Number(tokens.weeklyTokens || 0) > 0;
    const label1 = sessionPct == null && hasSessionUsage
      ? "TOKENS USED"
      : (tokens.sessionLabel || (isCodex ? "5-HOUR LIMIT" : "5-HOUR LIMIT"));
    const label2 = weeklyPct == null && hasWeeklyUsage
      ? "SESSION TOTAL"
      : (tokens.weeklyLabel || (isCodex ? "7-DAY LIMIT" : "WEEKLY LIMIT"));

    const sessionText = sessionPct == null && hasSessionUsage
      ? `${formatTokenCount(tokens.sessionTokens)} used`
      : (tokens.sessionText || (sessionPct == null ? "Unavailable" : (tokens.sessionLimit <= 100 ? `${sessionPct}% Remaining` : (tokens.sessionLimit >= 1000000
      ? `${((tokens.sessionTokens || 0) / 1000).toFixed(1)}k / ${((tokens.sessionLimit || 0) / 1000000).toFixed(1)}M tok`
      : `${((tokens.sessionTokens || 0) / 1000).toFixed(1)}k / ${((tokens.sessionLimit || 0) / 1000).toFixed(0)}k tok`))));

    const weeklyText = weeklyPct == null && hasWeeklyUsage
      ? `${formatTokenCount(tokens.weeklyTokens)} total`
      : (tokens.weeklyText || (weeklyPct == null ? "Unavailable" : (tokens.weeklyLimit <= 100 ? `${weeklyPct}% Remaining` : (tokens.weeklyTokens >= 1000000
      ? `${((tokens.weeklyTokens || 0) / 1000000).toFixed(1)}M / ${((tokens.weeklyLimit || 0) / 1000000).toFixed(1)}M tok`
      : `${((tokens.weeklyTokens || 0) / 1000).toFixed(0)}k / ${((tokens.weeklyLimit || 0) / 1000000).toFixed(1)}M tok`))));

    let pillClass = "pill-claude";
    let pillLogo = `<svg width="12" height="12" viewBox="0 0 256 257" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M50.228 170.321L100.585 142.064L101.428 139.601L100.585 138.24L98.123 138.24L89.697 137.722L60.922 136.944L35.97 135.907L11.795 134.611L5.703 133.314L0 125.796L0.583 122.037L5.703 118.603L13.027 119.251L29.229 120.352L53.533 122.037L71.162 123.074L97.28 125.796L101.428 125.796L102.011 124.111L100.585 123.074L99.484 122.037L74.337 104.992L47.117 86.975L32.859 76.606L25.146 71.356L21.258 66.43L19.573 55.672L26.572 47.959L35.97 48.608L38.368 49.256L47.895 56.579L68.245 72.328L94.817 91.901L98.706 95.141L100.261 94.039L100.456 93.262L98.706 90.345L84.253 64.227L68.828 37.655L61.958 26.637L60.144 20.026C59.496 17.304 59.042 15.036 59.042 12.249L67.014 1.426L71.421 0L82.05 1.426L86.522 5.314L93.132 20.415L103.826 44.201L120.417 76.541L125.278 86.133L127.87 95.012L128.843 97.734L130.528 97.734L130.528 96.178L131.889 77.967L134.416 55.607L136.879 26.831L137.722 18.73L141.74 9.009L149.711 3.759L155.933 6.74L161.053 14.064L160.34 18.795L157.294 38.562L151.332 69.541L147.443 90.281L149.711 90.281L152.304 87.688L162.803 73.754L180.431 51.718L188.209 42.969L197.282 33.312L203.115 28.711L214.133 28.711L222.234 40.766L218.605 53.209L207.263 67.597L197.865 79.781L184.385 97.928L175.959 112.446L176.737 113.612L178.746 113.418L209.207 106.937L225.669 103.955L245.306 100.585L254.185 104.733L255.157 108.946L251.658 117.566L230.659 122.75L206.031 127.676L169.349 136.361L168.895 136.685L169.414 137.333L185.94 138.888L193.005 139.277L210.309 139.277L242.519 141.675L250.945 147.249L256 154.054L255.157 159.238L242.195 165.849L224.697 161.701L183.866 151.98L169.867 148.48L167.923 148.48L167.923 149.647L179.589 161.053L200.976 180.367L227.743 205.254L229.104 211.411L225.669 216.271L222.039 215.753L198.513 198.06L189.44 190.088L168.895 172.784L167.534 172.784L167.534 174.598L172.265 181.533L197.282 219.123L198.578 230.659L196.764 234.418L190.283 236.687L183.153 235.39L168.506 214.846L153.406 191.708L141.221 170.969L139.731 171.812L132.537 249.26L129.167 253.213L121.389 256.194L114.908 251.269L111.473 243.297L114.908 227.548L119.056 207.004L122.426 190.671L125.472 170.386L127.287 163.646L127.157 163.192L125.667 163.386L110.372 184.385L87.105 215.818L68.699 235.52L64.292 237.27L56.644 233.316L57.357 226.252L61.634 219.966L87.105 187.561L102.465 167.469L112.381 155.868L112.316 154.183L111.733 154.183L44.071 198.125L32.016 199.68L26.831 194.819L27.479 186.848L29.942 184.255L50.293 170.256Z"/></svg>`;
    const pLow = (tokens.provider || "Unavailable").toLowerCase();
    if (pLow.includes("gemini")) {
      pillClass = "pill-gemini";
      pillLogo = `<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M128 0C130.686 0 133.02 1.833 133.676 4.437C135.683 12.402 138.301 20.17 141.56 27.728C150.048 47.45 161.7 64.71 176.49 79.5C191.28 94.29 208.54 105.94 228.27 114.43C235.83 117.69 243.6 120.31 251.56 122.32C254.167 122.976 256 125.31 256 128C256 130.69 254.167 133.024 251.56 133.68C243.6 135.69 235.83 138.31 228.27 141.57C208.54 150.06 191.28 161.71 176.49 176.5C161.7 191.29 150.048 208.55 141.56 228.27C138.301 235.83 135.683 243.6 133.676 251.56C133.02 254.167 130.686 256 128 256C125.314 256 122.98 254.167 122.324 251.56C120.317 243.6 117.699 235.83 114.44 228.27C105.952 208.55 94.3 191.29 79.51 176.5C64.72 161.71 47.46 150.06 27.73 141.57C20.17 138.31 12.4 135.69 4.44 133.68C1.833 133.024 0 130.69 0 128C0 125.31 1.833 122.976 4.44 122.32C12.4 120.31 20.17 117.69 27.73 114.43C47.46 105.94 64.72 94.29 79.51 79.5C94.3 64.71 105.952 47.45 114.44 27.728C117.699 20.17 120.317 12.402 122.324 4.437C122.98 1.833 125.314 0 128 0Z"/></svg>`;
    } else if (pLow.includes("open") || pLow.includes("codex") || pLow.includes("gpt")) {
      pillClass = "pill-openai";
      pillLogo = `<svg width="12" height="12" viewBox="0 0 256 260" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"/></svg>`;
    } else if (pLow.includes("opencode")) {
      pillClass = "pill-opencode";
      pillLogo = `<svg width="12" height="12" viewBox="0 0 240 300" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M0 0H240V60H0ZM0 0H60V300H0ZM180 0H240V300H180ZM0 240H240V300H0Z"/><path fill-opacity="0.5" d="M60 120H180V240H60Z"/></svg>`;
    }

    return `
      <div class="screen-inner theme-sim-tokens">
        <div class="sim-token-header">
          <div class="sim-token-time">
            ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
            ${is12h ? `<span style="font-size: 10px; color: #f59e0b; font-weight: 700; margin-left: 2px;">${ampm}</span>` : ""}
          </div>
          <div class="sim-provider-pill ${pillClass}">
            ${pillLogo}
            <span>${(tokens.provider || "Unavailable").toUpperCase()}</span>
            ${tokens.model ? `<span class="sim-model-tag">${tokens.model.replace("Gemini ", "").replace("Claude ", "")}</span>` : ""}
          </div>
        </div>

        <div class="sim-meter-block">
          <div class="sim-meter-meta">
            <span class="sim-meter-label">${label1}</span>
            <span class="sim-meter-reset"><span style="font-size:9px;">⟳</span> ${tokens.sessionReset || "--"}</span>
          </div>
          <div class="sim-meter-track">
            <div class="sim-meter-fill" style="width: ${sessionPct}%; background: ${sessionColor};"></div>
          </div>
          <div class="sim-meter-subrow">
            <span>${sessionText}</span>
            <span style="font-weight: 800; color: ${sessionColor};">${sessionPct == null ? "--" : `${sessionPct}%`}</span>
          </div>
        </div>

        <div class="sim-meter-block">
          <div class="sim-meter-meta">
            <span class="sim-meter-label">${label2}</span>
            <span class="sim-meter-reset"><span style="font-size:9px;">⟳</span> ${tokens.weeklyReset || "--"}</span>
          </div>
          <div class="sim-meter-track">
            <div class="sim-meter-fill" style="width: ${weeklyPct}%; background: ${weeklyColor};"></div>
          </div>
          <div class="sim-meter-subrow">
            <span>${weeklyText}</span>
            <span style="font-weight: 800; color: ${weeklyColor};">${weeklyPct == null ? "--" : `${weeklyPct}%`}</span>
          </div>
        </div>

        <div class="sim-token-footer ${tokens.isLaptopOnline ? "" : "is-offline"}">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span class="${tokens.isLaptopOnline ? "anim-live-dot" : ""}" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${tokens.isLaptopOnline ? "#22c55e" : "#64748b"};"></span>
            <span style="font-weight: 700; color: ${tokens.isLaptopOnline ? "#f8fafc" : "#94a3b8"};">
              ${tokens.isLaptopOnline ? "LAPTOP SYNCED" : "LAPTOP IDLE"}
            </span>
          </div>
          <div style="font-weight: 700; color: ${tokens.isLaptopOnline ? (tokens.agentState === "WORKING" ? "#f97316" : tokens.agentState === "WAITING" ? "#38bdf8" : "#22c55e") : "#64748b"};">
            ${tokens.isLaptopOnline ? tokens.agentState : "STANDBY"}
          </div>
        </div>
      </div>
    `;
  }

  if (theme === "Photo Frame & Ambient Album") {
    const hasPhoto = state.media && (state.media.activePhotoUrl || (state.media.files && state.media.files.length > 0 && state.media.files[0].url));
    const photoUrl = hasPhoto ? (state.media.activePhotoUrl || state.media.files[0].url) : null;

    return `
      <div class="screen-inner theme-sim-photo-album" style="position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        ${photoUrl ? `
          <img src="${photoUrl}" alt="Photo Frame Preview" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 2px 8px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
            <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: #fff;">
              ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
            </span>
            ${is12h ? `<span style="font-size: 8px; font-weight: 700; color: #f59e0b;">${ampm}</span>` : ""}
          </div>
        ` : `
          <div style="text-align: center; padding: 1.5rem; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; box-sizing: border-box;">
            <div style="width: 52px; height: 52px; border: 2px dashed #475569; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; background: #0f172a;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; letter-spacing: 0.05em; margin-bottom: 4px;">PHOTO FRAME</div>
            <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">No photo uploaded yet</div>
            <div style="font-size: 9px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; padding: 2px 6px;">
              Upload at #media
            </div>
          </div>
        `}
      </div>
    `;
  }

  if (theme === "Cosmic Shuttle & Prayer Station") {
    const sunrise = state.prayer.timings.sunrise || "05:52";
    const sunset = state.prayer.timings.sunset || "17:27";
    const fajr = state.prayer.timings.fajr || "04:43";
    const dhuhr = state.prayer.timings.dhuhr || "11:43";
    const asr = state.prayer.timings.asr || "15:01";
    const maghrib = state.prayer.timings.maghrib || "17:27";
    const isha = state.prayer.timings.isha || "18:43";

    function timeToMinutes(timeStr) {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    }

    const nowMinutes = d.getHours() * 60 + d.getMinutes();
    const nowSeconds = d.getSeconds();
    const nowTotalSec = nowMinutes * 60 + nowSeconds;

    const fMin = timeToMinutes(fajr);
    const dMin = timeToMinutes(dhuhr);
    const aMin = timeToMinutes(asr);
    const mMin = timeToMinutes(maghrib);
    const iMin = timeToMinutes(isha);

    let nextWaqt = "Fajr";
    let targetSec = 0;

    if (nowMinutes < fMin) {
      nextWaqt = "Fajr";
      targetSec = fMin * 60;
    } else if (nowMinutes < dMin) {
      nextWaqt = "Dhuhr";
      targetSec = dMin * 60;
    } else if (nowMinutes < aMin) {
      nextWaqt = "Asr";
      targetSec = aMin * 60;
    } else if (nowMinutes < mMin) {
      nextWaqt = "Maghrib";
      targetSec = mMin * 60;
    } else if (nowMinutes < iMin) {
      nextWaqt = "Isha";
      targetSec = iMin * 60;
    } else {
      nextWaqt = "Fajr";
      targetSec = (fMin + 1440) * 60;
    }

    const diffSec = Math.max(0, targetSec - nowTotalSec);
    const diffH = String(Math.floor(diffSec / 3600)).padStart(2, "0");
    const diffM = String(Math.floor((diffSec % 3600) / 60)).padStart(2, "0");
    const diffS = String(diffSec % 60).padStart(2, "0");
    const countdownStr = `${diffH}:${diffM}:${diffS}`;

    const schedule = [
      {
        name: "Fajr",
        start: formatTime12(fajr, is12h),
        end: formatTime12(sunrise, is12h),
        active: nextWaqt === "Fajr",
        icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M4.93 10.93l2.83 2.83M2 18h20M7 18a5 5 0 0 1 10 0"/></svg>`,
      },
      {
        name: "Dhuhr",
        start: formatTime12(dhuhr, is12h),
        end: formatTime12(asr, is12h),
        active: nextWaqt === "Dhuhr",
        icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-6.5l-1.5 1.5m-7 7l-1.5 1.5m0-10l1.5 1.5m7 7l1.5 1.5"/></svg>`,
      },
      {
        name: "Asr",
        start: formatTime12(asr, is12h),
        end: formatTime12(maghrib, is12h),
        active: nextWaqt === "Asr",
        icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v6M9 12h6M17 18a5 5 0 0 0-10 0M2 18h20"/></svg>`,
      },
      {
        name: "Maghrib",
        start: formatTime12(maghrib, is12h),
        end: formatTime12(isha, is12h),
        active: nextWaqt === "Maghrib",
        icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12v4M4.93 14.93l2.83-2.83M2 18h20M7 18a5 5 0 0 1 10 0"/></svg>`,
      },
      {
        name: "Isha",
        start: formatTime12(isha, is12h),
        end: formatTime12(fajr, is12h),
        active: nextWaqt === "Isha",
        icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
      },
    ];

    return `
      <div class="screen-inner theme-sim-shuttle">
        <!-- Top Row: Location & Live Status -->
        <div class="shuttle-top-row">
          <div>
            <div class="shuttle-loc">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #cbd5e1;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${state.weather.city || "Unavailable"}</span>
            </div>
            <div class="shuttle-date">${dateStr}</div>
          </div>
          <div class="shuttle-online-pill">
            <span class="anim-live-dot" style="display:inline-block; width:5px; height:5px; border-radius:50%; background:#22c55e;"></span>
            <span>ONLINE</span>
          </div>
        </div>

        <!-- Mid Strip: Space Shuttle Orbit Animation + Amber Clock & Sun Capsule -->
        <div class="shuttle-mid-strip">
          <div class="shuttle-anim-box">
            <div class="shuttle-star" style="top: 5px; left: 10px; animation-delay: 0.2s;"></div>
            <div class="shuttle-star" style="top: 26px; left: 22px; animation-delay: 0.9s;"></div>
            <div class="shuttle-star" style="top: 8px; right: 12px; animation-delay: 1.6s;"></div>
            <div class="shuttle-craft">
              <svg width="44" height="24" viewBox="0 0 72 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Energetic Plasma Thruster Flame -->
                <g class="shuttle-thruster">
                  <path d="M2 20 Q12 16 18 19 L18 21 Q12 24 2 20 Z" fill="url(#shuttlePlume)" opacity="0.95"/>
                  <path d="M8 20 Q14 18 18 19.5 L18 20.5 Q14 22 8 20 Z" fill="#ffffff"/>
                </g>
                <!-- Delta Wings -->
                <path d="M18 20 L30 11 L48 18 L64 20 L48 22 L30 29 Z" fill="#f8fafc" stroke="#334155" stroke-width="0.8"/>
                <!-- Black Thermal Tiles on Leading Wing Edges -->
                <path d="M18 20 L28 12 L32 12 L19 20 L32 28 L28 28 Z" fill="#0f172a"/>
                <!-- Fuselage -->
                <path d="M20 18 Q42 16 66 20 Q42 24 20 22 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.7"/>
                <!-- Black Thermal Nose Cone -->
                <path d="M60 19 Q66 20 68 20 Q66 20 60 21 Z" fill="#0f172a"/>
                <!-- Cockpit Windshield (Cyan Reflection) -->
                <path d="M52 18.5 Q57 18.2 59 19.2 L57 20 Q54 19.2 52 18.5 Z" fill="#38bdf8"/>
                <!-- Vertical Stabilizer Tail Fin -->
                <path d="M20 19 L26 8 L32 8 L28 19 Z" fill="#e2e8f0" stroke="#475569" stroke-width="0.6"/>
                <path d="M22 17 L25 10 L27 10 L24 17 Z" fill="#ef4444" opacity="0.9"/>
                <!-- Rocket Engine Nozzle Bells -->
                <rect x="17" y="18" width="2.5" height="4" rx="1" fill="#334155"/>
                <defs>
                  <linearGradient id="shuttlePlume" x1="0" y1="20" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0"/>
                    <stop offset="35%" stop-color="#0284c7" stop-opacity="0.8"/>
                    <stop offset="70%" stop-color="#f97316"/>
                    <stop offset="100%" stop-color="#fef08a"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div class="shuttle-time-capsule">
            <div class="shuttle-time-display">
              ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
              ${is12h ? `<span class="shuttle-ampm">${ampm}</span>` : ""}
            </div>
            <div class="shuttle-sun-pill">
              <div class="sun-cell">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M19.07 4.93l-2.12 2.12M22 12h-3M7 17a5 5 0 0 1 10 0M2 19h20"/></svg>
                <span class="sun-label">Sunrise</span>
                <span class="sun-val">${formatTime12(sunrise, is12h)}</span>
              </div>
              <div style="width: 1px; height: 9px; background: rgba(255, 255, 255, 0.15);"></div>
              <div class="sun-cell">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><path d="M12 17v4M4.93 14.93l2.12-2.12M19.07 14.93l-2.12-2.12M7 12a5 5 0 0 1 10 0M2 17h20M2 21h20"/></svg>
                <span class="sun-label">Sunset</span>
                <span class="sun-val">${formatTime12(sunset, is12h)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Prayer Timetable Grid -->
        <div class="shuttle-table">
          <div class="shuttle-row-head">
            <span>PRAYER</span>
            <span style="text-align: center;">START</span>
            <span style="text-align: right;">END</span>
          </div>
          ${schedule
            .map(
              (p) => `
            <div class="shuttle-row ${p.active ? "is-active-waqt" : ""}">
              <div class="prayer-name">
                <span style="display:inline-flex; align-items:center; color:${p.active ? "#fbbf24" : "#94a3b8"};">${p.icon}</span>
                <span>${p.name}</span>
              </div>
              <div class="time-center">${p.start}</div>
              <div class="time-right">${p.end}</div>
            </div>
          `
            )
            .join("")}
        </div>

        <!-- Bottom Hero Countdown Card -->
        <div class="shuttle-countdown-card">
          <div class="shuttle-countdown-left">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
            <div style="width: 1px; height: 16px; background: rgba(245, 158, 11, 0.35);"></div>
            <div class="shuttle-countdown-text">
              <span class="shuttle-next-waqt">NEXT: ${nextWaqt.toUpperCase()}</span>
              <span class="shuttle-starts-in">STARTS IN</span>
            </div>
          </div>
          <div class="shuttle-timer-box">
            <div class="shuttle-timer-digits">${countdownStr}</div>
            <div class="shuttle-timer-labels">HRS &nbsp; MIN &nbsp; SEC</div>
          </div>
        </div>
      </div>
    `;
  }

  if (theme === "Photo Frame & Ambient Album") {
    const hasPhoto = state.media && (state.media.activePhotoUrl || (state.media.files && state.media.files.length > 0 && state.media.files[0].url));
    const photoUrl = hasPhoto ? (state.media.activePhotoUrl || state.media.files[0].url) : null;

    return `
      <div class="screen-inner theme-sim-photo-album" style="position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        ${photoUrl ? `
          <img src="${photoUrl}" alt="Photo Frame Preview" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 2px 8px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
            <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: #fff;">
              ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
            </span>
            ${is12h ? `<span style="font-size: 8px; font-weight: 700; color: #f59e0b;">${ampm}</span>` : ""}
          </div>
        ` : `
          <div style="text-align: center; padding: 1.5rem; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; box-sizing: border-box;">
            <div style="width: 52px; height: 52px; border: 2px dashed #475569; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; background: #0f172a;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; letter-spacing: 0.05em; margin-bottom: 4px;">PHOTO FRAME</div>
            <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">No photo uploaded yet</div>
            <div style="font-size: 9px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; padding: 2px 6px;">
              Upload at #media
            </div>
          </div>
        `}
      </div>
    `;
  }

  // Default: Weather & Prayer Station
  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const curMin1 = d.getHours() * 60 + d.getMinutes();
  const fMin1 = timeToMinutes(state.prayer.timings.fajr || "04:43");
  const dMin1 = timeToMinutes(state.prayer.timings.dhuhr || "11:43");
  const aMin1 = timeToMinutes(state.prayer.timings.asr || "15:01");
  const mMin1 = timeToMinutes(state.prayer.timings.maghrib || "17:27");
  const iMin1 = timeToMinutes(state.prayer.timings.isha || "18:43");

  let nextName1 = "FAJR";
  let activeKey1 = "FAJR";
  if (curMin1 < fMin1) {
    nextName1 = "FAJR";
    activeKey1 = "FAJR";
  } else if (curMin1 < dMin1) {
    nextName1 = "DHUHR";
    activeKey1 = "DHU";
  } else if (curMin1 < aMin1) {
    nextName1 = "ASR";
    activeKey1 = "ASR";
  } else if (curMin1 < mMin1) {
    nextName1 = "MAGHRIB";
    activeKey1 = "MAG";
  } else if (curMin1 < iMin1) {
    nextName1 = "ISHA";
    activeKey1 = "ISHA";
  } else {
    nextName1 = "FAJR";
    activeKey1 = "FAJR";
  }

  const waqts = [
    { name: "FAJR", time: formatTime12(state.prayer.timings.fajr || "04:43", is12h), next: activeKey1 === "FAJR" },
    { name: "DHU", time: formatTime12(state.prayer.timings.dhuhr || "11:43", is12h), next: activeKey1 === "DHU" },
    { name: "ASR", time: formatTime12(state.prayer.timings.asr || "15:01", is12h), next: activeKey1 === "ASR" },
    { name: "MAG", time: formatTime12(state.prayer.timings.maghrib || "17:27", is12h), next: activeKey1 === "MAG" },
    { name: "ISHA", time: formatTime12(state.prayer.timings.isha || "18:43", is12h), next: activeKey1 === "ISHA" },
  ];

  return `
    <div class="screen-inner theme-sim-prayer">
      <div class="sim-header">
        <span style="color: #ffffff;">${state.weather.city}</span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: #38bdf8; font-size: 9px;">ONLINE</span>
          <span class="anim-live-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
        </div>
      </div>

      <div class="sim-hero-row">
        <div style="position: relative; width: 54px; height: 42px;">
          <div class="anim-sun" style="position: absolute; top: 2px; left: 6px; width: 24px; height: 24px; border-radius: 50%; background: #fda000; border: 2px solid #ea580c;"></div>
          <div class="anim-cloud" style="position: absolute; bottom: 0; left: 10px; width: 40px; height: 22px; background: #e2e8f0; border-radius: 12px; opacity: 0.95; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>
        </div>
        <div>
          <div class="sim-time-huge">
            ${hh}<span class="clock-colon ${state.time.colonBlink ? "blink" : ""}">:</span>${mm}
            ${is12h ? `<span style="font-size: 11px; color: #fde047; vertical-align: top; margin-left: 2px;">${ampm}</span>` : ""}
          </div>
          <div class="sim-date-tag">${dateStr}</div>
        </div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; font-size: 7px; margin-bottom: 2px;">
          <span style="color: #64748b; font-weight: 700;">SALAH SCHEDULE</span>
          <span style="color: #fda000; font-weight: 700;">NEXT: ${nextName1}</span>
        </div>
        <div class="sim-waqt-strip">
          ${waqts.map(w => `
            <div class="sim-waqt-cell ${w.next ? "is-next anim-next-waqt" : ""}">
              <span class="sim-waqt-name">${w.name}</span>
              <span class="sim-waqt-time">${w.time}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 700; margin: 1px 0;">
        <span style="color: #ffffff; font-size: 10px;">Broken clouds</span>
        <span style="color: #fde047; font-size: 12px;">--</span>
      </div>

      <div class="sim-telemetry-row">
        <div class="sim-tele-item">
          <span class="sim-tele-label" style="color: #f97316;">Temp</span>
          <span class="sim-tele-val" style="color: #fde047;">--</span>
        </div>
        <div class="sim-tele-item">
          <span class="sim-tele-label" style="color: #38bdf8;">Humidity</span>
          <span class="sim-tele-val" style="color: #7dd3fc;">64%</span>
        </div>
        <div class="sim-tele-item">
          <span class="sim-tele-label" style="color: #fb923c;">Sunset</span>
          <span class="sim-tele-val" style="color: #fde047;">${formatTime12(state.prayer.timings.sunset || state.weather.sunset || "17:27", is12h)}</span>
        </div>
      </div>
    </div>
  `;
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
        <p class="metric-detail">${state.network.ssid} (${state.network.signal == null ? "--" : `${state.network.signal}%`}) · ${state.device.ip}</p>
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
        <p class="section-subtitle">Real-time simulation of the active theme (<strong>${state.display.theme}</strong>) with kinetic physics animations.</p>
      </div>
      <div class="screen-frame">
        ${renderThemeSimulation(state)}
      </div>
    </section>

    <section class="details-panel" aria-labelledby="ai-telemetry-title">
      <div>
        <p class="section-kicker">Live AI Telemetry</p>
        <h2 id="ai-telemetry-title">Active AI Agent & Model</h2>
      </div>
      <dl class="details-list">
        <div><dt>AI Provider</dt><dd><strong data-telemetry="provider">${escapeHtml(state.tokens.provider || "Waiting for stream")}</strong></dd></div>
        <div><dt>Active AI Model</dt><dd><span class="tag-badge font-mono" style="font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;" data-telemetry="model">${escapeHtml(state.tokens.model || "Waiting for sync")}</span></dd></div>
        <div><dt>Agent Live Status</dt><dd><span class="status-indicator ${state.tokens.agentState === "WORKING" ? "is-working" : (state.tokens.isLaptopOnline ? "is-online" : "is-idle")}"></span> <span data-telemetry="agentState">${escapeHtml(state.tokens.agentState || "IDLE")}</span></dd></div>
        <div><dt>${escapeHtml(state.tokens.sessionLabel || "5-Hour Limit")}</dt><dd data-telemetry="sessionPct">${state.tokens.sessionPct != null ? `${state.tokens.sessionPct}% (${state.tokens.sessionReset || "--"})` : "Unavailable"}</dd></div>
        <div><dt>${escapeHtml(state.tokens.weeklyLabel || "Weekly Limit")}</dt><dd data-telemetry="weeklyPct">${state.tokens.weeklyPct != null ? `${state.tokens.weeklyPct}% (${state.tokens.weeklyReset || "--"})` : "Unavailable"}</dd></div>
        <div><dt>Active Turn Tokens</dt><dd data-telemetry="sessionTokens">${state.tokens.sessionTokens ? `${state.tokens.sessionTokens.toLocaleString()} tok` : "--"}</dd></div>
        <div><dt>Session Total Tokens</dt><dd data-telemetry="weeklyTokens">${state.tokens.weeklyTokens ? `${state.tokens.weeklyTokens.toLocaleString()} tok` : "--"}</dd></div>
        <div><dt>Telemetry Source</dt><dd><code data-telemetry="sourceLabel">${escapeHtml(state.tokens.sourceLabel || "Local companion stream")}</code></dd></div>
      </dl>
    </section>

    <section class="details-panel" aria-labelledby="device-summary-title">
      <div>
        <p class="section-kicker">Device summary</p>
        <h2 id="device-summary-title">Hardware & Firmware Telemetry</h2>
      </div>
      <dl class="details-list">
        <div><dt>Hardware Model</dt><dd>${state.device.model}</dd></div>
        <div><dt>Active AI Model</dt><dd><strong data-telemetry="model">${escapeHtml(state.tokens.model || "None")}</strong></dd></div>
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
  const liveProvider = escapeHtml(state.tokens.provider || "Unavailable");
  const liveModel = escapeHtml(state.tokens.model || "No live stream");

  return `
    <section class="details-panel">
      <div>
        <p class="section-kicker">Display Themes</p>
        <h2>Select Screen Theme</h2>
        <p class="section-subtitle">Click any theme below to activate it on your SmallTV and see an instant kinetic live simulation.</p>
      </div>
      <div class="theme-grid">
        ${themes.map((t) => {
          const isCurrent = state.display.theme === t;
          return `
            <button type="button" class="theme-card ${isCurrent ? "is-selected" : ""}" data-action="select-theme" data-theme="${t}">
              <div class="theme-card-indicator"></div>
              <div class="theme-card-info">
                <span class="theme-name">${t}</span>
                <span class="theme-meta">${isCurrent ? "✓ Active on SmallTV" : "Click to select"}</span>
              </div>
            </button>
          `;
        }).join("")}
      </div>

      <div style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <p class="section-kicker">Real-Time Simulation</p>
            <h3 style="font-size: 1rem; font-weight: 700; margin: 0;">Selected Theme: ${state.display.theme}</h3>
          </div>
          ${state.display.autoSwitch ? `
            <div class="loop-badge">
              <span class="anim-live-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
              Dynamic Loop Active (${state.display.switchInterval}s)
            </div>
          ` : ""}
        </div>
        <p class="section-subtitle">Simulating live hardware ST7789 IPS output with responsive kinetic physics animations.</p>
        <div class="screen-frame my-3">
          ${renderThemeSimulation(state)}
        </div>
      </div>
    </section>

    <section class="details-panel">
      <div><p class="section-kicker">Device Feature Inputs</p><h2>Now Playing, Focus & Notices</h2>
        <p class="section-subtitle">The ESP8266 receives compact metadata and status values; video playback stays on your laptop or phone.</p></div>
      <div class="input-grid">
        <div class="col-span-2"><label for="now-playing-url">YouTube / media link</label><input id="now-playing-url" class="text-input" type="url" placeholder="Paste a link for metadata" value="${escapeHtml(state.media.nowPlaying?.url || "")}" data-featurefield="nowPlaying" data-featurekey="url" /></div>
        <div><label for="now-playing-title">Now Playing title</label><input id="now-playing-title" class="text-input" value="${escapeHtml(state.media.nowPlaying?.title || "")}" data-featurefield="nowPlaying" data-featurekey="title" /></div>
        <div><label for="now-playing-source">Channel / app</label><input id="now-playing-source" class="text-input" value="${escapeHtml(state.media.nowPlaying?.source || "")}" data-featurefield="nowPlaying" data-featurekey="source" /></div>
        <div><label for="focus-minutes">Pomodoro minutes</label><input id="focus-minutes" class="text-input" type="number" min="1" max="120" value="${state.focus?.minutes || 25}" data-featurefield="focus" /></div>
        <div><label for="device-notice">Device notice</label><input id="device-notice" class="text-input" value="${escapeHtml(state.notificationCenter?.message || "")}" data-featurefield="notificationCenter" /></div>
      </div>
    </section>

    <section class="details-panel">
      <div>
        <p class="section-kicker">Backlight & Dynamic Rotation</p>
        <h2>Brightness & Auto-Rotate Controls</h2>
        <p class="section-subtitle">Configure screen brightness and auto-switch intervals for cycling through themes.</p>
      </div>
      <div class="control-stack">
        <label for="brightness">Day Brightness <output for="brightness" class="tag-badge">${state.display.brightness}%</output></label>
        <input id="brightness" name="brightness" type="range" min="0" max="100" value="${state.display.brightness}" class="slider" />
        
        <div style="border-top: 1px solid var(--color-line); padding-top: 1rem; margin-top: 0.5rem;">
          <label class="check-control" for="auto-switch">
            <input id="auto-switch" name="auto-switch" type="checkbox"${state.display.autoSwitch ? " checked" : ""} />
            <span style="font-weight: 600;">Rotate display themes automatically (Dynamic Loop)</span>
          </label>
          <p class="section-subtitle" style="margin-left: 1.75rem; margin-bottom: 0.75rem;">
            When enabled, SmallTV and this web dashboard automatically loop through selected themes sequentially.
          </p>

          ${state.display.autoSwitch ? `
            <div style="margin-left: 1.75rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <label for="switch-interval" style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Rotation Interval</label>
                <select id="switch-interval" class="text-input" style="max-width: 260px;">
                  <option value="10"${state.display.switchInterval === 10 ? " selected" : ""}>Every 10 Seconds (Fast Demo)</option>
                  <option value="15"${state.display.switchInterval === 15 ? " selected" : ""}>Every 15 Seconds (Recommended)</option>
                  <option value="30"${state.display.switchInterval === 30 ? " selected" : ""}>Every 30 Seconds</option>
                  <option value="60"${state.display.switchInterval === 60 ? " selected" : ""}>Every 60 Seconds (1 minute)</option>
                  <option value="120"${state.display.switchInterval === 120 ? " selected" : ""}>Every 120 Seconds (2 minutes)</option>
                  <option value="custom"${[10, 15, 30, 60, 120].includes(Number(state.display.switchInterval)) ? "" : " selected"}>Custom</option>
                </select>
                <label for="switch-interval-custom" style="font-size: 0.8rem; color: var(--color-muted); display: block; margin-top: 0.5rem;">Custom seconds (5–3600)</label>
                <input id="switch-interval-custom" class="text-input" type="number" min="5" max="3600" step="1" placeholder="Enter seconds" value="${[10, 15, 30, 60, 120].includes(Number(state.display.switchInterval)) ? "" : state.display.switchInterval}" style="max-width: 260px;" />
              </div>

              <div>
                <span style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Themes Included in Rotation</span>
                <div class="theme-chip-group">
                  ${themes.map((t) => {
                    const active = state.display.activeThemes.includes(t);
                    return `
                      <button type="button" class="theme-chip ${active ? "is-active" : ""}" data-action="toggle-active-theme" data-theme="${t}">
                        <span>${active ? "✓" : "+"}</span>
                        <span>${t}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    </section>

    <section class="details-panel" id="tokens-panel">
      <div>
        <p class="section-kicker">AI Coding Companion</p>
        <h2>AI Token & Rate Limit Monitor</h2>
        <p class="section-subtitle">Live telemetry for Claude, Gemini, OpenAI/Codex, or OpenCode with dual meter bars and color stops.</p>
      </div>
      <div class="input-grid">
        <div>
          <label for="token-provider">Detected AI Provider & Model</label>
          <select id="token-provider" class="text-input" data-tokenfield="provider" disabled>
            <optgroup label="Active Live Telemetry Stream">
              <option value="${liveProvider}:${liveModel}" selected>${liveProvider} &mdash; ${liveModel}</option>
            </optgroup>
            <optgroup label="Supported Providers">
              <option value="Gemini:Live">Google Gemini (Antigravity)</option>
              <option value="Codex:Live">OpenAI Codex</option>
              <option value="Claude:Live">Anthropic Claude</option>
              <option value="OpenCode:Live">OpenCode / Local Models</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label for="agent-state">Agent Live Status</label>
          <select id="agent-state" class="text-input" data-tokenfield="agentState" disabled>
            <option value="IDLE"${state.tokens.agentState === "IDLE" ? " selected" : ""}>IDLE (Green - Waiting for task)</option>
            <option value="WORKING"${state.tokens.agentState === "WORKING" ? " selected" : ""}>WORKING (Orange - Streaming output)</option>
            <option value="WAITING"${state.tokens.agentState === "WAITING" ? " selected" : ""}>WAITING (Cyan - User prompt)</option>
          </select>
        </div>
        <div>
          <label class="check-control" style="margin-top: 1.8rem;" for="laptop-sync-toggle">
            <input id="laptop-sync-toggle" type="checkbox"${state.tokens.isLaptopOnline ? " checked" : ""} disabled />
            <span>${state.tokens.telemetryState === "live" ? "Live provider stream" : "No live provider stream"}</span>
          </label>
        </div>
      </div>

      <div class="input-grid" style="margin-top: 1rem;">
        <div>
          <label for="session-tokens">
            <span id="session-limit-label">${state.tokens.sessionLabel || "5-HOUR LIMIT"} Remaining:</span>
            <output id="session-limit-output" class="tag-badge">${state.tokens.sessionPct == null ? "Unavailable" : `${state.tokens.sessionPct}% (${state.tokens.sessionReset || "--"})`}</output>
          </label>
          <input id="session-tokens" type="range" min="0" max="100" value="${state.tokens.sessionPct ?? 0}" class="slider" disabled />
        </div>
        <div>
          <label for="weekly-tokens">
            <span id="weekly-limit-label">${state.tokens.weeklyLabel || "7-DAY LIMIT"} Remaining:</span>
            <output id="weekly-limit-output" class="tag-badge">${state.tokens.weeklyPct == null ? "Unavailable" : `${state.tokens.weeklyPct}% (${state.tokens.weeklyReset || "--"})`}</output>
          </label>
          <input id="weekly-tokens" type="range" min="0" max="100" value="${state.tokens.weeklyPct ?? 0}" class="slider" disabled />
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <span style="font-weight: 700; font-size: 0.85rem; display: block; margin-bottom: 0.5rem; color: var(--color-ink);">Live Agent & Model Telemetry</span>
        <dl class="details-list">
          <div><dt>Detected Provider</dt><dd><strong data-telemetry="provider">${escapeHtml(state.tokens.provider || "None")}</strong></dd></div>
          <div><dt>Active AI Model</dt><dd><span class="tag-badge font-mono" style="font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;" data-telemetry="model">${escapeHtml(state.tokens.model || "Waiting for sync")}</span></dd></div>
          <div><dt>Agent Live Status</dt><dd><span class="status-indicator ${state.tokens.agentState === "WORKING" ? "is-working" : (state.tokens.isLaptopOnline ? "is-online" : "is-idle")}"></span> <span data-telemetry="agentState">${escapeHtml(state.tokens.agentState || "IDLE")}</span></dd></div>
          <div><dt>Session Context</dt><dd data-telemetry="sessionTokens">${state.tokens.sessionTokens ? `${state.tokens.sessionTokens.toLocaleString()} / ${state.tokens.sessionLimit ? state.tokens.sessionLimit.toLocaleString() : "--"} tok` : "--"}</dd></div>
          <div><dt>Session Total</dt><dd data-telemetry="weeklyTokens">${state.tokens.weeklyTokens ? `${state.tokens.weeklyTokens.toLocaleString()} tok` : "--"}</dd></div>
          <div><dt>Observed Source</dt><dd><code data-telemetry="sourceLabel">${escapeHtml(state.tokens.sourceLabel || "Local companion stream")}</code></dd></div>
        </dl>
      </div>

      <details style="background: #f8fafc; border: 1px solid var(--color-line); border-radius: 6px; padding: 0.85rem; margin-top: 1rem; font-size: 0.8rem; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: auto;">
        <summary style="cursor:pointer; font-weight:700;">Advanced companion diagnostics</summary>
        <span style="font-weight: 700; display: block; margin-bottom: 0.35rem; color: var(--color-ink);">Laptop Background Push Command</span>
        <p class="section-subtitle" style="margin: 0 0 0.5rem 0;">Run this curl command or companion daemon on your laptop to push live percentage telemetry to your SmallTV:</p>
        <code style="display: block; font-size: 0.75rem; color: #0284c7; background: #ffffff; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--color-line); overflow-x: auto; white-space: pre-wrap; word-break: break-all;">curl -X POST http://${state.device.ip}/api/tokens -H "Content-Type: application/json" -d '{"provider":"${state.tokens.provider}","model":"${state.tokens.model || "Waiting for sync"}","sessionLabel":"${state.tokens.sessionLabel || "5-HOUR LIMIT"}","sessionPct":${state.tokens.sessionPct ?? 0},"sessionText":"${state.tokens.sessionText || "Unavailable"}","sessionReset":"${state.tokens.sessionReset || "--"}","weeklyLabel":"${state.tokens.weeklyLabel || "7-DAY LIMIT"}","weeklyPct":${state.tokens.weeklyPct ?? 0},"weeklyText":"${state.tokens.weeklyText || "Unavailable"}","weeklyReset":"${state.tokens.weeklyReset || "--"}","agentState":"${state.tokens.agentState}"}'</code>
      </details>
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
  const t = p.timings || { fajr: "--", dhuhr: "--", asr: "--", maghrib: "--", isha: "--" };
  const is12h = state.time.hourFormat === "12-Hour";
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
          <input id="prayer-city" type="text" value="${p.city || "Unavailable"}" class="text-input" data-prayerfield="city" />
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
        <p style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem;">Live Prayer Schedule for ${p.city || "Unavailable"}</p>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; text-align: center;">
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">FAJR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${formatTime12(t.fajr, is12h, true)}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">DHUHR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${formatTime12(t.dhuhr, is12h, true)}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">ASR</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${formatTime12(t.asr, is12h, true)}</div>
          </div>
          <div style="padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">MAGHRIB</div>
            <div style="font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${formatTime12(t.maghrib, is12h, true)}</div>
          </div>
          <div style="padding: 0.5rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;">
            <div style="font-size: 0.75rem; color: #b45309; font-weight: 700;">ISHA</div>
            <div style="font-family: monospace; font-weight: 700; color: #92400e; margin-top: 0.25rem;">${formatTime12(t.isha, is12h, true)}</div>
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
        ${state.time.clockStyle === "analog" ? renderThemeSimulation({ ...state, display: { ...state.display, theme: "Analog Calendar Clock" } }) : `<div class="screen-inner">
          <div class="screen-top-bar">
            <span>${state.weather.city} --${state.weather.tempUnit}</span>
            <span>Wi-Fi ${state.network.signal == null ? "--" : `${state.network.signal}%`}</span>
          </div>
          ${renderClockDigits(state.time.colors, state.time.hourFormat, state.time.colonBlink)}
          <div class="screen-bottom-bar">
            <span>${formatDatePreview(state.time.dateFormat)}</span>
            <span>${state.time.hourFormat}</span>
          </div>
        </div>`}
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
          <label for="clock-style">Clock Style</label>
          <select id="clock-style" class="select-input" data-timefield="clockStyle">
            <option value="digital"${state.time.clockStyle !== "analog" ? " selected" : ""}>Digital clock</option>
            <option value="analog"${state.time.clockStyle === "analog" ? " selected" : ""}>Analogue clock + 3 calendars</option>
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
  const isPhotoTheme = state.display.theme === "Photo Frame & Ambient Album";
  const activePhoto = state.media.activePhotoUrl || (state.media.files.length > 0 ? state.media.files[0].url : null);

  return `
    <section class="details-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <p class="section-kicker">Display Mode</p>
          <h2>Photo Album & Ambient Frame</h2>
          <p class="section-subtitle">Show custom artwork, photos, or ambient GIFs on the 240×240 ST7789 screen.</p>
        </div>
        <div>
          ${isPhotoTheme
            ? `<span class="tag-badge" style="background:#dcfce7; color:#15803d; border-color:#86efac; padding:6px 12px; font-size:0.82rem;">✓ Active on SmallTV Display</span>`
            : `<button type="button" class="btn-primary" data-action="activate-photo-theme" style="padding: 6px 14px;">Activate Photo Frame Theme</button>`}
        </div>
      </div>
      <div class="control-stack mt-4">
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
        <p class="section-kicker">Image Upload & Converter</p>
        <h2>Upload Photo (Auto-Converted to 240×240)</h2>
        <p class="section-subtitle">Drop any picture below. It will automatically crop and convert to native 240×240 ST7789 display format.</p>
      </div>

      <!-- Hidden file input for file picker -->
      <input type="file" id="media-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display: none;" />

      <!-- Interactive Dropzone -->
      <div id="media-dropzone" class="dropzone mt-4" data-action="trigger-file-input">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🖼️</div>
        <p style="font-size: 1rem; color: var(--color-ink); margin-bottom: 0.25rem;">
          <strong>Click to select photo</strong> or drag & drop here
        </p>
        <span class="dropzone-hint">Supports JPG, PNG, GIF, WebP &middot; Browser automatically scales to 240&times;240px</span>
        <button type="button" class="btn-secondary mt-3" data-action="trigger-file-input" style="pointer-events: none;">
          📁 Choose Image File
        </button>
      </div>

      <!-- Live upload progress status -->
      <div id="media-upload-status" style="display: none; margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;"></div>
    </section>

    <section class="details-panel">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p class="section-kicker">Storage (LittleFS)</p>
          <h2>Stored Media Gallery</h2>
          <p class="section-subtitle">Images stored in flash memory for the Photo Album theme.</p>
        </div>
        <span style="font-size: 0.8rem; color: var(--color-muted);">${state.media.files.length} items</span>
      </div>

      <div class="file-grid">
        ${state.media.files.map((file) => {
          const isActive = file.active || file.url === activePhoto;
          return `
            <div class="file-card ${isActive ? "is-active-media" : ""}">
              <div class="file-thumb">
                ${file.url
                  ? `<img src="${file.url}" alt="${escapeHtml(file.name)}" />`
                  : `<span style="font-size: 1.5rem;">🖼️</span>`}
              </div>
              <div class="file-info">
                <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="file-meta">${file.size || "115 KB"} &middot; ${file.type || "240×240"}</span>
                <div class="file-actions">
                  ${isActive
                    ? `<span style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">● Active on Screen</span>`
                    : `<button type="button" class="btn-sm" data-action="set-active-photo" data-name="${escapeHtml(file.name)}" data-url="${escapeHtml(file.url || "")}">Display</button>`}
                  <button type="button" class="btn-sm text-red-600" data-action="delete-photo" data-name="${escapeHtml(file.name)}">Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Supported Image Format Specifications Card -->
      <div class="media-spec-grid">
        <div class="media-spec-card">
          <div class="media-spec-label">Target Resolution</div>
          <div class="media-spec-val">240 &times; 240 px</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">1:1 Square IPS panel</div>
        </div>
        <div class="media-spec-card">
          <div class="media-spec-label">Color Format</div>
          <div class="media-spec-val">16-Bit RGB565</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">65,536 colors (Hardware)</div>
        </div>
        <div class="media-spec-card">
          <div class="media-spec-label">Input Formats</div>
          <div class="media-spec-val">JPG, PNG, WebP, GIF</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">Auto-scaled in browser</div>
        </div>
        <div class="media-spec-card">
          <div class="media-spec-label">Flash Partition</div>
          <div class="media-spec-val">LittleFS Flash</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">Preserved across reboots</div>
        </div>
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
        <button type="button" class="btn-secondary" data-action="device-reset">
          Erase settings & reconnect
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
          focus: { ...state.focus, ...(remoteSettings.focus || {}) },
          notificationCenter: { ...state.notificationCenter, ...(remoteSettings.notificationCenter || {}) },
        };
      }
      render();
    })();

    // Real-time live polling for AI agent token updates (auto-sync with companion)
    setInterval(async () => {
      const liveTokens = await api.getTokens();
      if (liveTokens && (
        liveTokens.telemetryState !== state.tokens.telemetryState ||
        liveTokens.sourceLabel !== state.tokens.sourceLabel ||
        (liveTokens.sessionTokens !== undefined && liveTokens.sessionTokens !== state.tokens.sessionTokens) ||
        (liveTokens.agentState !== undefined && liveTokens.agentState !== state.tokens.agentState) ||
        (liveTokens.model !== undefined && liveTokens.model !== state.tokens.model) ||
        (liveTokens.provider !== undefined && liveTokens.provider !== state.tokens.provider) ||
        (liveTokens.sessionPct !== undefined && liveTokens.sessionPct !== state.tokens.sessionPct) ||
        (liveTokens.weeklyPct !== undefined && liveTokens.weeklyPct !== state.tokens.weeklyPct)
      )) {
        state = {
          ...state,
          tokens: {
            ...state.tokens,
            ...liveTokens,
          },
        };
        // In-place preview update: prevents destroying whole page & eliminates dashboard flickering
        const screenFrames = document.querySelectorAll(".screen-frame");
        if (screenFrames.length > 0) {
          screenFrames.forEach(frame => {
            frame.innerHTML = renderThemeSimulation(state);
          });
        }
        updateTokenControls(state.tokens);
      }
    }, 2500);
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

    if (event.target.closest("[data-action='device-reset']")) {
      if (confirm("Erase Wi-Fi and device settings? The device will reboot into SmallTV-Setup and require reconnection.")) {
        api.resetDevice().then(() => {
          state = reduce(state, { type: "set-notification", message: "Settings erased; reconnect to SmallTV-Setup." });
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

    const chipBtn = event.target.closest("[data-action='toggle-active-theme']");
    if (chipBtn) {
      state = reduce(state, { type: "toggle-active-theme", theme: chipBtn.dataset.theme });
      render();
      triggerSave();
      syncAutoLoop();
      return;
    }

    const dialogBtn = event.target.closest("[data-action='mock-dialog']");
    if (dialogBtn) {
      state = reduce(state, { type: "set-notification", message: dialogBtn.dataset.msg });
      render();
      return;
    }

    if (event.target.closest("[data-action='trigger-file-input']")) {
      document.querySelector("#media-file-input")?.click();
      return;
    }

    if (event.target.closest("[data-action='activate-photo-theme']")) {
      state = reduce(state, { type: "set-theme", theme: "Photo Frame & Ambient Album" });
      render();
      triggerSave(true);
      return;
    }

    const setActivePhotoBtn = event.target.closest("[data-action='set-active-photo']");
    if (setActivePhotoBtn) {
      const name = setActivePhotoBtn.dataset.name;
      const url = setActivePhotoBtn.dataset.url;
      state = reduce(state, { type: "set-active-photo", name, url });
      state = reduce(state, { type: "set-theme", theme: "Photo Frame & Ambient Album" });
      render();
      triggerSave(true);
      return;
    }

    const deletePhotoBtn = event.target.closest("[data-action='delete-photo']");
    if (deletePhotoBtn) {
      const name = deletePhotoBtn.dataset.name;
      if (confirm(`Remove "${name}"?`)) {
        api.deleteMedia(name).then(() => {
          state = reduce(state, { type: "delete-media-file", name });
          render();
        });
      }
      return;
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.dataset.featurefield) {
      state = reduce(state, {
        type: "set-feature-field",
        field: event.target.dataset.featurefield,
        key: event.target.dataset.featurekey,
        value: event.target.value,
      });
      const frame = document.querySelector(".screen-frame");
      if (frame) frame.innerHTML = renderThemeSimulation(state);
      triggerSave();
      return;
    }
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

    if (event.target.dataset.tokenfield) {
      state = reduce(state, {
        type: "set-token-field",
        field: event.target.dataset.tokenfield,
        value: event.target.value,
      });
      render();
      return;
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.id === "auto-switch") {
      state = reduce(state, { type: "toggle-auto-switch", value: event.target.checked });
      render();
      triggerSave();
      syncAutoLoop();
      return;
    }

    if (event.target.id === "switch-interval") {
      if (event.target.value !== "custom") {
        state = reduce(state, { type: "set-switch-interval", value: event.target.value });
        render();
        triggerSave();
        syncAutoLoop();
      }
      return;
    }

    if (event.target.id === "switch-interval-custom") {
      const seconds = Math.min(3600, Math.max(5, Number(event.target.value) || 15));
      state = reduce(state, { type: "set-switch-interval", value: seconds });
      render();
      triggerSave();
      syncAutoLoop();
      return;
    }

    if (event.target.id === "laptop-sync-toggle") {
      state = reduce(state, { type: "toggle-laptop-sync", value: event.target.checked });
      render();
      return;
    }

    if (event.target.dataset.tokenfield) {
      state = reduce(state, {
        type: "set-token-field",
        field: event.target.dataset.tokenfield,
        value: event.target.value,
      });
      render();
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

    if (event.target.id === "media-file-input") {
      if (event.target.files && event.target.files[0]) {
        handlePhotoUpload(event.target.files[0]);
      }
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

  function handlePhotoUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
      state = reduce(state, { type: "set-notification", message: "Please select an image file (JPG, PNG, GIF, WebP)." });
      render();
      return;
    }

    const statusEl = document.querySelector("#media-upload-status");
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.style.background = "#e0f2fe";
      statusEl.style.color = "#0369a1";
      statusEl.textContent = `Optimizing "${file.name}" to 240×240 for ST7789 display...`;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");

        const scale = Math.max(240 / img.width, 240 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (240 - w) / 2;
        const y = (240 - h) / 2;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 240, 240);
        ctx.drawImage(img, x, y, w, h);

        const previewUrl = canvas.toDataURL("image/jpeg", 0.9);
        const imgData = ctx.getImageData(0, 0, 240, 240).data;

        // 240 * 240 * 2 = 115,200 bytes RGB565
        const rgb565 = new Uint8Array(240 * 240 * 2);
        for (let i = 0, j = 0; i < imgData.length; i += 4, j += 2) {
          const r = imgData[i] >> 3;
          const g = imgData[i + 1] >> 2;
          const b = imgData[i + 2] >> 3;
          const pixel = (r << 11) | (g << 5) | b;
          rgb565[j] = (pixel >> 8) & 0xff;
          rgb565[j + 1] = pixel & 0xff;
        }

        if (statusEl) {
          statusEl.textContent = `Writing 115 KB RGB565 frame to LittleFS flash...`;
        }

        api.uploadMedia(rgb565, file.name).then((res) => {
          const newFile = {
            name: file.name,
            size: "115 KB",
            type: "RGB565 (240×240)",
            url: previewUrl,
            active: true,
          };
          state = reduce(state, { type: "add-media-file", file: newFile });
          state = reduce(state, { type: "set-theme", theme: "Photo Frame & Ambient Album" });
          render();
          triggerSave(true);
        }).catch((err) => {
          if (statusEl) {
            statusEl.style.background = "#fee2e2";
            statusEl.style.color = "#b91c1c";
            statusEl.textContent = `Upload failed: ${err.message}`;
          }
        });
      };
      img.onerror = () => {
        if (statusEl) {
          statusEl.style.background = "#fee2e2";
          statusEl.style.color = "#b91c1c";
          statusEl.textContent = "Failed to decode image.";
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Drag and Drop listeners
  app.addEventListener("dragover", (event) => {
    const dropzone = event.target.closest("#media-dropzone");
    if (dropzone) {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    }
  });

  app.addEventListener("dragleave", (event) => {
    const dropzone = event.target.closest("#media-dropzone");
    if (dropzone) {
      dropzone.classList.remove("is-dragover");
    }
  });

  app.addEventListener("drop", (event) => {
    const dropzone = event.target.closest("#media-dropzone");
    if (dropzone) {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
        handlePhotoUpload(event.dataTransfer.files[0]);
      }
    }
  });

  let autoLoopTimer = null;
  function syncAutoLoop() {
    if (autoLoopTimer) {
      clearInterval(autoLoopTimer);
      autoLoopTimer = null;
    }
    if (!state.display.autoSwitch) return;

    const intervalSec = Math.max(5, Number(state.display.switchInterval) || 15);
    autoLoopTimer = setInterval(() => {
      const list = state.display.activeThemes && state.display.activeThemes.length > 0
        ? state.display.activeThemes
        : themes;
      const curIdx = list.indexOf(state.display.theme);
      const nextIdx = (curIdx + 1) % list.length;
      state = reduce(state, { type: "set-theme", theme: list[nextIdx] });
      // In-place screen frame update to eliminate page flicker during auto-rotation
      const screenFrames = document.querySelectorAll(".screen-frame");
      if (screenFrames.length > 0) {
        screenFrames.forEach(frame => {
          frame.innerHTML = renderThemeSimulation(state);
        });
      }
      document.querySelectorAll(".theme-card").forEach(card => {
        const isCurrent = card.dataset.theme === state.display.theme;
        card.classList.toggle("is-selected", isCurrent);
        const meta = card.querySelector(".theme-meta");
        if (meta) meta.innerText = isCurrent ? "✓ Active on SmallTV" : "Click to select";
      });
    }, intervalSec * 1000);
  }

  syncAutoLoop();
  render();
}
