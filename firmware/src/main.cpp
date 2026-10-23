#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPUpdateServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <time.h>
#include "web_assets.h"

// Hardware Pin Definitions for GeekMagic SmallTV-Ultra
#define PIN_BACKLIGHT 5 // GPIO 5 (Active-Low PWM Backlight)
#define DEFAULT_BRIGHTNESS 65

TFT_eSPI tft = TFT_eSPI();
ESP8266WebServer server(80);
ESP8266HTTPUpdateServer httpUpdater;

const byte DNS_PORT = 53;
DNSServer dnsServer;
IPAddress apIP(192, 168, 4, 1);
IPAddress apNetmask(255, 255, 255, 0);

// Helper to parse timezone string (e.g., "UTC+6:00", "UTC-5:00", "+06:00")
int parseTimezoneOffset(const char* tzStr) {
  if (!tzStr) return 360; // Default Dhaka UTC+6
  int sign = 1;
  const char* p = strstr(tzStr, "UTC");
  if (p) p += 3;
  else p = tzStr;
  while (*p == ' ') p++;
  if (*p == '-') { sign = -1; p++; }
  else if (*p == '+') { sign = 1; p++; }
  int hours = 0, mins = 0;
  if (sscanf(p, "%d:%d", &hours, &mins) >= 1) {
    return sign * (hours * 60 + mins);
  }
  return 360;
}

// In-memory configuration matching dashboard state
struct Config {
  char theme[40] = "Weather & Prayer Station";
  int brightness = DEFAULT_BRIGHTNESS;
  char city[32] = "Dhaka";
  char country[32] = "Bangladesh";
  float latitude = 23.8103;
  float longitude = 90.4125;
  char prayerMethod[4] = "1"; // Karachi UISK
  char asrMethod[12] = "Hanafi";
  char tempUnit[8] = "°C";
  char windUnit[8] = "m/s";
  char pressureUnit[8] = "hPa";
  int updateInterval = 20;
  char weatherApiKey[36] = "";
  char ssid[33] = "";
  char password[65] = "";
  char hourFormat[10] = "12-Hour"; // Default 12-Hour
  char dateFormat[24] = "DD MMM . Day";
  char timezone[32] = "UTC+6:00";
  int tzOffsetMinutes = 360; // +6 hours
  char ntpServer[40] = "pool.ntp.org";
} deviceConfig;

// Live prayer times cache (Dhaka defaults)
struct PrayerTimes {
  char fajr[8] = "04:43";
  char sunrise[8] = "05:59";
  char dhuhr[8] = "11:43";
  char asr[8] = "15:01";
  char maghrib[8] = "17:27";
  char isha[8] = "18:43";
  char nextWaqt[12] = "Isha";
} prayerCache;

// Live weather cache
struct WeatherData {
  int temp = 28;
  int humidity = 64;
  float windSpeed = 2.4;
  char condition[32] = "Broken clouds";
  char sunset[8] = "17:27";
} weatherCache;

unsigned long lastTick = 0;
int lastRenderedMinute = -1;

void setBacklight(int percent) {
  // Active-LOW PWM on SmallTV-Ultra: 0 = Full On (100%), 1023 = Off (0%)
  int bounded = constrain(percent, 0, 100);
  int pwmValue = (bounded == 0) ? 1023 : ((bounded == 100) ? 0 : map(bounded, 0, 100, 1023, 0));
  analogWrite(PIN_BACKLIGHT, pwmValue);
}

