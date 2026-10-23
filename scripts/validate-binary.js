import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const MAX_OTA_SIZE_BYTES = 1048576; // 1 MB
const ESP8266_MAGIC_BYTE = 0xe9;

export function validateFirmwareBinary(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `File not found: ${filePath}` };
  }

  const stat = fs.statSync(filePath);
  const size = stat.size;

  if (size === 0) {
    return { valid: false, error: "Binary file is empty (0 bytes)." };
  }

  if (size > MAX_OTA_SIZE_BYTES) {
    return {
      valid: false,
      error: `Binary size (${size} bytes) exceeds the 1MB OTA limit (${MAX_OTA_SIZE_BYTES} bytes). Uploading will fail or corrupt memory.`,
    };
  }

  const fd = fs.openSync(filePath, "r");
  const headerBuffer = Buffer.alloc(4);
  fs.readSync(fd, headerBuffer, 0, 4, 0);
  fs.closeSync(fd);

  const magicByte = headerBuffer[0];
  if (magicByte !== ESP8266_MAGIC_BYTE) {
    return {
      valid: false,
      error: `Invalid ESP8266 magic byte: 0x${magicByte.toString(16).toUpperCase()} (Expected: 0xE9). Not a valid ESP8266 image.`,
    };
  }

  const fileBuffer = fs.readFileSync(filePath);
  const md5 = crypto.createHash("md5").update(fileBuffer).digest("hex");

  return {
    valid: true,
    sizeBytes: size,
    sizeKb: (size / 1024).toFixed(2),
    magicByte: `0x${magicByte.toString(16).toUpperCase()}`,
    md5,
    otaCapacityPercent: ((size / MAX_OTA_SIZE_BYTES) * 100).toFixed(1),
  };
}

if (process.argv[1] && process.argv[1].endsWith("validate-binary.js")) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node validate-binary.js <path-to-firmware.bin>");
    process.exit(1);
  }

  const res = validateFirmwareBinary(target);
  if (!res.valid) {
    console.error(`[VALIDATION FAILED] ${res.error}`);
    process.exit(1);
  }

  console.log("==========================================");
  console.log("   ESP8266 Firmware Pre-Flash Check       ");
  console.log("==========================================");
  console.log(`Target:      ${path.basename(target)}`);
  console.log(`Size:        ${res.sizeBytes} bytes (${res.sizeKb} KB)`);
  console.log(`OTA Usage:   ${res.otaCapacityPercent}% of 1MB partition`);
  console.log(`Magic Byte:  ${res.magicByte} (Valid ESP8266 ROM header)`);
  console.log(`MD5:         ${res.md5}`);
  console.log("Status:      ✓ SAFE FOR FLASHING");
  console.log("==========================================");
}

