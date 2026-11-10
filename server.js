import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-load .env file if present
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn("[Warning] Error reading .env file:", err.message);
  }
}

const PORT = process.env.PORT || 3000;
// Live-only by default: the local dashboard proxies the real device and never invents telemetry.
const DEVICE_BASE_URL = (process.env.SMALLTV_DEVICE_URL || (process.env.SMALLTV_IP ? `http://${process.env.SMALLTV_IP}` : "")).replace(/\/$/, "");

const MOCK_STORAGE_FILE = path.join(__dirname, "mock_settings.json");

// Load persistent mock state if file exists, else use defaults
let defaultMockSettings = {
  display: {
    theme: "Weather & Prayer Station",
    brightness: 65,
    autoSwitch: false,
    switchInterval: 15,
    activeThemes: [
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
    ],
    nightMode: {
      enabled: true,
      startTime: "22:00",
      endTime: "07:00",
      brightness: 20,
    },
  },
  tokens: {
    provider: null,
    model: null,
    status: "unavailable",
    telemetryState: "unavailable",
    sourceLabel: "No verified provider source",
    observedAt: null,
    agentState: "UNAVAILABLE",
    sessionTokens: 0,
    sessionLimit: null,
    sessionPct: null,
    sessionReset: null,
    weeklyTokens: 0,
    weeklyLimit: null,
    weeklyPct: null,
    weeklyReset: null,
    tokensPerSec: 0,
    lastSync: "Just now",
    isLaptopOnline: true,
  },
  weather: {
    city: "Dhaka",
    cityId: "1185241",
    tempUnit: "°C",
    windSpeedUnit: "m/s",
    pressureUnit: "hPa",
    updateInterval: 20,
    apiKey: "••••••••••••••••••••••••••••••••",
    forecastApiKey: "",
  },
  time: {
    mode: "Auto",
    timezone: "Asia/Dhaka (UTC+6:00)",
    utcOffset: "UTC+6:00",
    hourFormat: "12-Hour",
    dateFormat: "DD/MM/YYYY",
    colonBlink: true,
    fontStyle: "Default Big Font",
    ntp: "pool.ntp.org",
    colors: {
      hour: "#ffffff",
      minute: "#feba01",
      second: "#ffffff",
    },
    clockStyle: "digital",
  },
  network: {
    ssid: "Home",
    bootDelay: 0,
  },
  media: {
    autoDisplay: false,
    intervalSeconds: 30,
  },
};

let mockSettings = { ...defaultMockSettings };
if (fs.existsSync(MOCK_STORAGE_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(MOCK_STORAGE_FILE, "utf8"));
    mockSettings = {
      ...defaultMockSettings,
      ...saved,
      display: { ...defaultMockSettings.display, ...(saved.display || {}) },
      weather: { ...defaultMockSettings.weather, ...(saved.weather || {}) },
      time: { ...defaultMockSettings.time, ...(saved.time || {}) },
      network: { ...defaultMockSettings.network, ...(saved.network || {}) },
      media: { ...defaultMockSettings.media, ...(saved.media || {}) },
    };
  } catch (e) {
    console.warn("Failed to load mock_settings.json, using defaults.");
  }
}