void loadConfig() {
  if (LittleFS.exists("/config.json")) {
    File f = LittleFS.open("/config.json", "r");
    if (f) {
      JsonDocument doc;
      if (deserializeJson(doc, f) == DeserializationError::Ok) {
        if (doc["theme"].is<const char*>()) strlcpy(deviceConfig.theme, doc["theme"], sizeof(deviceConfig.theme));
        if (doc["brightness"].is<int>()) deviceConfig.brightness = doc["brightness"];
        if (doc["city"].is<const char*>()) strlcpy(deviceConfig.city, doc["city"], sizeof(deviceConfig.city));
        if (doc["tempUnit"].is<const char*>()) strlcpy(deviceConfig.tempUnit, doc["tempUnit"], sizeof(deviceConfig.tempUnit));
        if (doc["hourFormat"].is<const char*>()) strlcpy(deviceConfig.hourFormat, doc["hourFormat"], sizeof(deviceConfig.hourFormat));
        if (doc["dateFormat"].is<const char*>()) strlcpy(deviceConfig.dateFormat, doc["dateFormat"], sizeof(deviceConfig.dateFormat));
        if (doc["timezone"].is<const char*>()) {
          strlcpy(deviceConfig.timezone, doc["timezone"], sizeof(deviceConfig.timezone));
          deviceConfig.tzOffsetMinutes = parseTimezoneOffset(deviceConfig.timezone);
        }
        if (doc["ntpServer"].is<const char*>()) strlcpy(deviceConfig.ntpServer, doc["ntpServer"], sizeof(deviceConfig.ntpServer));
        if (doc["ssid"].is<const char*>()) strlcpy(deviceConfig.ssid, doc["ssid"], sizeof(deviceConfig.ssid));
        if (doc["password"].is<const char*>()) strlcpy(deviceConfig.password, doc["password"], sizeof(deviceConfig.password));
        
        if (doc["prayer"]["latitude"].is<float>()) deviceConfig.latitude = doc["prayer"]["latitude"];
        if (doc["prayer"]["longitude"].is<float>()) deviceConfig.longitude = doc["prayer"]["longitude"];
        if (doc["prayer"]["method"].is<const char*>()) strlcpy(deviceConfig.prayerMethod, doc["prayer"]["method"], sizeof(deviceConfig.prayerMethod));
        if (doc["prayer"]["asrMethod"].is<const char*>()) strlcpy(deviceConfig.asrMethod, doc["prayer"]["asrMethod"], sizeof(deviceConfig.asrMethod));
      }
      f.close();
    }
  }
}

void saveConfig() {
  File f = LittleFS.open("/config.json", "w");
  if (f) {
    JsonDocument doc;
    doc["theme"] = deviceConfig.theme;
    doc["brightness"] = deviceConfig.brightness;
    doc["city"] = deviceConfig.city;
    doc["tempUnit"] = deviceConfig.tempUnit;
    doc["hourFormat"] = deviceConfig.hourFormat;
    doc["dateFormat"] = deviceConfig.dateFormat;
    doc["timezone"] = deviceConfig.timezone;
    doc["tzOffsetMinutes"] = deviceConfig.tzOffsetMinutes;
    doc["ntpServer"] = deviceConfig.ntpServer;
    doc["ssid"] = deviceConfig.ssid;
    doc["password"] = deviceConfig.password;

    JsonObject p = doc["prayer"].to<JsonObject>();
    p["city"] = deviceConfig.city;
    p["latitude"] = deviceConfig.latitude;
    p["longitude"] = deviceConfig.longitude;
    p["method"] = deviceConfig.prayerMethod;
    p["asrMethod"] = deviceConfig.asrMethod;
    serializeJson(doc, f);
    f.close();
  }
}

