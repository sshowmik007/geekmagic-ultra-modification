#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPUpdateServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <time.h>
#include "web_assets.h"

// Hardware Pin Definitions for GeekMagic SmallTV-Ultra
#define PIN_BACKLIGHT 5 // GPIO 5 (Active-Low PWM Backlight)
#define DEFAULT_BRIGHTNESS 65

TFT_eSPI tft = TFT_eSPI();
TFT_eSprite prayerClockSprite = TFT_eSprite(&tft);
ESP8266WebServer server(80);
ESP8266HTTPUpdateServer httpUpdater;

const int PRAYER_CLOCK_X = 74;
const int PRAYER_CLOCK_Y = 24;
const int PRAYER_CLOCK_W = 144;
const int PRAYER_CLOCK_H = 48;
bool prayerClockSpriteReady = false;

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
  bool autoSwitch = false;
  int switchInterval = 15;
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

// Live AI token usage telemetry cache
struct TokenUsage {
  char provider[16] = "";
  char model[24] = "";
  long sessionTokens = 0;
  long sessionLimit = 0;
  int sessionPct = -1;
  char sessionLabel[24] = "RATE LIMIT";
  char sessionText[32] = "Unavailable";
  char sessionReset[16] = "";
  long weeklyTokens = 0;
  long weeklyLimit = 0;
  int weeklyPct = -1;
  char weeklyLabel[24] = "RATE LIMIT";
  char weeklyText[32] = "Unavailable";
  char weeklyReset[16] = "";
  char agentState[16] = "UNAVAILABLE";
  bool laptopConnected = false;
  char telemetryState[16] = "unavailable";
  char sourceLabel[48] = "No verified provider source";
  unsigned long observedAt = 0;
  int sessionWindowMinutes = 0;
  int weeklyWindowMinutes = 0;
  unsigned long lastSyncMillis = 0;
} tokenCache;

const char* const allThemes[] = {
  "Weather & Prayer Station",
  "Editorial Weather Clock",
  "Minimalist Clean Clock",
  "AI Token & Rate Monitor",
  "Cosmic Shuttle & Prayer Station"
};
const int NUM_THEMES = 5;

// Live prayer times cache (Dhaka defaults)
struct PrayerTimes {
  char fajr[8] = "04:44";
  char sunrise[8] = "06:00";
  char dhuhr[8] = "11:42";
  char asr[8] = "15:48";
  char maghrib[8] = "17:24";
  char isha[8] = "18:40";
  char nextWaqt[12] = "Isha";
} prayerCache;

unsigned long lastPrayerAttemptMillis = 0;
unsigned long lastPrayerSyncMillis = 0;

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
        if (doc["autoSwitch"].is<bool>()) deviceConfig.autoSwitch = doc["autoSwitch"];
        if (doc["switchInterval"].is<int>()) deviceConfig.switchInterval = max(5, (int)doc["switchInterval"]);
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
    doc["autoSwitch"] = deviceConfig.autoSwitch;
    doc["switchInterval"] = deviceConfig.switchInterval;
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
    snprintf(timeBuf, timeLen, "%02d:%02d", disHour, minute);
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
void showBootAnimation() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString("SMALLTV", 120, 92, 4);
  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawString("Starting dashboard", 120, 122, 2);
  tft.drawRoundRect(42, 148, 156, 10, 5, 0x2965);

  for (int width = 4; width <= 148; width += 6) {
    tft.fillRoundRect(46, 152, width, 2, 1, 0x3E1F);
    delay(24);
    yield();
  }
}

void drawSunAndCloud(int x, int y, uint8_t frame) {
  tft.fillRect(x, y, 62, 44, TFT_BLACK);
  int drift = frame <= 3 ? frame : 7 - frame;
  int sunRadius = (frame >= 2 && frame <= 5) ? 12 : 11;

  // Radiant Golden Sun
  tft.fillCircle(x + 18, y + 14, sunRadius, 0xFDA0); // Golden Yellow
  tft.drawCircle(x + 18, y + 14, sunRadius + 2, 0xFC00); // Orange rim
  
  // Stylized Soft Cloud
  int cloudX = x + drift;
  tft.fillCircle(cloudX + 28, y + 26, 9, 0xBDF7);
  tft.fillCircle(cloudX + 38, y + 24, 12, 0xE73F);
  tft.fillCircle(cloudX + 49, y + 26, 8, 0xBDF7);
  tft.fillRoundRect(cloudX + 20, y + 26, 36, 12, 5, 0xE73F);
}

void formatPrayerTime(const char* in24, char* out, size_t outSize) {
  if (!in24 || strlen(in24) < 5) {
    strlcpy(out, in24 ? in24 : "", outSize);
    return;
  }
  int h = (in24[0] - '0') * 10 + (in24[1] - '0');
  int m = (in24[3] - '0') * 10 + (in24[4] - '0');
  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    int h12 = h % 12;
    if (h12 == 0) h12 = 12;
    snprintf(out, outSize, "%02d:%02d", h12, m);
  } else {
    snprintf(out, outSize, "%02d:%02d", h, m);
  }
}

// -------------------------------------------------------------
// THEME 1: Weather Station & 5-Waqt Prayer Times (Pure OLED Black)
// -------------------------------------------------------------
void drawPrayerWeatherClock(bool colonVisible) {
  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));
  timeStr[2] = '\0';
  const char* minutes = timeStr + 3;

  if (prayerClockSpriteReady) {
    prayerClockSprite.fillSprite(0);
    prayerClockSprite.setTextDatum(TL_DATUM);
    prayerClockSprite.setTextColor(1, 0);
    int minuteWidth = prayerClockSprite.textWidth(minutes, 6);
    int colonWidth = prayerClockSprite.textWidth(":", 6);
    int hourWidth = prayerClockSprite.textWidth(timeStr, 6);
    int minuteX = PRAYER_CLOCK_W - minuteWidth;
    int colonX = minuteX - colonWidth;
    int hourX = colonX - hourWidth;
    prayerClockSprite.drawString(timeStr, hourX, 0, 6);
    if (colonVisible) prayerClockSprite.drawString(":", colonX, 0, 6);
    prayerClockSprite.drawString(minutes, minuteX, 0, 6);
    prayerClockSprite.setBitmapColor(0xFDA0, TFT_BLACK);
    prayerClockSprite.pushSprite(PRAYER_CLOCK_X, PRAYER_CLOCK_Y);
  } else {
    timeStr[2] = colonVisible ? ':' : ' ';
    tft.fillRect(PRAYER_CLOCK_X, PRAYER_CLOCK_Y, PRAYER_CLOCK_W, PRAYER_CLOCK_H, TFT_BLACK);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(0xFDA0, TFT_BLACK);
    tft.drawString(timeStr, PRAYER_CLOCK_X + PRAYER_CLOCK_W, PRAYER_CLOCK_Y, 6);
  }
}

