# Specification: Three-Theme Firmware Engine & Precision Dashboard

## 1. Context and Objective
The user has confirmed the visual design and requested the implementation of three selectable screen themes on the GeekMagic SmallTV-Ultra (ESP8266 + ST7789 IPS 240x240 display):
1. **Theme 1: Weather Station & 5-Waqt Prayer Times**
   - City ("Dhaka"), Sun + Cloud icon, Time, Date.
   - 5-Waqt Salah Grid (`FAJR`, `DHUHR`, `ASR`, `MAGHRIB`, `ISHA`) with dynamic upcoming prayer highlight.
   - Weather condition banner: `Broken clouds · 28°C`.
   - 4-card telemetry grid: Temperature, Humidity, Wind speed, Sunset.
2. **Theme 2: Minimalist Editorial Clock & Weather Hero**
   - Header: Date (`FRI · 24 OCT`) + Online status dot.
   - Center: Large 58px minimalist digital clock with amber colon.
   - Bottom: Geometric golden sun, `28°C`, `Dhaka · Clear Sky`, HUM `64%`, WIND `2.4m/s`, HIGH `31°`.
3. **Theme 3: Ultra-Clean Minimal Clock**
   - Clean, centered large time digits.
   - Clear AM / PM indicator.
   - Full date (`Friday, 24 October 2026`).

In addition, the web dashboard must support:
- Precision location controls (City, Country, Latitude, Longitude).
- Islamic Prayer Calculation settings (Karachi UISK, MWL, Umm Al-Qura, ISNA, Egypt) and Asr Juristic Method (Hanafi vs Shafi).
- Full `weather.html` feature parity (units, update interval, OpenWeather API key).
- Prominent, styled **"Save Settings"** buttons with instant visual feedback.

## 2. Firmware Architecture & Drawing Engine
- **Target Hardware:** ESP8266EX (80/160 MHz), ST7789 IPS 240×240 SPI display.
- **Backlight Control:** Active-Low PWM on GPIO 5 (`0` = 100% On, `1023` = Off).
- **Display Driver:** `TFT_eSPI` with IPS color inversion enabled (`tft.invertDisplay(true)`).
- **Time Engine:** Standard NTP sync via `configTime(utcOffsetSeconds, 0, "pool.ntp.org", "time.nist.gov")`.
- **Prayer Engine:** AlAdhan REST API client (`http://api.aladhan.com/v1/timingsByCity` or coordinates) with automated fallback to astronomical solar calculation.
- **Weather Engine:** OpenWeatherMap API polling client for temperature, humidity, wind, and conditions.
- **OTA Server:** `ESP8266HTTPUpdateServer` on `/update` for browser flashing and stock rollback.

## 3. Web Dashboard Architecture
- Single compressed bundle (`dist/web_assets.h`, <15 KB Gzip).
- Hash-based navigation (`#overview`, `#display`, `#prayer`, `#weather`, `#time`, `#network`, `#system`).
- Responsive minimalist utilitarian design adhering to `/minimalist-ui`.

