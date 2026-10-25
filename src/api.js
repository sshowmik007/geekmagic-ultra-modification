// API adapter with graceful fallback to offline/memory mode when opened as file://

const isBrowser = typeof window !== "undefined";
const isHttp = isBrowser && (window.location.protocol === "http:" || window.location.protocol === "https:");

export const api = {
  isLiveServer: isHttp,

  async getStatus() {
    if (!isHttp) return null;
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Status fetch failed");
      return await res.json();
    } catch (e) {
      console.warn("[SmallTV API] Using local mock status:", e.message);
      return null;
    }
  },

  async getSettings() {
    if (!isHttp) return null;
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Settings fetch failed");
      return await res.json();
    } catch (e) {
      console.warn("[SmallTV API] Using local mock settings:", e.message);
      return null;
    }
  },

  async getTokens() {
    if (!isHttp) return null;
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) throw new Error("Tokens fetch failed");
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  async saveSettings(settings) {
    if (!isHttp) {
      return { success: true, message: "Saved to in-memory state (Offline mode)" };
    }
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async scanWifi() {
    if (!isHttp) return null;
    try {
      const res = await fetch("/api/wifi/scan");
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  async connectWifi(ssid, password, bootDelay) {
    if (!isHttp) {
      return { success: true, message: `Connected to ${ssid} (Offline mode)` };
    }
    try {
      const res = await fetch("/api/wifi/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password, bootDelay }),
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async resetDevice() {
    if (!isHttp) return { success: true, message: "Settings erased (Offline mode)" };
    try {
      const res = await fetch("/api/system/reset", { method: "POST" });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async uploadMedia(rgb565Bytes, filename = "photo.raw") {
    if (!isHttp) {
      return { success: true, message: "Photo saved to local browser cache (Offline mode)" };
    }
    try {
      const blob = new Blob([rgb565Bytes], { type: "application/octet-stream" });
      const formData = new FormData();
      formData.append("photo", blob, filename);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async deleteMedia(filename = "photo.raw") {
    if (!isHttp) return { success: true, message: "Photo removed (Offline mode)" };
    try {
      const res = await fetch("/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: filename }),
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async reboot() {
    if (!isHttp) return { success: true, message: "Reboot triggered (Offline mode)" };
    try {
      const res = await fetch("/api/system/reboot", { method: "POST" });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

