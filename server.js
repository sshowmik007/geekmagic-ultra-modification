import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// In-memory mock device state
let mockSettings = {
  display: {
    theme: "Weather Clock Today",
    brightness: 65,
    autoSwitch: false,
    switchInterval: 30,
    nightMode: {
      enabled: true,
      startTime: "22:00",
      endTime: "07:00",
      brightness: 20,
    },
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
    hourFormat: "24-Hour",
    dateFormat: "DD/MM/YYYY",
    colonBlink: true,
    fontStyle: "Default Big Font",
    ntp: "pool.ntp.org",
    colors: {
      hour: "#ffffff",
      minute: "#feba01",
      second: "#ffffff",
    },
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

      // 1. GET /api/status
      if (req.method === "GET" && pathname === "/api/status") {
        const status = {
          model: "SmallTV-Ultra",
          firmware: "Ultra-V9.0.51",
          chip: "ESP8266EX (80 MHz)",
          flashSize: "4 MB",
          freeHeap: "43.2 KB",
          uptime: "3d 14h 22m",
          ip: "192.168.0.198",
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
            };
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: "Settings saved to flash." }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON format" }));
          }
        });
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

      res.writeHead(200, { "Content-Type": contentType });
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

