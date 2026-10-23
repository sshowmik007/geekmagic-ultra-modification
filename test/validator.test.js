import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateFirmwareBinary } from "../scripts/validate-binary.js";

test("firmware validator verifies stock v9.0.50 binary", () => {
  const stockBinPath = path.resolve(
    "..",
    "Ultra-V9.0.50",
    "FW-Smalltv-Ultra-V9.0.50",
    "FW-Smalltv-Ultra-V9.0.50.bin"
  );

  if (fs.existsSync(stockBinPath)) {
    const res = validateFirmwareBinary(stockBinPath);
    assert.equal(res.valid, true);
    assert.equal(res.magicByte, "0xE9");
    assert.equal(res.md5, "a5fe50093ada3c2637225bbf306a62c3");
    assert.ok(res.sizeBytes <= 1048576);
  }
});

test("firmware validator rejects invalid files", () => {
  // 1. Missing file
  const missingRes = validateFirmwareBinary("non_existent_file.bin");
  assert.equal(missingRes.valid, false);
  assert.match(missingRes.error, /File not found/);

  // 2. Non-ESP8266 file (magic byte != 0xE9)
  const tempPath = path.resolve("test", "_temp_fake.bin");
  fs.writeFileSync(tempPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));
  try {
    const fakeRes = validateFirmwareBinary(tempPath);
    assert.equal(fakeRes.valid, false);
    assert.match(fakeRes.error, /Invalid ESP8266 magic byte/);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

