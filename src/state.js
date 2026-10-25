export function createInitialState() {
  return {
    page: "overview",
    device: {
      isSample: true,
      model: "SmallTV-Ultra",
      firmware: "Ultra-V9.0.55-Custom",
      chip: "ESP8266EX (80 MHz)",
      flashSize: "4 MB",
      freeHeap: "42.8 KB",
      uptime: "3d 14h 22m",
      ip: "192.168.0.198",
      mac: "48:55:19:D4:2B:6A",
    },
    display: {
      theme: "Weather & Prayer Station",
      brightness: 65,
      autoSwitch: false,
      switchInterval: 15,
      activeThemes: [
        "Weather & Prayer Station",
        "Editorial Weather Clock",
        "Minimalist Clean Clock",
        "AI Token & Rate Monitor",
        "Cosmic Shuttle & Prayer Station",
      ],
      nightMode: {
        enabled: true,
        startTime: "22:00",
        endTime: "07:00",
        brightness: 20,
      },
    },
    tokens: {
      provider: null,
      model: null,
      status: "idle",
      agentState: "IDLE", // "IDLE", "WORKING", "WAITING"
      sessionLabel: "RATE LIMIT",
      sessionPct: null,
      sessionTokens: 0,
      sessionLimit: 0,
      sessionText: "Unavailable",
      sessionReset: null,
      weeklyLabel: "RATE LIMIT",
      weeklyPct: null,
      weeklyTokens: 0,
      weeklyLimit: 0,
      weeklyText: "Unavailable",
      weeklyReset: null,
      tokensPerSec: 0,
      lastSync: "Just now",
      isLaptopOnline: false,
      telemetryState: "unavailable",
      sourceLabel: "No verified provider source",
      observedAt: null,
    },
    prayer: {
      enabled: true,
      city: "Dhaka",
      country: "Bangladesh",
      latitude: 23.8103,
      longitude: 90.4125,
      method: "1", // University of Islamic Sciences, Karachi
      asrMethod: "Hanafi",
      timings: {
        fajr: "04:44",
        sunrise: "06:00",
        dhuhr: "11:42",
        asr: "15:48",
        sunset: "17:24",
        maghrib: "17:24",
        isha: "18:40",
      },
      nextWaqt: "Isha",
    },
    weather: {
      city: "Dhaka",
      cityId: "1185241",
      tempUnit: "°C",
      windSpeedUnit: "m/s",
      pressureUnit: "hPa",
      updateInterval: 20,
      apiKey: "••••••••••••••••••••••••••••••••",
      forecastApiKey: "",
    },
    time: {
      mode: "Auto",
      timezone: "Asia/Dhaka (UTC+6:00)",
      utcOffset: "UTC+6:00",
      hourFormat: "12-Hour",
      dateFormat: "DD MMM . Day",
      colonBlink: true,
      fontStyle: "Default Big Font",
      ntp: "pool.ntp.org",
      colors: {
        hour: "#ffffff",
        minute: "#feba01",
        second: "#ffffff",
      },
    },
    network: {
      ssid: "Home",
      status: "Connected",
      signal: 68,
      bootDelay: 0,
      scannedNetworks: [
        { ssid: "Home", rssi: 68, security: "WPA2", signal: "Strong" },
        { ssid: "Ovi's 2.4", rssi: 64, security: "WPA2", signal: "Medium" },
        { ssid: "Hufflepuff House", rssi: 49, security: "WPA2", signal: "Medium" },
        { ssid: "Dobby is FREE!", rssi: 33, security: "WPA2", signal: "Weak" },
        { ssid: "YOLO_IoT", rssi: 26, security: "Open", signal: "Weak" },
      ],
    },
    media: {
      autoDisplay: false,
      intervalSeconds: 30,
      files: [
        { name: "cat_retro.gif", size: "84 KB", type: "GIF (240x240)" },
        { name: "pixel_sunset.jpg", size: "48 KB", type: "JPG (240x240)" },
        { name: "cyber_grid.gif", size: "112 KB", type: "GIF (240x240)" },
      ],
    },
    notification: null,
  };
}

export function reduce(state, action) {
  if (action.type === "navigate") {
    return { ...state, page: action.page, notification: null };
  }

  if (action.type === "set-brightness") {
    return {
      ...state,
      display: {
        ...state.display,
        brightness: Math.max(0, Math.min(100, Number(action.value))),
      },
    };
  }

  if (action.type === "set-theme") {
    return {
      ...state,
      display: {
        ...state.display,
        theme: action.theme,
      },
    };
  }

  if (action.type === "toggle-auto-switch") {
    return {
      ...state,
      display: {
        ...state.display,
        autoSwitch: action.value !== undefined ? Boolean(action.value) : !state.display.autoSwitch,
      },
    };
  }

  if (action.type === "set-switch-interval") {
    return {
      ...state,
      display: {
        ...state.display,
        switchInterval: Math.max(5, Number(action.value) || 15),
      },
    };
  }

  if (action.type === "toggle-active-theme") {
    const list = state.display.activeThemes.includes(action.theme)
      ? state.display.activeThemes.filter((t) => t !== action.theme)
      : [...state.display.activeThemes, action.theme];
    return {
      ...state,
      display: {
        ...state.display,
        activeThemes: list.length > 0 ? list : [action.theme],
      },
    };
  }

  if (action.type === "set-token-field") {
    let val = action.value;
    if (["sessionTokens", "sessionLimit", "weeklyTokens", "weeklyLimit", "tokensPerSec"].includes(action.field)) {
      val = Number(action.value);
    }
    if (action.field === "provider" && typeof val === "string" && val.includes(":")) {
      const [prov, mdl] = val.split(":");
      return {
        ...state,
        tokens: {
          ...state.tokens,
          provider: prov,
          model: mdl,
        },
      };
    }
    return {
      ...state,
      tokens: {
        ...state.tokens,
        [action.field]: val,
      },
    };
  }

  if (action.type === "toggle-laptop-sync") {
    return {
      ...state,
      tokens: {
        ...state.tokens,
        isLaptopOnline: action.value !== undefined ? Boolean(action.value) : !state.tokens.isLaptopOnline,
      },
    };
  }

  if (action.type === "set-night-mode") {
    return {
      ...state,
      display: {
        ...state.display,
        nightMode: {
          ...state.display.nightMode,
          [action.field]: action.value,
        },
      },
    };
  }

  if (action.type === "set-time-field") {
    let val = action.value;
    if (action.field === "colonBlink") {
      val = val === "true" || val === true;
    }
    return {
      ...state,
      time: {
        ...state.time,
        [action.field]: val,
      },
    };
  }

  if (action.type === "set-clock-color") {
    return {
      ...state,
      time: {
        ...state.time,
        colors: {
          ...state.time.colors,
          [action.colorKey]: action.value,
        },
      },
    };
  }

  if (action.type === "set-weather-field") {
    return {
      ...state,
      weather: {
        ...state.weather,
        [action.field]: action.value,
      },
    };
  }

  if (action.type === "set-prayer-field") {
    return {
      ...state,
      prayer: {
        ...state.prayer,
        [action.field]: action.value,
      },
    };
  }

  if (action.type === "set-media-field") {
    return {
      ...state,
      media: {
        ...state.media,
        [action.field]: action.value,
      },
    };
  }

  if (action.type === "select-wifi") {
    return {
      ...state,
      network: {
        ...state.network,
        ssid: action.ssid,
      },
      notification: `Selected Wi-Fi: ${action.ssid} (Prototype mock)`,
    };
  }

  if (action.type === "set-notification") {
    return {
      ...state,
      notification: action.message,
    };
  }

  return state;
}