// Helper to compute live or simulated time and formatted date
void getTimeAndDate(char* timeBuf, size_t timeLen, char* ampmBuf, size_t ampmLen, char* dateBuf, size_t dateLen) {
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);

  int hour = (t && t->tm_year + 1900 >= 2024) ? t->tm_hour : 21;
  int minute = (t && t->tm_year + 1900 >= 2024) ? t->tm_min : 44;
  int year = (t && t->tm_year + 1900 >= 2024) ? (t->tm_year + 1900) : 2026;
  int month = (t && t->tm_year + 1900 >= 2024) ? t->tm_mon : 9; // 0-based, 9 = Oct
  int day = (t && t->tm_year + 1900 >= 2024) ? t->tm_mday : 24;
  int wday = (t && t->tm_year + 1900 >= 2024) ? t->tm_wday : 5; // 5 = Fri

  // Simulated running clock if NTP has not yet synced
  if (t && t->tm_year + 1900 < 2024) {
    unsigned long sec = millis() / 1000;
    hour = (21 + (sec / 3600)) % 24;
    minute = (44 + (sec / 60)) % 60;
  }

  const char* ampm = (hour >= 12) ? "PM" : "AM";
  if (ampmBuf && ampmLen > 0) {
    strlcpy(ampmBuf, ampm, ampmLen);
  }

  bool is12 = (strcmp(deviceConfig.hourFormat, "12-Hour") == 0);
  int disHour = hour;
  if (is12) {
    disHour = hour % 12;
    if (disHour == 0) disHour = 12;
    snprintf(timeBuf, timeLen, "%d:%02d", disHour, minute);
  } else {
    snprintf(timeBuf, timeLen, "%02d:%02d", disHour, minute);
  }

  const char* months[12] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  const char* days[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

  if (strcmp(deviceConfig.dateFormat, "DD/MM/YYYY") == 0) {
    snprintf(dateBuf, dateLen, "%02d/%02d/%04d", day, month + 1, year);
  } else if (strcmp(deviceConfig.dateFormat, "YYYY/MM/DD") == 0) {
    snprintf(dateBuf, dateLen, "%04d/%02d/%02d", year, month + 1, day);
  } else if (strcmp(deviceConfig.dateFormat, "MM/DD/YYYY") == 0) {
    snprintf(dateBuf, dateLen, "%02d/%02d/%04d", month + 1, day, year);
  } else if (strcmp(deviceConfig.dateFormat, "DD.MM.YYYY") == 0) {
    snprintf(dateBuf, dateLen, "%02d.%02d.%04d", day, month + 1, year);
  } else {
    // Default: "24 Oct . Fri"
    snprintf(dateBuf, dateLen, "%d %s . %s", day, months[month], days[wday]);
  }
}

// Drawing Helpers for ST7789 IPS Screen
void drawSunAndCloud(int x, int y) {
  // Radiant Golden Sun
  tft.fillCircle(x + 18, y + 14, 11, 0xFDA0); // Golden Yellow
  tft.drawCircle(x + 18, y + 14, 13, 0xFC00); // Orange rim
  
  // Stylized Soft Cloud
  tft.fillCircle(x + 28, y + 26, 9, 0xBDF7);
  tft.fillCircle(x + 38, y + 24, 12, 0xE73F);
  tft.fillCircle(x + 49, y + 26, 8, 0xBDF7);
  tft.fillRoundRect(x + 20, y + 26, 36, 12, 5, 0xE73F);
}

