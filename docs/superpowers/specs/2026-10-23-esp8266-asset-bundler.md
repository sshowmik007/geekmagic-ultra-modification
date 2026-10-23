# SmallTV ESP8266 Asset Bundling & C++ Exporter Spec

## Goal

Package and optimize the `smalltv-dashboard` web assets (HTML, compiled CSS, and client JavaScript) into an ESP8266-ready, Gzip-compressed C++ header (`web_assets.h`) and LittleFS-ready files (`.gz`), measuring exact Flash and RAM usage against the ESP8266 resource budget.

---

## Technical Context & ESP8266 Budget

1. **Storage Budget (4 MB Flash)**:
   * Sketch partition: 1,048,576 bytes (1 MB max for OTA update safety).
   * LittleFS partition: ~1–2 MB.
   * Gzipped Web Assets Target: **< 40 KB** total.
2. **RAM Budget (ESP8266 free heap: ~40 KB)**:
   * Storing uncompressed web pages in RAM will trigger immediate `OutOfMemory` crashes or Watchdog resets (`wdt reset`).
   * Assets **must be stored in PROGMEM (Flash)** or served directly from LittleFS stream.
   * The web server sends the response with HTTP header `Content-Encoding: gzip` directly from Flash. The client browser transparently unzips and renders it.

---

## Exporter Tool Architecture (`scripts/build-esp.js`)

1. **Input**:
   * `index.html` (root structure)
   * `dist/styles.css` (Tailwind minified CSS)
   * `src/main.js`, `src/state.js`, `src/api.js` (client code)
2. **Transformations**:
   * Combines HTML, CSS, and JS into an optimized single bundle (inlining styles and script to eliminate multiple round-trip HTTP requests on ESP8266).
   * Strips unnecessary whitespace and comments.
   * Compresses the bundle using Gzip (`zlib.gzipSync` with level 9 compression).
3. **Outputs**:
   * `dist/web_assets.h`: C++ header file containing byte array in `PROGMEM`:
     ```cpp
     #ifndef WEB_ASSETS_H
     #define WEB_ASSETS_H
     #include <Arduino.h>

     const uint8_t DASHBOARD_GZ[] PROGMEM = { 0x1f, 0x8b, ... };
     const size_t DASHBOARD_GZ_LEN = ...;

     #endif
     ```
   * `dist/littlefs/index.html.gz`: Standalone gzipped file for LittleFS upload.
   * Reports size comparison: Uncompressed size vs Gzipped size vs Budget.

---

## C++ Server Integration Handler
Includes a standard C++ snippet for `ESP8266WebServer`:
```cpp
server.on("/", HTTP_GET, []() {
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", (PGM_P)DASHBOARD_GZ, DASHBOARD_GZ_LEN);
});
```

---

## Safety & Boundaries
* The exporter script runs entirely in `smalltv-dashboard/`.
* It does not touch the device or flash memory.