int prayerMinutes(const char* value) {
  if (!value || strlen(value) < 5) return 0;
  return ((value[0] - '0') * 10 + (value[1] - '0')) * 60
       + (value[3] - '0') * 10 + (value[4] - '0');
}

void getNextPrayer(int &activeIdx, const char* &label) {
  time_t now = time(nullptr);
  struct tm* ti = localtime(&now);
  int curMin = (ti ? ti->tm_hour : 8) * 60 + (ti ? ti->tm_min : 37);

  if (curMin < prayerMinutes(prayerCache.fajr)) {
    activeIdx = 0;
    label = "NEXT: FAJR";
  } else if (curMin < prayerMinutes(prayerCache.dhuhr)) {
    activeIdx = 1;
    label = "NEXT: DHUHR";
  } else if (curMin < prayerMinutes(prayerCache.asr)) {
    activeIdx = 2;
    label = "NEXT: ASR";
  } else if (curMin < prayerMinutes(prayerCache.maghrib)) {
    activeIdx = 3;
    label = "NEXT: MAGHRIB";
  } else if (curMin < prayerMinutes(prayerCache.isha)) {
    activeIdx = 4;
    label = "NEXT: ISHA";
  } else {
    activeIdx = 0;
    label = "NEXT: FAJR";
  }
}

void drawPrayerWeatherSchedule() {
  int activeIdx = 0;
  const char* nextPrayerLabel = "NEXT: FAJR";
  getNextPrayer(activeIdx, nextPrayerLabel);

  tft.fillRect(8, 86, 224, 40, TFT_BLACK);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0x8410, TFT_BLACK);
  tft.drawString("PRAYER TIMES", 10, 88, 1);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString(nextPrayerLabel, 230, 88, 1);

  char f12[8], d12[8], a12[8], m12[8], i12[8];
  formatPrayerTime(prayerCache.fajr, f12, sizeof(f12));
  formatPrayerTime(prayerCache.dhuhr, d12, sizeof(d12));
  formatPrayerTime(prayerCache.asr, a12, sizeof(a12));
  formatPrayerTime(prayerCache.maghrib, m12, sizeof(m12));
  formatPrayerTime(prayerCache.isha, i12, sizeof(i12));

  const char* names[5] = {"FAJR", "DHUHR", "ASR", "MAGRIB", "ISHA"};
  const char* times[5] = {f12, d12, a12, m12, i12};

  const int cellW = 41;
  const int startX = 10;
  const int cellY = 99;

  for (int i = 0; i < 5; i++) {
    int cx = startX + i * (cellW + 4);
    bool isNext = (i == activeIdx);
    
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
}

void drawPrayerWeatherDate() {
  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  tft.fillRect(218, 27, 22, 12, TFT_BLACK);
  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(0xFFE0, TFT_BLACK);
    tft.drawString(ampmStr, 238, 28, 1);
  }

  tft.fillRect(74, 72, 158, 16, TFT_BLACK);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0x3E1F, TFT_BLACK);
  tft.drawString(dateStr, 230, 72, 2);
}

void renderThemePrayerWeather() {
  tft.fillScreen(TFT_BLACK); // Pure Inky Black

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(deviceConfig.city, 10, 8, 2);

  bool isConnected = (WiFi.status() == WL_CONNECTED);
  tft.fillCircle(226, 14, 3, isConnected ? TFT_GREEN : 0xFD20);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(isConnected ? 0x3E1F : 0xFD20, TFT_BLACK);
  tft.drawString(isConnected ? "ONLINE" : "SETUP", 218, 9, 1);

  drawSunAndCloud(10, 26, 0);
  drawPrayerWeatherClock(true);
  drawPrayerWeatherDate();
  drawPrayerWeatherSchedule();

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(weatherCache.condition, 10, 134, 2);

  char tempBuf[12];
  snprintf(tempBuf, sizeof(tempBuf), "%d C", weatherCache.temp);
  char sunsetDisplay[8];
  formatPrayerTime(weatherCache.sunset, sunsetDisplay, sizeof(sunsetDisplay));
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFFE0, TFT_BLACK);
  tft.drawString(tempBuf, 230, 134, 2);

  tft.drawFastHLine(10, 156, 220, 0x2124);

  const int columns[3] = {44, 120, 196};
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(0xFD20, TFT_BLACK);
  tft.drawString("TEMP", columns[0], 169, 1);
  tft.setTextColor(0xFFE0, TFT_BLACK);
  tft.drawString(tempBuf, columns[0], 185, 2);

  char humidityBuf[12];
  snprintf(humidityBuf, sizeof(humidityBuf), "%d%%", weatherCache.humidity);
  tft.setTextColor(0x3E1F, TFT_BLACK);
  tft.drawString("HUMIDITY", columns[1], 169, 1);
  tft.setTextColor(0x7E1F, TFT_BLACK);
  tft.drawString(humidityBuf, columns[1], 185, 2);

  tft.setTextColor(0xFC00, TFT_BLACK);
  tft.drawString("SUNSET", columns[2], 169, 1);
  tft.setTextColor(0xFFE0, TFT_BLACK);
  tft.drawString(sunsetDisplay, columns[2], 185, 2);
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

// -------------------------------------------------------------
// THEME 4: AI Token & Rate Limit Monitor (Claude / Gemini / OpenAI)
// -------------------------------------------------------------
uint16_t getUsageColor565(int pct) {
  if (pct < 0) return 0x7BEF;
  if (pct >= 75) return TFT_GREEN;
  if (pct >= 40) return TFT_YELLOW;
  if (pct >= 15) return TFT_ORANGE;
  return TFT_RED;                       // 0xF800
}

// Show verified token counts even when the provider does not expose quota percentages.
void formatTokenCount(long tokens, char* output, size_t outputSize) {
  if (tokens >= 1000000) snprintf(output, outputSize, "%.1fM", tokens / 1000000.0);
  else if (tokens >= 1000) snprintf(output, outputSize, "%.1fk", tokens / 1000.0);
  else snprintf(output, outputSize, "%ld", tokens);
}

