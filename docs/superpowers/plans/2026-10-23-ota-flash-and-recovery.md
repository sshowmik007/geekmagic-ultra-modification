# Implementation Plan: SmallTV-Ultra OTA Firmware Flash and Verification

## Objective
Safely upload `custom_dashboard_firmware.bin` to the physical SmallTV-Ultra device via `http://192.168.0.198/update`, observe reboot, and verify the new web dashboard and REST APIs live on hardware.

## Pre-flight Checklist
- [x] Target device is online (`192.168.0.198:80` responsive).
- [x] Binaries cryptographically verified (Magic byte `0xE9`, MD5 confirmed).
- [x] Stock rollback firmware staged (`STOCK_ROLLBACK_Ultra-V9.0.50.bin`).
- [x] User authorization obtained ("yes bismillah").

## Steps

### Step 1: Pre-Flash Ping Check
Confirm HTTP connectivity to `http://192.168.0.198/update`.

### Step 2: Perform OTA Upload
Execute:
```powershell
curl.exe -v --connect-timeout 10 --max-time 120 -F "firmware=@smalltv-dashboard\releases\custom_dashboard_firmware.bin" http://192.168.0.198/update
```
Verify HTTP response: `200 OK` with restart notification or ESP8266 updater success message.

### Step 3: Monitor Device Reboot Cycle
- Wait 25 seconds for ESP8266 flash finalization and reset.
- Poll `Test-NetConnection -ComputerName 192.168.0.198 -Port 80`.

### Step 4: Verify Custom Firmware Runtime
- Request `http://192.168.0.198/api/status`.
- Request `http://192.168.0.198/` to load embedded Gzip web dashboard from flash memory.
- Inspect dashboard via Chrome DevTools.

### Step 5: Update Tracking Documentation
Update `smalltv-dashboard/context.md` with flash results and device status.

