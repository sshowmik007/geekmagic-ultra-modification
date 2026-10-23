# Specification: SmallTV-Ultra OTA Firmware Flash and Recovery Execution

## 1. Context and Objective
The user has authorized the over-the-air (OTA) firmware upgrade of the physical GeekMagic SmallTV-Ultra device on the local network (`http://192.168.0.198/update`).
This specification outlines the execution protocol, payload validation, upload mechanism, device reboot lifecycle, verification criteria, and automatic stock rollback procedures.

## 2. Target Hardware & Network Environment
- **Device Model:** GeekMagic SmallTV-Ultra (ESP8266EX, 4MB Flash)
- **Display:** 1.54" ST7789 IPS 240x240 SPI
- **Device Local IP:** `192.168.0.198` (Port 80)
- **OTA Endpoint:** `http://192.168.0.198/update`
- **Current Running Firmware:** Stock `Ultra-V9.0.51`
- **Fallback Access Point:** `SmallTV-Setup` (192.168.4.1)

## 3. Binaries Staged for Operation
All binaries reside in `smalltv-dashboard/releases/` and have passed pre-flash cryptographic integrity checks:

| Role | Filename | Size | MD5 Checksum | Magic Byte |
|---|---|---|---|---|
| **Target Upgrade** | `custom_dashboard_firmware.bin` | 401,296 B | `0c59fc9b302341aecb677fd07e39a1da` | `0xE9` (Valid) |
| **Stock Rollback** | `STOCK_ROLLBACK_Ultra-V9.0.50.bin` | 505,200 B | `a5fe50093ada3c2637225bbf306a62c3` | `0xE9` (Valid) |

## 4. Flash Transmission Protocol
1. **Endpoint Form Contract:**
   - URL: `http://192.168.0.198/update`
   - Method: `POST`
   - Encoding: `multipart/form-data`
   - Field: `firmware`
2. **Transfer Method:** Direct native `curl.exe` with multipart boundary upload:
   ```powershell
   curl.exe -v -F "firmware=@smalltv-dashboard\releases\custom_dashboard_firmware.bin" http://192.168.0.198/update
   ```
3. **Execution Safety Boundaries:**
   - Timeout set to 60 seconds to accommodate flash write time.
   - Device must not be powered off during the write phase.

## 5. Post-Flash Lifecycle & Verification
1. **Reboot Observation:** The ESP8266 takes ~15-30 seconds to erase the boot partition pointer, write sectors, and reboot.
2. **Verification Steps:**
   - Step 1: TCP Ping to `192.168.0.198:80` to verify Wi-Fi reconnect.
   - Step 2: If IP changes or Station does not reconnect within 45s, scan for SoftAP `SmallTV-Setup` at `192.168.4.1`.
   - Step 3: Fetch `http://192.168.0.198/api/status` to confirm custom firmware runtime.
   - Step 4: Verify ST7789 display shows updated clock and Wi-Fi IP.

## 6. Contingency & Rollback Plan
If custom firmware fails to initialize or boot-loops:
1. Access fallback AP `SmallTV-Setup` at `http://192.168.4.1/update` (built-in `ESP8266HTTPUpdateServer`).
2. Flash `smalltv-dashboard/releases/STOCK_ROLLBACK_Ultra-V9.0.50.bin` using identical multipart curl.
3. In the event of hard physical recovery, UART pins on board back are exposed for 3.3V FTDI recovery.