void renderThemeTokenMonitor() {
  tft.fillScreen(TFT_BLACK);

  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  // Top Row: Time (left) + Provider Pill (right)
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(timeStr, 12, 10, 4);

  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.setTextColor(0xFDA0, TFT_BLACK);
    tft.drawString(ampmStr, tft.textWidth(timeStr, 4) + 16, 12, 2);
  }

  // Provider Pill Tag (top-right) with Model Sub-Badge
  uint16_t pillBg = 0x2124;
  uint16_t pillText = TFT_WHITE;
  if (strstr(tokenCache.provider, "Claude")) {
    pillBg = 0x4100; // Dark Amber
    pillText = 0xFDA0;
  } else if (strstr(tokenCache.provider, "Gemini")) {
    pillBg = 0x0210; // Dark Cyan
    pillText = 0x3DFE;
  } else if (strstr(tokenCache.provider, "Open") || strstr(tokenCache.provider, "Codex") || strstr(tokenCache.provider, "GPT")) {
    pillBg = 0x0200; // Dark Green
    pillText = TFT_GREEN;
  } else if (strstr(tokenCache.provider, "OpenCode")) {
    pillBg = 0x2810; // Dark Purple
    pillText = 0xBDF7;
  }

  char modelClean[24] = "";
  if (strlen(tokenCache.model) > 0 && strcmp(tokenCache.model, "null") != 0 && strcmp(tokenCache.model, "Model unavailable") != 0) {
    const char* m = tokenCache.model;
    if (strncmp(m, "Gemini ", 7) == 0) m += 7;
    else if (strncmp(m, "Claude ", 7) == 0) m += 7;
    strlcpy(modelClean, m, sizeof(modelClean));
  }

  int timeW = tft.textWidth(timeStr, 4);
  int ampmW = (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) ? (tft.textWidth(ampmStr, 2) + 4) : 0;
  int timeRight = 12 + timeW + ampmW + 4;

  int provW = tft.textWidth(tokenCache.provider, 2);
  bool hasModel = strlen(modelClean) > 0;
  int modelTextW = hasModel ? tft.textWidth(modelClean, 1) : 0;
  int modelBadgeW = hasModel ? (modelTextW + 8) : 0;

  // If combined width exceeds bounds, shorten prefix
  if (hasModel && (timeRight + 22 + provW + modelBadgeW > 228)) {
    if (strncmp(modelClean, "GPT-", 4) == 0) {
      char tmp[24];
      strlcpy(tmp, modelClean + 4, sizeof(tmp));
      strlcpy(modelClean, tmp, sizeof(modelClean));
      modelTextW = tft.textWidth(modelClean, 1);
      modelBadgeW = modelTextW + 8;
    }
  }

  int pillW = 22 + provW + (hasModel ? (4 + modelBadgeW) : 0);
  int pillX = 228 - pillW;
  if (pillX < timeRight) {
    pillX = timeRight;
    pillW = 228 - pillX;
  }

  tft.fillRoundRect(pillX, 10, pillW, 20, 6, pillBg);
  tft.drawRoundRect(pillX, 10, pillW, 20, 6, pillText);

  // Draw actual provider icon
  int iconX = pillX + 9;
  int iconY = 20;
  if (strstr(tokenCache.provider, "Gemini")) {
    // 4-pointed Gemini star sparkle
    tft.fillTriangle(iconX, iconY - 6, iconX - 2, iconY, iconX + 2, iconY, pillText);
    tft.fillTriangle(iconX, iconY + 6, iconX - 2, iconY, iconX + 2, iconY, pillText);
    tft.fillTriangle(iconX - 6, iconY, iconX, iconY - 2, iconX, iconY + 2, pillText);
    tft.fillTriangle(iconX + 6, iconY, iconX, iconY - 2, iconX, iconY + 2, pillText);
  } else if (strstr(tokenCache.provider, "Open") || strstr(tokenCache.provider, "Codex") || strstr(tokenCache.provider, "GPT")) {
    // 6-lobed spiral rosette (OpenAI logo)
    for (int a = 0; a < 360; a += 60) {
      float rad = a * 0.01745329f;
      float rad2 = (a + 40) * 0.01745329f;
      int x1 = iconX + (int)(cos(rad) * 1.8f);
      int y1 = iconY + (int)(sin(rad) * 1.8f);
      int x2 = iconX + (int)(cos(rad2) * 5.0f);
      int y2 = iconY + (int)(sin(rad2) * 5.0f);
      tft.drawLine(x1, y1, x2, y2, pillText);
    }
    tft.drawCircle(iconX, iconY, 1, pillText);
  } else if (strstr(tokenCache.provider, "Claude")) {
    // Claude 8-pointed star
    tft.drawFastHLine(iconX - 5, iconY, 11, pillText);
    tft.drawFastVLine(iconX, iconY - 5, 11, pillText);
    tft.drawLine(iconX - 4, iconY - 4, iconX + 4, iconY + 4, pillText);
    tft.drawLine(iconX - 4, iconY + 4, iconX + 4, iconY - 4, pillText);
  } else {
    // OpenCode bracket
    tft.drawRect(iconX - 4, iconY - 4, 8, 9, pillText);
  }

  tft.setTextDatum(ML_DATUM);
  tft.setTextColor(pillText, pillBg);
  tft.drawString(tokenCache.provider, pillX + 18, 20, 2);

  // Model Sub-Badge Pill
  if (hasModel && (pillX + 18 + provW + 4 + modelBadgeW <= 228)) {
    int badgeX = pillX + 18 + provW + 4;
    int badgeY = 13;
    int badgeH = 14;
    tft.fillRoundRect(badgeX, badgeY, modelBadgeW, badgeH, 3, TFT_BLACK);
    tft.drawRoundRect(badgeX, badgeY, modelBadgeW, badgeH, 3, pillText);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(pillText, TFT_BLACK);
    tft.drawString(modelClean, badgeX + (modelBadgeW / 2), badgeY + (badgeH / 2), 1);
  }

  // Hairline separator
  tft.drawFastHLine(12, 42, 216, 0x2965);

  // Meter 1: Session / Rate Limit (Y: 50)
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(pillText, TFT_BLACK);
  bool hasSessionUsage = tokenCache.sessionTokens > 0;
  bool hasWeeklyUsage = tokenCache.weeklyTokens > 0;
  const char* sessionMeterLabel = tokenCache.sessionPct < 0 && hasSessionUsage ? "TOKENS USED" : (strlen(tokenCache.sessionLabel) > 0 ? tokenCache.sessionLabel : "5-HOUR LIMIT");
  const char* weeklyMeterLabel = tokenCache.weeklyPct < 0 && hasWeeklyUsage ? "SESSION TOTAL" : (strlen(tokenCache.weeklyLabel) > 0 ? tokenCache.weeklyLabel : "WEEKLY LIMIT");
  tft.drawString(sessionMeterLabel, 12, 52, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString(tokenCache.sessionPct >= 0 ? tokenCache.sessionReset : "--", 228, 52, 2);

  // Track & Fill Bar
  int barW = 216;
  int barH = 10;
  tft.fillRoundRect(12, 72, barW, barH, 4, 0x18E3); // Dark slate track
  int filledW1 = tokenCache.sessionPct >= 0 ? constrain((tokenCache.sessionPct * barW) / 100, 0, barW) : 0;
  if (filledW1 > 0) {
    tft.fillRoundRect(12, 72, filledW1, barH, 4, getUsageColor565(tokenCache.sessionPct));
  }

  // Sub-row: Percentage Remaining (left), "%" (right)
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0xCE79, TFT_BLACK);
  char sessionUsageBuf[24];
  if (tokenCache.sessionPct < 0 && hasSessionUsage) {
    char compact[12];
    formatTokenCount(tokenCache.sessionTokens, compact, sizeof(compact));
    snprintf(sessionUsageBuf, sizeof(sessionUsageBuf), "%s used", compact);
  } else {
    strlcpy(sessionUsageBuf, tokenCache.sessionPct >= 0 ? tokenCache.sessionText : "UNAVAILABLE", sizeof(sessionUsageBuf));
  }
  tft.drawString(sessionUsageBuf, 12, 88, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(getUsageColor565(tokenCache.sessionPct), TFT_BLACK);
  char pct1Buf[12];
  if (tokenCache.sessionPct >= 0) snprintf(pct1Buf, sizeof(pct1Buf), "%d%%", tokenCache.sessionPct);
  else strlcpy(pct1Buf, "--", sizeof(pct1Buf));
  tft.drawString(pct1Buf, 228, 88, 2);

  // Meter 2: Weekly Quota / Daily Output (Y: 114)
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0x9CD3, TFT_BLACK);
  tft.drawString(weeklyMeterLabel, 12, 114, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xAD55, TFT_BLACK);
  tft.drawString(tokenCache.weeklyPct >= 0 ? tokenCache.weeklyReset : "--", 228, 114, 2);

  tft.fillRoundRect(12, 134, barW, barH, 4, 0x18E3);
  int filledW2 = tokenCache.weeklyPct >= 0 ? constrain((tokenCache.weeklyPct * barW) / 100, 0, barW) : 0;
  if (filledW2 > 0) {
    tft.fillRoundRect(12, 134, filledW2, barH, 4, getUsageColor565(tokenCache.weeklyPct));
  }

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0xCE79, TFT_BLACK);
  char weeklyUsageBuf[24];
  if (tokenCache.weeklyPct < 0 && hasWeeklyUsage) {
    char compact[12];
    formatTokenCount(tokenCache.weeklyTokens, compact, sizeof(compact));
    snprintf(weeklyUsageBuf, sizeof(weeklyUsageBuf), "%s total", compact);
  } else {
    strlcpy(weeklyUsageBuf, tokenCache.weeklyPct >= 0 ? tokenCache.weeklyText : "UNAVAILABLE", sizeof(weeklyUsageBuf));
  }
  tft.drawString(weeklyUsageBuf, 12, 150, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(getUsageColor565(tokenCache.weeklyPct), TFT_BLACK);
  char pct2Buf[12];
  if (tokenCache.weeklyPct >= 0) snprintf(pct2Buf, sizeof(pct2Buf), "%d%%", tokenCache.weeklyPct);
  else strlcpy(pct2Buf, "--", sizeof(pct2Buf));
  tft.drawString(pct2Buf, 228, 150, 2);

  // Bottom Status Dock (Y: 182 - 228)
  bool isOnline = tokenCache.laptopConnected;
  uint16_t dockBg = isOnline ? 0x0842 : 0x0000;
  tft.fillRoundRect(12, 182, 216, 44, 6, dockBg);
  tft.drawRoundRect(12, 182, 216, 44, 6, 0x2965);

  tft.fillCircle(24, 204, 4, isOnline ? TFT_GREEN : 0x4208);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(isOnline ? TFT_WHITE : 0x7BEF, dockBg);
  tft.drawString(isOnline ? "LAPTOP SYNCED" : "LAPTOP IDLE", 36, 196, 2);

  tft.setTextDatum(TR_DATUM);
  uint16_t stateCol = TFT_GREEN;
  if (strcmp(tokenCache.agentState, "WORKING") == 0) stateCol = TFT_ORANGE;
  else if (strcmp(tokenCache.agentState, "WAITING") == 0) stateCol = 0x3DFE;
  tft.setTextColor(isOnline ? stateCol : 0x7BEF, dockBg);
  tft.drawString(isOnline ? tokenCache.agentState : "STANDBY", 218, 196, 2);
}

