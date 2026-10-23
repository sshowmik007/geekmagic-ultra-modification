# Project Context: GeekMagic SmallTV-Ultra Custom Firmware & Dashboard

## Current Status (October 2026)
- **Target Hardware**: GeekMagic SmallTV-Ultra (ESP8266EX 80 MHz, 4 MB Flash, 1.54" ST7789 IPS LCD 240x240).
- **Firmware Binary**: `smalltv-dashboard/releases/custom_dashboard_firmware.bin` (Size: 424,160 bytes, Magic Byte: 0xE9, MD5: `0c950393bc216326fbb5c765ba621c08`).
- **Stock Rollback Binary**: `smalltv-dashboard/releases/STOCK_ROLLBACK_Ultra-V9.0.50.bin` (Size: 505,200 bytes).
- **Web Dashboard Bundle**: Inlined & gzipped into `dist/web_assets.h` (14.55 KB Gzip, 1.42% of 1 MB flash).
- **Mock Server**: Running at `http://localhost:3000`.
- **Test Suite**: 13/13 passing tests (`npm test`).

## Resolved Issues & Features Added
1. **Pure True Black IPS Display**:
   - Replaced all `0x0841` (dark bluish-gray) with `TFT_BLACK` (`0x0000`).
   - ST7789 display inversion enabled (`tft.invertDisplay(true)`). Liquid crystal blocks 100% of light, providing inky black background with zero grayish glow.
2. **Mobile Navigation Drawer**:
   - Fixed slide-out drawer animation conflict where `@keyframes appear` overrode `transform: translateX(-100%)`.
   - Dedicated round close button (`.close-drawer-btn`) with 44×44px tap target.
   - Smooth backdrop blur overlay (`.sidebar-overlay`) with click-to-close.
3. **Time & Date Organizer**:
   - 12-Hour (with AM/PM pill badge) vs 24-Hour format toggle.
   - Regional Date Format selector (`DD MMM . Day`, `DD/MM/YYYY`, `YYYY/MM/DD`, `MM/DD/YYYY`, `DD.MM.YYYY`).
   - Dynamic time rendering across all 3 themes using live clock/NTP.
   - Explicit **Save Time & Date Settings** button writing directly to LittleFS `/config.json`.
4. **Functional Wi-Fi Manager**:
   - Live 2.4 GHz network scanner via `GET /api/wifi/scan`.
   - Single-click SSID selection auto-populates credentials form and focuses password input.
   - Connect button submits `POST /api/wifi/connect`, saves credentials to flash, and connects to the user's router.
5. **OTA Firmware Upgrader**:
   - Integrated multipart file upload directly at `/update` and inside the **System** tab.
