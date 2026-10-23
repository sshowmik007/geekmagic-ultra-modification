# SmallTV ESP8266 REST API Contract & Local Mock Server Spec

## Goal

Define the lightweight HTTP/JSON REST API contract between the SmallTV browser dashboard and the ESP8266 microcontroller, and implement a zero-dependency local mock server to test real asynchronous network interaction, loading states, and live settings persistence before firmware integration.

---

## Architectural Constraints (ESP8266 Friendly)

1. **Memory Budget**:
   * ESP8266 free RAM is only ~35–45 KB. JSON payloads must be compact and flat (< 2 KB per request/response).
   * Payloads use standard `application/json` without large nested arrays or deeply nested objects.
2. **Flash / LittleFS Storage**:
   * Settings are saved as a single `config.json` file in LittleFS.
   * Total flash partition for LittleFS on the SmallTV-Ultra is ~1–2 MB.
3. **Zero External Dependencies for the Mock Server**:
   * Use Node.js built-in `node:http`, `node:fs`, and `node:path` modules.
   * No heavy dependencies like Express or Fastify.

---

## REST Endpoints Specification

### 1. `GET /api/status`
Returns live device telemetry, network info, and currently active display mode.

* **Response (200 OK)**:
  ```json
  {
    "model": "SmallTV-Ultra",
    "firmware": "Ultra-V9.0.51",
    "chip": "ESP8266EX",
    "flashSize": "4MB",
    "freeHeap": 43820,
    "uptime": "3d 14h 22m",
    "ip": "192.168.0.198",
    "mac": "48:55:19:D4:2B:6A",
    "wifiSsid": "Home",
    "wifiSignal": 68,
    "theme": "Weather Clock Today",
    "brightness": 65,
    "time": "18:45:00",
    "date": "23/10/2026",
    "temp": 28,
    "tempUnit": "°C"
  }
  ```

### 2. `GET /api/settings`
Returns full configuration currently saved on flash.

* **Response (200 OK)**: Full JSON configuration (display, weather, time, network, media).

### 3. `POST /api/settings`
Updates device configuration and saves to flash (`config.json`).

* **Request Body**: Partial or complete configuration JSON.
* **Response (200 OK)**:
  ```json
  { "success": true, "message": "Settings saved to flash." }
  ```

### 4. `GET /api/wifi/scan`
Triggers Wi-Fi network scanning (`WiFi.scanNetworks()`) and returns detected 2.4 GHz SSIDs.

* **Response (200 OK)**:
  ```json
  {
    "networks": [
      { "ssid": "Home", "rssi": -55, "signal": 68, "security": "WPA2" },
      { "ssid": "Ovi's 2.4", "rssi": -62, "signal": 64, "security": "WPA2" },
      { "ssid": "Hufflepuff House", "rssi": -74, "signal": 49, "security": "WPA2" }
    ]
  }
  ```

### 5. `POST /api/wifi/connect`
Sets new Wi-Fi credentials. On real hardware, this attempts station connection.

* **Request Body**:
  ```json
  { "ssid": "Home", "password": "secretpassword", "bootDelay": 0 }
  ```
* **Response (200 OK)**:
  ```json
  { "success": true, "message": "Wi-Fi credentials saved. Reconnecting..." }
  ```

### 6. `POST /api/system/reboot`
Simulates or triggers hardware reboot (`ESP.restart()`).

### 7. `POST /api/system/reset`
Clears configuration and restores factory defaults.

### 8. `POST /update` (Firmware OTA)
Receives multipart `.bin` firmware file and validates magic byte (`0xE9` for ESP8266) and size (< 1,048,576 bytes).

---

## Frontend Integration (`src/api.js`)

* Exposes helper functions: `fetchStatus()`, `fetchSettings()`, `saveSettings(data)`, `scanWifi()`, `connectWifi(creds)`.
* **Graceful Fallback**: If running directly from `file://` (no backend active), it logs a note and uses in-memory mock storage so the UI never breaks.
* If running on `http://localhost:3000` or real device IP (`http://192.168.0.198`), it performs standard `fetch()` with clear status toasts (Saving..., Saved, Connection Error).

---

## Safety Boundary
* The mock server runs only on local machine port `3000`.
* It does not talk to `192.168.0.198` until explicit hardware integration approval.