// -------------------------------------------------------------
// THEME 5: Cosmic Shuttle & Prayer Station
// -------------------------------------------------------------
void renderThemeShuttlePrayer() {
  tft.fillScreen(TFT_BLACK);

  char timeStr[16];
  char ampmStr[6];
  char dateStr[32];
  getTimeAndDate(timeStr, sizeof(timeStr), ampmStr, sizeof(ampmStr), dateStr, sizeof(dateStr));

  // Top Bar: Location + Live ONLINE Tag
  tft.fillCircle(15, 12, 3, 0x9CD3);
  tft.drawCircle(15, 12, 1, TFT_BLACK);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("Dhaka", 22, 6, 2);

  tft.setTextColor(0x9CD3, TFT_BLACK);
  tft.drawString(dateStr, 15, 20, 1);

  // Online status capsule (right)
  tft.fillRoundRect(172, 6, 56, 15, 7, 0x0200);
  tft.drawRoundRect(172, 6, 56, 15, 7, TFT_GREEN);
  tft.fillCircle(181, 13, 2, TFT_GREEN);
  tft.setTextDatum(ML_DATUM);
  tft.setTextColor(TFT_GREEN, 0x0200);
  tft.drawString("ONLINE", 188, 13, 1);

  // Mid Strip: Space Shuttle flight simulation (left) + Clock & Sun capsule (right)
  // Background starry void
  tft.drawPixel(20, 40, TFT_WHITE);
  tft.drawPixel(70, 36, 0xCE79);
  tft.drawPixel(34, 68, TFT_WHITE);
  tft.drawPixel(64, 66, 0x9CD3);

  // Space Shuttle (Delta wings + Fuselage body + Thermal nose cone + Cockpit)
  tft.fillTriangle(26, 54, 44, 42, 60, 54, TFT_WHITE);
  tft.fillTriangle(26, 54, 44, 66, 60, 54, TFT_WHITE);
  tft.drawLine(26, 54, 44, 42, 0x18E3);
  tft.drawLine(26, 54, 44, 66, 0x18E3);
  tft.fillRoundRect(30, 50, 36, 8, 4, TFT_WHITE);
  tft.fillTriangle(62, 50, 68, 54, 62, 58, 0x18E3);
  tft.fillRect(54, 52, 4, 3, 0x3DFE); // Cyan cockpit glass
  tft.fillTriangle(30, 51, 38, 38, 42, 51, 0xCE79); // Tail fin
  tft.drawLine(33, 49, 39, 40, TFT_RED);
  tft.fillRect(25, 52, 3, 4, 0x4208); // Engine nozzles

  // Dynamic exhaust plume animation
  if (((millis() / 250) % 2) == 0) {
    tft.fillTriangle(14, 54, 25, 51, 25, 57, TFT_ORANGE);
    tft.fillTriangle(19, 54, 25, 52, 25, 56, TFT_YELLOW);
  } else {
    tft.fillTriangle(10, 54, 25, 50, 25, 58, 0xFDA0);
    tft.fillTriangle(17, 54, 25, 52, 25, 56, TFT_WHITE);
  }

  // Right: Luminous Amber Clock
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString(timeStr, 228, 30, 4);

  if (strcmp(deviceConfig.hourFormat, "12-Hour") == 0) {
    tft.setTextColor(0xFDA0, TFT_BLACK);
    tft.drawString(ampmStr, 228, 52, 1);
  }

  // Sunrise / Sunset Capsule (Formatted 12/24H)
  char sunrise12[8], sunset12[8];
  formatPrayerTime(prayerCache.sunrise, sunrise12, sizeof(sunrise12));
  formatPrayerTime(prayerCache.maghrib, sunset12, sizeof(sunset12));

  tft.fillRoundRect(126, 56, 102, 16, 4, 0x10A2);
  tft.drawRoundRect(126, 56, 102, 16, 4, 0x2124);
  tft.setTextDatum(ML_DATUM);
  tft.setTextColor(0xFDA0, 0x10A2);
  tft.drawString(sunrise12, 148, 64, 1);
  tft.drawFastVLine(176, 58, 12, 0x3186);
  tft.setTextColor(0xFD20, 0x10A2);
  tft.drawString(sunset12, 198, 64, 1);

  // Calculate dynamic next waqt & countdown
  auto parseMin = [](const char* str) -> int {
    if (!str || strlen(str) < 5) return 0;
    int h = (str[0] - '0') * 10 + (str[1] - '0');
    int m = (str[3] - '0') * 10 + (str[4] - '0');
    return h * 60 + m;
  };

  time_t now = time(nullptr);
  struct tm* ti = localtime(&now);
  int curMin = (ti ? ti->tm_hour : 8) * 60 + (ti ? ti->tm_min : 21);
  int curSec = (ti ? ti->tm_sec : 0);
  int curTotalSec = curMin * 60 + curSec;

  int fMin = parseMin(prayerCache.fajr);
  int dMin = parseMin(prayerCache.dhuhr);
  int aMin = parseMin(prayerCache.asr);
  int mMin = parseMin(prayerCache.maghrib);
  int iMin = parseMin(prayerCache.isha);

  int activeIdx = 0;
  int targetSec = 0;
  const char* nextName = "FAJR";

  if (curMin < fMin) {
    activeIdx = 0;
    targetSec = fMin * 60;
    nextName = "FAJR";
  } else if (curMin < dMin) {
    activeIdx = 1;
    targetSec = dMin * 60;
    nextName = "DHUHR";
  } else if (curMin < aMin) {
    activeIdx = 2;
    targetSec = aMin * 60;
    nextName = "ASR";
  } else if (curMin < mMin) {
    activeIdx = 3;
    targetSec = mMin * 60;
    nextName = "MAGHRIB";
  } else if (curMin < iMin) {
    activeIdx = 4;
    targetSec = iMin * 60;
    nextName = "ISHA";
  } else {
    activeIdx = 0;
    targetSec = (fMin + 1440) * 60;
    nextName = "FAJR";
  }

  int diffSec = targetSec > curTotalSec ? (targetSec - curTotalSec) : 0;
  int diffH = diffSec / 3600;
  int diffM = (diffSec % 3600) / 60;
  int diffS = diffSec % 60;
  char countdownBuf[16];
  snprintf(countdownBuf, sizeof(countdownBuf), "%02d:%02d:%02d", diffH, diffM, diffS);

  // Main Prayer Table (Y: 76 to 172)
  tft.fillRoundRect(12, 76, 216, 96, 6, TFT_BLACK);
  tft.drawRoundRect(12, 76, 216, 96, 6, 0x2104);

  // Table Column Headers
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawString("PRAYER", 20, 80, 1);
  tft.setTextDatum(TC_DATUM);
  tft.drawString("START", 120, 80, 1);
  tft.setTextDatum(TR_DATUM);
  tft.drawString("END", 220, 80, 1);

  char fStart[8], fEnd[8];
  char dStart[8], dEnd[8];
  char aStart[8], aEnd[8];
  char mStart[8], mEnd[8];
  char iStart[8], iEnd[8];

  formatPrayerTime(prayerCache.fajr, fStart, sizeof(fStart));
  formatPrayerTime(prayerCache.sunrise, fEnd, sizeof(fEnd));
  formatPrayerTime(prayerCache.dhuhr, dStart, sizeof(dStart));
  formatPrayerTime(prayerCache.asr, dEnd, sizeof(dEnd));
  formatPrayerTime(prayerCache.asr, aStart, sizeof(aStart));
  formatPrayerTime(prayerCache.maghrib, aEnd, sizeof(aEnd));
  formatPrayerTime(prayerCache.maghrib, mStart, sizeof(mStart));
  formatPrayerTime(prayerCache.isha, mEnd, sizeof(mEnd));
  formatPrayerTime(prayerCache.isha, iStart, sizeof(iStart));
  formatPrayerTime(prayerCache.fajr, iEnd, sizeof(iEnd));

  struct WaqtRow {
    const char* name;
    const char* start;
    const char* end;
  } rows[5] = {
    {"Fajr", fStart, fEnd},
    {"Dhuhr", dStart, dEnd},
    {"Asr", aStart, aEnd},
    {"Maghrib", mStart, mEnd},
    {"Isha", iStart, iEnd}
  };

  int startY = 92;
  for (int i = 0; i < 5; ++i) {
    int y = startY + i * 16;
    if (i == activeIdx) {
      // Highlighted Active / Upcoming Waqt Row
      tft.fillRoundRect(14, y - 3, 212, 16, 4, 0x31C0);
      tft.drawRoundRect(14, y - 3, 212, 16, 4, 0xFDA0);
      tft.drawCircle(22, y + 5, 3, 0xFDA0);
      tft.fillCircle(24, y + 4, 3, 0x31C0);
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(0xFDA0, 0x31C0);
      tft.drawString(rows[i].name, 28, y, 1);
      tft.setTextDatum(TC_DATUM);
      tft.drawString(rows[i].start, 120, y, 1);
      tft.setTextDatum(TR_DATUM);
      tft.drawString(rows[i].end, 220, y, 1);
    } else {
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString(rows[i].name, 20, y, 1);
      tft.setTextDatum(TC_DATUM);
      tft.drawString(rows[i].start, 120, y, 1);
      tft.setTextDatum(TR_DATUM);
      tft.drawString(rows[i].end, 220, y, 1);
    }
  }

  // Bottom Hero Countdown Card (Y: 178 to 226)
  tft.fillRoundRect(12, 178, 216, 48, 6, 0x18C0);
  tft.drawRoundRect(12, 178, 216, 48, 6, 0xFDA0);

  // Hourglass Icon
  tft.drawTriangle(22, 190, 34, 190, 28, 202, 0xFDA0);
  tft.drawTriangle(22, 214, 34, 214, 28, 202, 0xFDA0);
  tft.drawFastVLine(40, 186, 32, 0x62C0);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(0xFDA0, 0x18C0);
  char nextBuf[24];
  snprintf(nextBuf, sizeof(nextBuf), "NEXT: %s", nextName);
  tft.drawString(nextBuf, 48, 190, 2);
  tft.setTextColor(0x9CD3, 0x18C0);
  tft.drawString("STARTS IN", 48, 208, 1);

  // Recessed countdown clock box (right)
  tft.fillRoundRect(140, 184, 82, 36, 4, TFT_BLACK);
  tft.drawRoundRect(140, 184, 82, 36, 4, 0x62C0);
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(0xFDA0, TFT_BLACK);
  tft.drawString(countdownBuf, 181, 188, 2);
  tft.setTextColor(0x7BEF, TFT_BLACK);
  tft.drawString("HRS  MIN  SEC", 181, 208, 1);
}

