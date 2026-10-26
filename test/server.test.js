process.env.NODE_ENV = "test";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.js";

test("server API endpoints return expected responses", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => server.close());

  // 1. GET /api/status
  {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.model, "SmallTV-Ultra");
    assert.equal(data.chip, "ESP8266EX (80 MHz)");
    assert.ok(data.freeHeap);
  }

  // 2. GET /api/settings
  {
    const res = await fetch(`${baseUrl}/api/settings`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.display);
    assert.ok(data.weather);
    assert.ok(data.time);
  }

  // 3. POST /api/settings
  {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display: { brightness: 80 } }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    // Verify it updated
    const verifyRes = await fetch(`${baseUrl}/api/settings`);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.display.brightness, 80);
  }

  // 4. GET /api/wifi/scan
  {
    const res = await fetch(`${baseUrl}/api/wifi/scan`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.networks));
    assert.ok(data.networks.length > 0);
  }

  // 5. POST /api/wifi/connect
  {
    const res = await fetch(`${baseUrl}/api/wifi/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid: "NewNetwork", password: "pass" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  }

  // 6. POST /api/system/reboot
  {
    const res = await fetch(`${baseUrl}/api/system/reboot`, { method: "POST" });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  }

  // 7. 404 for unknown API
  {
    const res = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(res.status, 404);
  }
});