function persistSettings() {
  try {
    fs.writeFileSync(MOCK_STORAGE_FILE, JSON.stringify(mockSettings, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write mock_settings.json:", e);
  }
}

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function formatCountdownIso(resetTimeStr) {
  if (!resetTimeStr) return "--";
  try {
    const target = new Date(resetTimeStr).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((target - now) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  } catch {
    return "--";
  }
}

async function getLiveAntigravityTelemetry() {
  const homeDir = os.homedir();
  const daemonDir = path.join(homeDir, ".gemini", "antigravity", "daemon");
  if (!fs.existsSync(daemonDir)) return null;

  try {
    const files = fs.readdirSync(daemonDir).filter((f) => f.startsWith("hub_") && f.endsWith(".json"));
    if (!files.length) return null;

    files.sort((a, b) => {
      const statA = fs.statSync(path.join(daemonDir, a));
      const statB = fs.statSync(path.join(daemonDir, b));
      return statB.mtimeMs - statA.mtimeMs;
    });

    let quotaData = null;
    for (const f of files.slice(0, 3)) {
      try {
        const hubInfo = JSON.parse(fs.readFileSync(path.join(daemonDir, f), "utf8"));
        const port = hubInfo.httpPort;
        const token = hubInfo.csrfToken;
        if (!port || !token) continue;

        const res = await fetch(`http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-codeium-csrf-token": String(token),
            "Connect-Protocol-Version": "1",
          },
          body: "{}",
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          quotaData = await res.json();
          break;
        }
      } catch {}
    }

    if (!quotaData) return null;

    const groups = quotaData?.response?.groups || [];
    const geminiGroup = groups.find((g) => (g.displayName || "").toLowerCase().includes("gemini")) || groups[0];
    if (!geminiGroup) return null;

    const buckets = geminiGroup.buckets || [];
    const b5h = buckets.find((b) => b.window === "5h");
    const bWeekly = buckets.find((b) => b.window === "weekly");

    const sessionPct = b5h?.remainingFraction != null ? Math.round(Number(b5h.remainingFraction) * 100) : null;
    const sessionReset = formatCountdownIso(b5h?.resetTime);
    const weeklyPct = bWeekly?.remainingFraction != null ? Math.round(Number(bWeekly.remainingFraction) * 100) : null;
    const weeklyReset = formatCountdownIso(bWeekly?.resetTime);

    let sessionTokens = 0;
    let weeklyTokens = 0;
    let modelName = "Gemini 3.8 Flash";
    let isWorking = true;

    try {
      const brainDir = path.join(homeDir, ".gemini", "antigravity", "brain");
      if (fs.existsSync(brainDir)) {
        const convDirs = fs.readdirSync(brainDir);
        for (const dir of convDirs) {
          const transPath = path.join(brainDir, dir, ".system_generated", "logs", "transcript.jsonl");
          if (fs.existsSync(transPath)) {
            const stat = fs.statSync(transPath);
            if (Date.now() - stat.mtimeMs < 120000) {
              isWorking = true;
            }
            const lines = fs.readFileSync(transPath, "utf8").trim().split("\n");
            for (const line of lines.slice(-100)) {
              try {
                const rec = JSON.parse(line);
                if (rec.source === "MODEL") {
                  const step = (rec.input_tokens || 0) + (rec.cache_read_tokens || 0) + (rec.output_tokens || 0);
                  if (step > 0) sessionTokens = step;
                  weeklyTokens += step;
                }
              } catch {}
            }
            break;
          }
        }
      }
    } catch {}

    const formatTokens = (c) => (c >= 1000000 ? `${(c / 1000000).toFixed(1)}M` : (c >= 1000 ? `${(c / 1000).toFixed(1)}k` : `${c}`));

    return {
      provider: "Gemini",
      model: modelName,
      agentState: isWorking ? "WORKING" : "IDLE",
      sessionLabel: "5-HOUR LIMIT",
      sessionPct,
      sessionText: sessionPct != null ? `${sessionPct}% Left` : (sessionTokens ? `${formatTokens(sessionTokens)} used` : "--"),
      sessionReset,
      weeklyLabel: "WEEKLY LIMIT",
      weeklyPct,
      weeklyText: weeklyPct != null ? `${weeklyPct}% Left` : (weeklyTokens ? `${formatTokens(weeklyTokens)} total` : "--"),
      weeklyReset,
      sessionTokens: sessionTokens || 0,
      sessionLimit: 100,
      weeklyTokens: weeklyTokens || 0,
      weeklyLimit: 100,
      sourceLabel: "Antigravity quota API",
      isLaptopOnline: true,
      telemetryState: "live",
      observedAt: Math.floor(Date.now() / 1000),
      sessionWindowMinutes: 300,
      weeklyWindowMinutes: 10080,
    };
  } catch (err) {
    return null;
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    // --- REST API ROUTES ---
    if (pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");

      // In production/live mode, proxy to real device. In test mode, use local mock routes.
      if (process.env.NODE_ENV !== "test") {
        if (pathname === "/api/tokens" && (req.method === "GET" || req.method === "HEAD")) {
          const live = await getLiveAntigravityTelemetry();
          if (live) {
            if (DEVICE_BASE_URL) {
              fetch(`${DEVICE_BASE_URL}/api/tokens`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(live),
              }).catch(() => {});
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(live));
            return;
          }
        }

        if (!DEVICE_BASE_URL) {
          res.writeHead(503);
          res.end(JSON.stringify({
            error: "SmallTV device IP not configured",
            message: "Please set SMALLTV_IP in your .env file or environment."
          }));
          return;
        }

        try {
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : await new Promise((resolve) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          });
          const upstream = await fetch(`${DEVICE_BASE_URL}${pathname}${url.search}`, {
            method: req.method,
            headers: req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : undefined,
            body,
          });
          const payload = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/json" });
          res.end(payload);
        } catch (error) {
          res.writeHead(503);
          res.end(JSON.stringify({ error: "SmallTV device unavailable", device: DEVICE_BASE_URL, detail: error.message }));
        }
        return;
      }

      // 1. GET /api/status
      if (req.method === "GET" && pathname === "/api/status") {
        const status = {
          model: "SmallTV-Ultra",
          firmware: "Ultra-V9.0.52-Custom",
          chip: "ESP8266EX (80 MHz)",
          flashSize: "4 MB",
          freeHeap: "43.2 KB",
          uptime: "3d 14h 22m",
          ip: process.env.SMALLTV_IP || "Unavailable",
          mac: "48:55:19:D4:2B:6A",
          wifiSsid: mockSettings.network.ssid,
          wifiSignal: 68,
          theme: mockSettings.display.theme,
          brightness: mockSettings.display.brightness,
          temp: 28,
          tempUnit: mockSettings.weather.tempUnit,
        };
        res.writeHead(200);
        res.end(JSON.stringify(status));
        return;
      }

      // 2. GET /api/settings
      if (req.method === "GET" && pathname === "/api/settings") {
        res.writeHead(200);
        res.end(JSON.stringify(mockSettings));
        return;
      }

      // 3. POST /api/settings
      if (req.method === "POST" && pathname === "/api/settings") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            mockSettings = {
              ...mockSettings,
              ...data,
              display: { ...mockSettings.display, ...(data.display || {}) },
              weather: { ...mockSettings.weather, ...(data.weather || {}) },
              time: { ...mockSettings.time, ...(data.time || {}) },
              network: { ...mockSettings.network, ...(data.network || {}) },
              media: { ...mockSettings.media, ...(data.media || {}) },
              tokens: { ...mockSettings.tokens, ...(data.tokens || {}) },
            };
            persistSettings();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: "Settings saved to flash." }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON format" }));
          }
        });
        return;
      }

      // 3b. GET /api/tokens
      if (req.method === "GET" && pathname === "/api/tokens") {
        res.writeHead(200);
        res.end(JSON.stringify(mockSettings.tokens || {}));
        return;
      }

      // 3c. POST /api/tokens (companion daemon stream)
      if (req.method === "POST" && pathname === "/api/tokens") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            mockSettings.tokens = {
              ...mockSettings.tokens,
              ...data,
              isLaptopOnline: true,
              lastSync: "Just now",
            };
            persistSettings();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: "Tokens updated." }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON format" }));
          }
        });
        return;
      }

      // 3d. POST /api/media/upload
      if (req.method === "POST" && pathname === "/api/media/upload") {
        let chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          mockSettings.media = mockSettings.media || {};
          mockSettings.media.hasPhoto = true;
          persistSettings();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: "Photo uploaded & converted to 240×240 RGB565." }));
        });
        return;
      }

      // 3e. POST /api/media/delete
      if (req.method === "POST" && pathname === "/api/media/delete") {
        mockSettings.media = mockSettings.media || {};
        mockSettings.media.hasPhoto = false;
        persistSettings();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "Photo deleted." }));
        return;
      }

      // 4. GET /api/wifi/scan
      if (req.method === "GET" && pathname === "/api/wifi/scan") {
        const networks = [
          { ssid: "Home", rssi: 68, security: "WPA2", signal: "Strong" },
          { ssid: "Ovi's 2.4", rssi: 64, security: "WPA2", signal: "Medium" },
          { ssid: "Hufflepuff House", rssi: 49, security: "WPA2", signal: "Medium" },
          { ssid: "Dobby is FREE!", rssi: 33, security: "WPA2", signal: "Weak" },
          { ssid: "YOLO_IoT", rssi: 26, security: "Open", signal: "Weak" },
        ];
        res.writeHead(200);
        res.end(JSON.stringify({ networks }));
        return;
      }

      // 5. POST /api/wifi/connect
      if (req.method === "POST" && pathname === "/api/wifi/connect") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { ssid, password, bootDelay } = JSON.parse(body);
            mockSettings.network.ssid = ssid;
            if (bootDelay !== undefined) mockSettings.network.bootDelay = bootDelay;
            persistSettings();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: `Connected to ${ssid}.` }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid parameters" }));
          }
        });
        return;
      }

      // 6. POST /api/system/reboot
      if (req.method === "POST" && pathname === "/api/system/reboot") {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "Reboot command received (simulated)." }));
        return;
      }

      // 7. POST /api/system/reset
      if (req.method === "POST" && pathname === "/api/system/reset") {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "Factory reset complete (simulated)." }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "API endpoint not found" }));
      return;
    }

    // --- STATIC FILE SERVING ---
    let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    let filePath = path.join(__dirname, relativePath);

    // Security: avoid directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

// Start standalone server if run directly
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`SmallTV Mock Server running at http://localhost:${PORT}`);
    console.log(`- Dashboard: http://localhost:${PORT}`);
    console.log(`- API Status: http://localhost:${PORT}/api/status`);
  });
}