void renderCurrentTheme();

bool copyPrayerTime(char* destination, size_t destinationSize, const char* source) {
  if (!source || destinationSize < 6 || strlen(source) < 5 || source[2] != ':') return false;
  memcpy(destination, source, 5);
  destination[5] = '\0';
  return true;
}

bool refreshPrayerTimes() {
  if (WiFi.status() != WL_CONNECTED) return false;

  time_t now = time(nullptr);
  struct tm* current = localtime(&now);
  if (!current || current->tm_year + 1900 < 2024) return false;

  char url[256];
  int school = strcasecmp(deviceConfig.asrMethod, "Hanafi") == 0 ? 1 : 0;
  snprintf(url, sizeof(url),
    "https://api.aladhan.com/v1/timings/%02d-%02d-%04d?latitude=%.4f&longitude=%.4f&method=%s&school=%d",
    current->tm_mday, current->tm_mon + 1, current->tm_year + 1900,
    deviceConfig.latitude, deviceConfig.longitude, deviceConfig.prayerMethod, school);

  BearSSL::WiFiClientSecure client;
  client.setInsecure();
  client.setBufferSizes(512, 512);
  HTTPClient http;
  http.setTimeout(6000);
  http.useHTTP10(true);
  if (!http.begin(client, url)) return false;

  int status = http.GET();
  if (status != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, http.getStream());
  http.end();
  if (error || doc["code"] != 200) return false;

  JsonObject timings = doc["data"]["timings"];
  char fajr[8], sunrise[8], dhuhr[8], asr[8], maghrib[8], isha[8];
  if (!copyPrayerTime(fajr, sizeof(fajr), timings["Fajr"]) ||
      !copyPrayerTime(sunrise, sizeof(sunrise), timings["Sunrise"]) ||
      !copyPrayerTime(dhuhr, sizeof(dhuhr), timings["Dhuhr"]) ||
      !copyPrayerTime(asr, sizeof(asr), timings["Asr"]) ||
      !copyPrayerTime(maghrib, sizeof(maghrib), timings["Maghrib"]) ||
      !copyPrayerTime(isha, sizeof(isha), timings["Isha"])) return false;

  strlcpy(prayerCache.fajr, fajr, sizeof(prayerCache.fajr));
  strlcpy(prayerCache.sunrise, sunrise, sizeof(prayerCache.sunrise));
  strlcpy(prayerCache.dhuhr, dhuhr, sizeof(prayerCache.dhuhr));
  strlcpy(prayerCache.asr, asr, sizeof(prayerCache.asr));
  strlcpy(prayerCache.maghrib, maghrib, sizeof(prayerCache.maghrib));
  strlcpy(prayerCache.isha, isha, sizeof(prayerCache.isha));
  return true;
}