// -------------------------------------------------------------
// THEME 1: Weather Station & 5-Waqt Prayer Times (Pure OLED Black)
// -------------------------------------------------------------
void renderThemePrayerWeather() {
  tft.fillScreen(TFT_BLACK); // Pure Inky Black

  // 1. Header: City Location + Online Dot
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(deviceConfig.city, 10, 8, 2);

  bool isConnected = (WiFi.status() == WL_CONNECTED);
  tft.fillCircle(226, 14, 3, isConnected ? TFT_GREEN : 0xFD20);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(isConnected ? 0x7BEF : 0xFD20, TFT_BLACK);
  tft.drawString(isConnected ? "ONLINE" : "192.168.4.1", 218, 9, 1);

  // 2. Hero Row: Sun + Cloud (Left) & Time / Date (Right)
  drawSunAndCloud(10, 26);

  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK); // Golden Yellow Time
  tft.drawString(timeStr, 230, 26, 6);

  // Show AM/PM label if 12-Hour format
  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(0xFFE0, TFT_BLACK);
    tft.drawString(ampmStr, 230, 16, 1);
  }

  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0x3E1F, TFT_BLACK); // Cyan Date
  tft.drawString(dateStr, 230, 68, 2);

  // 3. 5-Waqt Salah Grid Strip
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0x8410, TFT_BLACK);
  tft.drawString("SALAH SCHEDULE", 10, 86, 1);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString("NEXT: ISHA", 230, 86, 1);

  const char* names[5] = {"FAJR", "DHU", "ASR", "MAG", "ISHA"};
  const char* times[5] = {prayerCache.fajr, prayerCache.dhuhr, prayerCache.asr, prayerCache.maghrib, prayerCache.isha};
  
  int cellW = 41;
  int startX = 10;
  int cellY = 97;

  for (int i = 0; i < 5; i++) {
    int cx = startX + i * (cellW + 4);
    bool isNext = (i == 4); // Isha next
    
    uint16_t bg = isNext ? 0x21C5 : 0x10A2;
    uint16_t border = isNext ? 0xFDA0 : 0x31A6;
    tft.fillRoundRect(cx, cellY, cellW, 26, 3, bg);
    tft.drawRoundRect(cx, cellY, cellW, 26, 3, border);

    tft.setTextDatum(TC_DATUM);
    tft.setTextColor(isNext ? 0xFDA0 : 0x8C71, bg);
    tft.drawString(names[i], cx + (cellW / 2), cellY + 3, 1);

    tft.setTextColor(isNext ? 0xFFFF : 0xCE79, bg);
    tft.drawString(times[i], cx + (cellW / 2), cellY + 14, 1);
  }

  // 4. Condition Banner
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(weatherCache.condition, 10, 130, 2);

  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFFE0, TFT_BLACK); // Bright Yellow Temp
  tft.drawString("28C", 230, 130, 2);

  tft.drawFastHLine(10, 150, 220, 0x2124);

  // 5. Telemetry Cards (Clean layout without Wind Speed)
  // Temperature Card (Left)
  tft.fillCircle(16, 175, 5, 0xFD20); // Orange dot
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0xFD20, TFT_BLACK);
  tft.drawString("Temperature", 28, 162, 1);
  tft.setTextColor(0xFFE0, TFT_BLACK);
  tft.drawString("28 C", 28, 175, 4);

  // Humidity Card (Middle)
  tft.fillCircle(106, 175, 5, 0x3E1F); // Cyan dot
  tft.setTextColor(0x3E1F, TFT_BLACK);
  tft.drawString("Humidity", 118, 162, 1);
  tft.setTextColor(0x7E1F, TFT_BLACK);
  tft.drawString("64 %", 118, 175, 4);

  // Sunset Card (Right)
  tft.fillCircle(182, 175, 5, 0xFC00); // Warm Sunset dot
  tft.setTextColor(0xFC00, TFT_BLACK);
  tft.drawString("Sunset", 194, 162, 1);
  tft.setTextColor(0xFFE0, TFT_BLACK);
  tft.drawString(weatherCache.sunset, 194, 175, 2);
}

// -------------------------------------------------------------
// THEME 2: Minimalist Editorial Clock & Single Weather Hero
// -------------------------------------------------------------
void renderThemeEditorialClock() {
  tft.fillScreen(TFT_BLACK); // Pure Inky Black

  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  // Top Date & Status Bar
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0x9CD3, TFT_BLACK);
  tft.drawString(dateStr, 14, 14, 2);

  bool isConnected = (WiFi.status() == WL_CONNECTED);
  tft.fillCircle(224, 20, 3, isConnected ? TFT_GREEN : 0x7BEF);

  // Hero Massive Clock Digits (Centered)
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(timeStr, 120, 85, 7); // Large font 7

  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(0xFDA0, TFT_BLACK);
    tft.drawString(ampmStr, 224, 48, 2);
  }

  // Divider
  tft.drawFastHLine(14, 138, 212, 0x2965);

  // Bottom Weather Hero Section
  tft.fillCircle(38, 175, 16, 0xFDA0);
  tft.drawCircle(38, 175, 18, 0xFC00);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("28", 68, 160, 6);
  tft.drawString("C", 128, 162, 2);

  tft.setTextColor(0xCE79, TFT_BLACK);
  tft.drawString("Dhaka . Clear Sky", 68, 195, 2);

  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawString("HUM 64%  WIND 2.4m/s", 68, 215, 1);
}

