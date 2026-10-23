import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { buildEspAssets } from "../scripts/build-esp.js";

test("ESP8266 asset bundler produces valid gzipped assets under budget", () => {
  const result = buildEspAssets();

  assert.ok(fs.existsSync(result.headerPath), "Header file dist/web_assets.h must exist");
  assert.ok(fs.existsSync(result.littlefsGzPath), "LittleFS file index.html.gz must exist");

  // Gzip size constraint: must be well under 50 KB
  assert.ok(result.gzippedBytes < 50000, `Gzip size (${result.gzippedBytes} bytes) should be < 50KB`);

  // Verify header content syntax
  const headerContent = fs.readFileSync(result.headerPath, "utf8");
  assert.match(headerContent, /#ifndef WEB_ASSETS_H/);
  assert.match(headerContent, /DASHBOARD_HTML_GZ\[\] PROGMEM/);
  assert.match(headerContent, /DASHBOARD_HTML_GZ_LEN = \d+/);
  assert.match(headerContent, /Content-Encoding.*gzip/);

  // Verify decompression yields valid HTML
  const gzBuffer = fs.readFileSync(result.littlefsGzPath);
  const decompressedHtml = zlib.gunzipSync(gzBuffer).toString("utf8");

  assert.match(decompressedHtml, /<!doctype html>/i);
  assert.match(decompressedHtml, /SmallTV/);
  assert.match(decompressedHtml, /<style>/);
  assert.match(decompressedHtml, /<script>/);
});