void renderCurrentTheme() {
  if (strcmp(deviceConfig.theme, "Editorial Weather Clock") == 0) {
    renderThemeEditorialClock();
  } else if (strcmp(deviceConfig.theme, "Minimalist Clean Clock") == 0) {
    renderThemeMinimalClock();
  } else if (strcmp(deviceConfig.theme, "AI Token & Rate Monitor") == 0) {
    renderThemeTokenMonitor();
  } else if (strcmp(deviceConfig.theme, "Cosmic Shuttle & Prayer Station") == 0) {
    renderThemeShuttlePrayer();
  } else {
    renderThemePrayerWeather();
  }
}

void rotateToNextTheme() {
  int cur = 0;
  for (int i = 0; i < NUM_THEMES; ++i) {
    if (strcmp(deviceConfig.theme, allThemes[i]) == 0) {
      cur = i;
      break;
    }
  }
  int next = (cur + 1) % NUM_THEMES;
  strlcpy(deviceConfig.theme, allThemes[next], sizeof(deviceConfig.theme));
  renderCurrentTheme();
}

// REST API Handlers
void handleApiStatus() {
  JsonDocument doc;
  doc["model"] = "SmallTV-Ultra";
  doc["firmware"] = "Ultra-V9.0.64-Custom";
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
  doc["display"]["autoSwitch"] = deviceConfig.autoSwitch;
  doc["display"]["switchInterval"] = deviceConfig.switchInterval;
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
  if (doc["display"]["autoSwitch"].is<bool>()) {
    deviceConfig.autoSwitch = doc["display"]["autoSwitch"];
  }
  if (doc["display"]["switchInterval"].is<int>()) {
    deviceConfig.switchInterval = max(5, (int)doc["display"]["switchInterval"]);
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

  if (doc["prayer"].is<JsonObject>()) {
    lastPrayerAttemptMillis = 0;
    lastPrayerSyncMillis = 0;
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

void handleApiTokensGet() {
  JsonDocument doc;
  doc["provider"] = tokenCache.provider;
  doc["model"] = tokenCache.model;
  doc["sessionLabel"] = tokenCache.sessionLabel;
  doc["sessionTokens"] = tokenCache.sessionTokens;
  doc["sessionLimit"] = tokenCache.sessionLimit;
  doc["sessionPct"] = tokenCache.sessionPct;
  doc["sessionText"] = tokenCache.sessionText;
  doc["sessionReset"] = tokenCache.sessionReset;
  doc["weeklyLabel"] = tokenCache.weeklyLabel;
  doc["weeklyTokens"] = tokenCache.weeklyTokens;
  doc["weeklyLimit"] = tokenCache.weeklyLimit;
  doc["weeklyPct"] = tokenCache.weeklyPct;
  doc["weeklyText"] = tokenCache.weeklyText;
  doc["weeklyReset"] = tokenCache.weeklyReset;
  doc["agentState"] = tokenCache.agentState;
  doc["isLaptopOnline"] = tokenCache.laptopConnected;
  doc["telemetryState"] = tokenCache.telemetryState;
  doc["sourceLabel"] = tokenCache.sourceLabel;
  doc["observedAt"] = tokenCache.observedAt;
  doc["sessionWindowMinutes"] = tokenCache.sessionWindowMinutes;
  doc["weeklyWindowMinutes"] = tokenCache.weeklyWindowMinutes;

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

void handleApiTokensPost() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain")) != DeserializationError::Ok) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc["provider"].is<const char*>()) strlcpy(tokenCache.provider, doc["provider"], sizeof(tokenCache.provider));
  else if (doc["provider"].isNull()) tokenCache.provider[0] = '\0';
  if (doc["model"].is<const char*>()) strlcpy(tokenCache.model, doc["model"], sizeof(tokenCache.model));
  else if (doc["model"].isNull()) tokenCache.model[0] = '\0';
  if (doc["sessionLabel"].is<const char*>()) strlcpy(tokenCache.sessionLabel, doc["sessionLabel"], sizeof(tokenCache.sessionLabel));
  if (doc["weeklyLabel"].is<const char*>()) strlcpy(tokenCache.weeklyLabel, doc["weeklyLabel"], sizeof(tokenCache.weeklyLabel));
  // Clear retained usage when the collector explicitly reports an unavailable source.
  if (doc["sessionTokens"].is<long>()) tokenCache.sessionTokens = doc["sessionTokens"];
  else if (doc["sessionTokens"].isNull()) tokenCache.sessionTokens = 0;
  if (doc["sessionLimit"].is<long>()) tokenCache.sessionLimit = doc["sessionLimit"];
  else if (doc["sessionLimit"].isNull()) tokenCache.sessionLimit = 0;
  if (doc["weeklyTokens"].is<long>()) tokenCache.weeklyTokens = doc["weeklyTokens"];
  else if (doc["weeklyTokens"].isNull()) tokenCache.weeklyTokens = 0;
  if (doc["weeklyLimit"].is<long>()) tokenCache.weeklyLimit = doc["weeklyLimit"];
  else if (doc["weeklyLimit"].isNull()) tokenCache.weeklyLimit = 0;
  if (doc["sessionPct"].is<int>()) tokenCache.sessionPct = constrain((int)doc["sessionPct"], 0, 100);
  else if (doc["sessionPct"].isNull()) tokenCache.sessionPct = -1;
  
  if (doc["sessionText"].is<const char*>()) {
    strlcpy(tokenCache.sessionText, doc["sessionText"], sizeof(tokenCache.sessionText));
  } else if (doc["sessionTokens"].is<long>() && doc["sessionLimit"].is<long>()) {
    long cur = doc["sessionTokens"];
    long lim = doc["sessionLimit"];
    if (lim > 0 && !doc["sessionPct"].is<int>()) tokenCache.sessionPct = constrain((int)((cur * 100) / lim), 0, 100);
    if (lim <= 100) {
      snprintf(tokenCache.sessionText, sizeof(tokenCache.sessionText), "%d%% Remaining", tokenCache.sessionPct);
    } else if (lim >= 1000000) {
      snprintf(tokenCache.sessionText, sizeof(tokenCache.sessionText), "%.1fk / %.1fM", cur / 1000.0, lim / 1000000.0);
    } else {
      snprintf(tokenCache.sessionText, sizeof(tokenCache.sessionText), "%.1fk / %ldk", cur / 1000.0, lim / 1000);
    }
  }

  if (doc["sessionReset"].is<const char*>()) strlcpy(tokenCache.sessionReset, doc["sessionReset"], sizeof(tokenCache.sessionReset));
  else if (doc["sessionReset"].isNull()) tokenCache.sessionReset[0] = '\0';
  if (doc["weeklyPct"].is<int>()) tokenCache.weeklyPct = constrain((int)doc["weeklyPct"], 0, 100);
  else if (doc["weeklyPct"].isNull()) tokenCache.weeklyPct = -1;
  if (doc["telemetryState"].is<const char*>()) strlcpy(tokenCache.telemetryState, doc["telemetryState"], sizeof(tokenCache.telemetryState));
  if (doc["sourceLabel"].is<const char*>()) strlcpy(tokenCache.sourceLabel, doc["sourceLabel"], sizeof(tokenCache.sourceLabel));
  if (doc["observedAt"].is<unsigned long>()) tokenCache.observedAt = doc["observedAt"];
  else if (doc["observedAt"].isNull()) tokenCache.observedAt = 0;
  if (doc["sessionWindowMinutes"].is<int>()) tokenCache.sessionWindowMinutes = doc["sessionWindowMinutes"];
  if (doc["weeklyWindowMinutes"].is<int>()) tokenCache.weeklyWindowMinutes = doc["weeklyWindowMinutes"];

  if (doc["weeklyText"].is<const char*>()) {
    strlcpy(tokenCache.weeklyText, doc["weeklyText"], sizeof(tokenCache.weeklyText));
  } else if (doc["weeklyTokens"].is<long>() && doc["weeklyLimit"].is<long>()) {
    long cur = doc["weeklyTokens"];
    long lim = doc["weeklyLimit"];
    if (lim > 0 && !doc["weeklyPct"].is<int>()) tokenCache.weeklyPct = constrain((int)((cur * 100) / lim), 0, 100);
    if (lim <= 100) {
      snprintf(tokenCache.weeklyText, sizeof(tokenCache.weeklyText), "%d%% Remaining", tokenCache.weeklyPct);
    } else if (cur >= 1000000) {
      snprintf(tokenCache.weeklyText, sizeof(tokenCache.weeklyText), "%.1fM / %.1fM", cur / 1000000.0, lim / 1000000.0);
    } else {
      snprintf(tokenCache.weeklyText, sizeof(tokenCache.weeklyText), "%ldk / %.1fM", cur / 1000, lim / 1000000.0);
    }
  }

  if (doc["weeklyReset"].is<const char*>()) strlcpy(tokenCache.weeklyReset, doc["weeklyReset"], sizeof(tokenCache.weeklyReset));
  else if (doc["weeklyReset"].isNull()) tokenCache.weeklyReset[0] = '\0';
  if (doc["agentState"].is<const char*>()) strlcpy(tokenCache.agentState, doc["agentState"], sizeof(tokenCache.agentState));

  tokenCache.laptopConnected = strcmp(tokenCache.telemetryState, "unavailable") != 0 && strlen(tokenCache.provider) > 0;
  tokenCache.lastSyncMillis = millis();

  if (strcmp(deviceConfig.theme, "AI Token & Rate Monitor") == 0) {
    renderCurrentTheme();
  }

  server.send(200, "application/json", "{\"success\":true,\"message\":\"Tokens updated.\"}");
}

void handleApiSystemReset() {
  if (LittleFS.exists("/config.json")) LittleFS.remove("/config.json");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Settings erased; rebooting into setup mode\"}");
  delay(500);
  ESP.restart();
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
  prayerClockSprite.setColorDepth(1);
  prayerClockSpriteReady = prayerClockSprite.createSprite(PRAYER_CLOCK_W, PRAYER_CLOCK_H) != nullptr;
  showBootAnimation();

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
  server.on("/api/tokens", HTTP_GET, handleApiTokensGet);
  server.on("/api/tokens", HTTP_POST, handleApiTokensPost);
  server.on("/api/wifi/scan", HTTP_GET, handleApiWifiScan);
  server.on("/api/wifi/connect", HTTP_POST, handleApiWifiConnect);
  server.on("/api/system/reboot", HTTP_POST, []() {
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Rebooting...\"}");
    delay(500);
    ESP.restart();
  });
  server.on("/api/system/reset", HTTP_POST, handleApiSystemReset);

  server.begin();
  Serial.println("SmallTV Web Server started with True Black ST7789 themes.");
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();

  unsigned long nowMillis = millis();
  bool prayerDue = lastPrayerSyncMillis == 0 || nowMillis - lastPrayerSyncMillis >= 21600000UL;
  bool prayerRetryReady = lastPrayerAttemptMillis == 0 || nowMillis - lastPrayerAttemptMillis >= 300000UL;
  time_t prayerNow = time(nullptr);
  struct tm* prayerClock = localtime(&prayerNow);
  bool prayerClockReady = prayerClock && prayerClock->tm_year + 1900 >= 2024;
  if (prayerDue && prayerRetryReady && prayerClockReady && WiFi.status() == WL_CONNECTED) {
    lastPrayerAttemptMillis = nowMillis;
    if (refreshPrayerTimes()) {
      lastPrayerSyncMillis = nowMillis;
      Serial.println("Prayer times updated from AlAdhan.");
      renderCurrentTheme();
    } else {
      Serial.println("Prayer time update failed; retrying in 5 minutes.");
    }
  }

  // Dynamic Theme Looping: automatically rotate themes sequentially
  if (deviceConfig.autoSwitch) {
    static unsigned long lastAutoRotate = 0;
    unsigned long intervalMs = (unsigned long)max(5, deviceConfig.switchInterval) * 1000;
    if (millis() - lastAutoRotate >= intervalMs) {
      lastAutoRotate = millis();
      rotateToNextTheme();
    }
  }

  // Laptop companion idle check: if no telemetry received for 60s, mark idle
  if (tokenCache.laptopConnected && tokenCache.lastSyncMillis > 0 && (millis() - tokenCache.lastSyncMillis > 60000)) {
    tokenCache.laptopConnected = false;
    if (strcmp(deviceConfig.theme, "AI Token & Rate Monitor") == 0) {
      renderCurrentTheme();
    }
  }

  bool prayerWeatherTheme = strcmp(deviceConfig.theme, "Weather & Prayer Station") == 0;
  if (prayerWeatherTheme) {
    static unsigned long lastClockFrame = 0;
    static unsigned long lastWeatherFrame = 0;

    if (millis() - lastClockFrame >= 500) {
      lastClockFrame = millis();
      drawPrayerWeatherClock(((millis() / 500) % 2) == 0);
    }

    if (millis() - lastWeatherFrame >= 250) {
      lastWeatherFrame = millis();
      drawSunAndCloud(10, 26, (millis() / 250) % 8);
    }
  }

  // Update only dynamic regions on the prayer/weather theme to avoid a full-screen flash.
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  int curMin = t ? t->tm_min : (millis() / 60000);
  if (curMin != lastRenderedMinute) {
    lastTick = millis();
    lastRenderedMinute = curMin;
    if (prayerWeatherTheme) {
      drawPrayerWeatherClock(true);
      drawPrayerWeatherDate();
      drawPrayerWeatherSchedule();
    } else {
      renderCurrentTheme();
    }
  }
}