// -------------------------------------------------------------
// THEME 3: Ultra-Clean Minimal Clock (Time + Date + AM/PM)
// -------------------------------------------------------------
void renderThemeMinimalClock() {
  tft.fillScreen(TFT_BLACK); // Pure Inky Black

  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  // Big Centered Time Digits
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(timeStr, 120, 90, 7);

  // AM / PM Badge if 12h
  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.fillRoundRect(100, 138, 40, 20, 4, 0x2124);
    tft.setTextColor(0xFDA0, 0x2124);
    tft.drawString(ampmStr, 120, 148, 2);
  }

  // Full Clean Date
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(0xAD55, TFT_BLACK);
  tft.drawString(dateStr, 120, 185, 2);

  // Tiny subtle status
  tft.fillCircle(120, 222, 2, WiFi.status() == WL_CONNECTED ? TFT_GREEN : 0x4208);
}

void renderCurrentTheme() {
  if (strcmp(deviceConfig.theme, "Editorial Weather Clock") == 0) {
    renderThemeEditorialClock();
  } else if (strcmp(deviceConfig.theme, "Minimalist Clean Clock") == 0) {
    renderThemeMinimalClock();
  } else {
    renderThemePrayerWeather();
  }
}

// REST API Handlers
void handleApiStatus() {
  JsonDocument doc;
  doc["model"] = "SmallTV-Ultra";
  doc["firmware"] = "Custom-V1.2";
  doc["chip"] = "ESP8266EX (80 MHz)";
  doc["flashSize"] = "4 MB";
  doc["freeHeap"] = String(ESP.getFreeHeap() / 1024.0, 1) + " KB";
  doc["uptime"] = String(millis() / 60000) + " mins";
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "192.168.4.1";
  doc["mac"] = WiFi.macAddress();
  doc["wifiSsid"] = WiFi.status() == WL_CONNECTED ? WiFi.SSID() : deviceConfig.ssid;
  doc["wifiSignal"] = WiFi.status() == WL_CONNECTED ? map(WiFi.RSSI(), -100, -40, 0, 100) : 0;
  doc["theme"] = deviceConfig.theme;
  doc["brightness"] = deviceConfig.brightness;
  doc["temp"] = weatherCache.temp;
  doc["tempUnit"] = deviceConfig.tempUnit;

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

void handleApiSettingsGet() {
  JsonDocument doc;
  doc["display"]["theme"] = deviceConfig.theme;
  doc["display"]["brightness"] = deviceConfig.brightness;
  doc["weather"]["city"] = deviceConfig.city;
  doc["weather"]["tempUnit"] = deviceConfig.tempUnit;
  doc["weather"]["windSpeedUnit"] = deviceConfig.windUnit;
  doc["weather"]["pressureUnit"] = deviceConfig.pressureUnit;
  doc["weather"]["updateInterval"] = deviceConfig.updateInterval;
  
  JsonObject p = doc["prayer"].to<JsonObject>();
  p["city"] = deviceConfig.city;
  p["country"] = deviceConfig.country;
  p["latitude"] = deviceConfig.latitude;
  p["longitude"] = deviceConfig.longitude;
  p["method"] = deviceConfig.prayerMethod;
  p["asrMethod"] = deviceConfig.asrMethod;
  p["timings"]["fajr"] = prayerCache.fajr;
  p["timings"]["sunrise"] = prayerCache.sunrise;
  p["timings"]["dhuhr"] = prayerCache.dhuhr;
  p["timings"]["asr"] = prayerCache.asr;
  p["timings"]["maghrib"] = prayerCache.maghrib;
  p["timings"]["isha"] = prayerCache.isha;

  JsonObject t = doc["time"].to<JsonObject>();
  t["hourFormat"] = deviceConfig.hourFormat;
  t["dateFormat"] = deviceConfig.dateFormat;
  t["timezone"] = deviceConfig.timezone;
  t["tzOffsetMinutes"] = deviceConfig.tzOffsetMinutes;
  t["ntp"] = deviceConfig.ntpServer;

  JsonObject n = doc["network"].to<JsonObject>();
  n["ssid"] = deviceConfig.ssid;

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

void handleApiSettingsPost() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain")) != DeserializationError::Ok) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc["display"]["theme"].is<const char*>()) {
    strlcpy(deviceConfig.theme, doc["display"]["theme"], sizeof(deviceConfig.theme));
  }
  if (doc["display"]["brightness"].is<int>()) {
    deviceConfig.brightness = doc["display"]["brightness"];
    setBacklight(deviceConfig.brightness);
  }
  if (doc["weather"]["city"].is<const char*>()) {
    strlcpy(deviceConfig.city, doc["weather"]["city"], sizeof(deviceConfig.city));
  }
  if (doc["prayer"]["city"].is<const char*>()) {
    strlcpy(deviceConfig.city, doc["prayer"]["city"], sizeof(deviceConfig.city));
  }
  if (doc["prayer"]["latitude"].is<float>()) {
    deviceConfig.latitude = doc["prayer"]["latitude"];
  }
  if (doc["prayer"]["longitude"].is<float>()) {
    deviceConfig.longitude = doc["prayer"]["longitude"];
  }
  if (doc["prayer"]["method"].is<const char*>()) {
    strlcpy(deviceConfig.prayerMethod, doc["prayer"]["method"], sizeof(deviceConfig.prayerMethod));
  }
  if (doc["prayer"]["asrMethod"].is<const char*>()) {
    strlcpy(deviceConfig.asrMethod, doc["prayer"]["asrMethod"], sizeof(deviceConfig.asrMethod));
  }

  // Time & Date Settings
  bool tzChanged = false;
  if (doc["time"]["hourFormat"].is<const char*>()) {
    strlcpy(deviceConfig.hourFormat, doc["time"]["hourFormat"], sizeof(deviceConfig.hourFormat));
  }
  if (doc["time"]["dateFormat"].is<const char*>()) {
    strlcpy(deviceConfig.dateFormat, doc["time"]["dateFormat"], sizeof(deviceConfig.dateFormat));
  }
  if (doc["time"]["timezone"].is<const char*>()) {
    strlcpy(deviceConfig.timezone, doc["time"]["timezone"], sizeof(deviceConfig.timezone));
    deviceConfig.tzOffsetMinutes = parseTimezoneOffset(deviceConfig.timezone);
    tzChanged = true;
  }
  if (doc["time"]["ntp"].is<const char*>()) {
    strlcpy(deviceConfig.ntpServer, doc["time"]["ntp"], sizeof(deviceConfig.ntpServer));
    tzChanged = true;
  }
  if (tzChanged) {
    configTime(deviceConfig.tzOffsetMinutes * 60, 0, deviceConfig.ntpServer, "pool.ntp.org", "time.google.com");
  }

  saveConfig();
  renderCurrentTheme();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Settings saved to flash.\"}");
}

void handleApiWifiScan() {
  int n = WiFi.scanNetworks();
  JsonDocument doc;
  JsonArray arr = doc["networks"].to<JsonArray>();

  for (int i = 0; i < n && i < 15; ++i) {
    JsonObject net = arr.add<JsonObject>();
    net["ssid"] = WiFi.SSID(i);
    net["rssi"] = WiFi.RSSI(i);
    net["signal"] = map(WiFi.RSSI(i), -100, -40, 0, 100);
    net["security"] = WiFi.encryptionType(i) == ENC_TYPE_NONE ? "Open" : "WPA2";
  }

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

void handleApiWifiConnect() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain")) != DeserializationError::Ok) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  const char* ssid = doc["ssid"] | "";
  const char* pass = doc["password"] | "";

  if (strlen(ssid) == 0) {
    server.send(400, "application/json", "{\"error\":\"SSID cannot be empty\"}");
    return;
  }

  strlcpy(deviceConfig.ssid, ssid, sizeof(deviceConfig.ssid));
  strlcpy(deviceConfig.password, pass, sizeof(deviceConfig.password));
  saveConfig();

  server.send(200, "application/json", "{\"success\":true,\"message\":\"Connecting to Wi-Fi network...\"}");

  // Begin STA connection to user router
  WiFi.begin(deviceConfig.ssid, deviceConfig.password);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BACKLIGHT, OUTPUT);
  analogWriteFreq(1000);
  analogWriteRange(1023);
  setBacklight(DEFAULT_BRIGHTNESS);

  // Initialize display
  tft.init();
  tft.setRotation(0);
  tft.invertDisplay(true); // Required for ST7789 IPS True Black
  tft.fillScreen(TFT_BLACK);

  LittleFS.begin();
  loadConfig();
  setBacklight(deviceConfig.brightness);

  // Start Wi-Fi in dual AP+STA mode with explicit IP configuration
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(apIP, apIP, apNetmask);
  WiFi.softAP("SmallTV-Setup");

  // Captive Portal DNS: redirect queries to 192.168.4.1
  dnsServer.start(DNS_PORT, "*", apIP);

  // Attempt auto-connect if credentials exist
  if (strlen(deviceConfig.ssid) > 0) {
    WiFi.begin(deviceConfig.ssid, deviceConfig.password);
  }

  // Setup NTP synchronization
  configTime(deviceConfig.tzOffsetMinutes * 60, 0, deviceConfig.ntpServer, "pool.ntp.org", "time.google.com");

  // Render initial selected theme
  renderCurrentTheme();

  // Register Web Dashboard directly from PROGMEM (Gzip compressed)
  serveDashboard(server);

  // Captive Portal / Fallback Handler: always serve dashboard on any unhandled route
  server.onNotFound([]() {
    String uri = server.uri();
    if (uri.endsWith(".html") || uri.endsWith("/") || uri.indexOf("generate_204") >= 0 || uri.indexOf("hotspot-detect") >= 0 || uri.indexOf("connecttest") >= 0) {
      server.sendHeader("Location", "http://192.168.4.1/", true);
      server.send(302, "text/plain", "Redirecting to SmallTV Dashboard");
    } else {
      server.sendHeader("Content-Encoding", "gzip");
      server.send_P(200, "text/html", (PGM_P)DASHBOARD_HTML_GZ, DASHBOARD_HTML_GZ_LEN);
    }
  });

  // Register OTA Update Server on /update for easy future updates and rollback
  httpUpdater.setup(&server, "/update");

  // Register REST API endpoints
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/settings", HTTP_GET, handleApiSettingsGet);
  server.on("/api/settings", HTTP_POST, handleApiSettingsPost);
  server.on("/api/wifi/scan", HTTP_GET, handleApiWifiScan);
  server.on("/api/wifi/connect", HTTP_POST, handleApiWifiConnect);
  server.on("/api/system/reboot", HTTP_POST, []() {
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Rebooting...\"}");
    delay(500);
    ESP.restart();
  });

  server.begin();
  Serial.println("SmallTV Web Server started with True Black ST7789 themes.");
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  
  // Refresh display only when minute changes (prevents frequent blinking)
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  int curMin = t ? t->tm_min : (millis() / 60000);
  if (curMin != lastRenderedMinute) {
    lastTick = millis();
    lastRenderedMinute = curMin;
    renderCurrentTheme();
  }
}
