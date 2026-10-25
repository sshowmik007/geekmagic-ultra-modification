export function createInitialState() {
  return {
    page: "overview",
    device: {
      isSample: false,
      model: "Unavailable",
      firmware: "Unavailable",
      chip: "Unavailable",
      flashSize: "Unavailable",
      freeHeap: "Unavailable",
      uptime: "Unavailable",
      ip: "Unavailable",
      mac: "Unavailable",
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
        "Photo Frame & Ambient Album",
        "Analog Calendar Clock",
        "Network Health Monitor",
        "Now Playing",
        "Focus Timer",
        "Notifications & Diagnostics",
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
      city: "Unavailable",
      country: "Unavailable",
      latitude: null,
      longitude: null,
      method: "1", // University of Islamic Sciences, Karachi
      asrMethod: "Hanafi",
      timings: {
        fajr: "--", sunrise: "--", dhuhr: "--", asr: "--", sunset: "--", maghrib: "--", isha: "--",
      },
      nextWaqt: "Isha",
    },
    weather: {
      city: "Unavailable",
      cityId: "",
      tempUnit: "°C",
      windSpeedUnit: "m/s",
      pressureUnit: "hPa",
      updateInterval: 20,
      apiKey: "••••••••••••••••••••••••••••••••",
      forecastApiKey: "",
    },
    time: {
      mode: "Auto",
      timezone: "Unavailable",
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
      clockStyle: "digital",
    },
    network: {
      ssid: "Unavailable",
      status: "Unavailable",
      signal: null,
      bootDelay: 0,
      scannedNetworks: [],
    },
    media: {
      autoDisplay: false,
      intervalSeconds: 30,
      activePhotoUrl: null,
      files: [],
      nowPlaying: {
        title: "Paste a YouTube or music link",
        source: "Laptop metadata bridge",
        progress: 0,
        status: "Offline",
        url: "",
      },
    },
    focus: { minutes: 25, remaining: 25 * 60, running: false },
    notificationCenter: { message: "No new notifications", severity: "info" },
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

  if (action.type === "set-feature-field") {
    if (action.field === "nowPlaying") {
      return { ...state, media: { ...state.media, nowPlaying: { ...state.media.nowPlaying, [action.key]: action.value } } };
    }
    if (action.field === "focus") {
      const minutes = Math.max(1, Math.min(120, Number(action.value) || 25));
      return { ...state, focus: { ...state.focus, minutes, remaining: minutes * 60 } };
    }
    if (action.field === "notificationCenter") {
      return { ...state, notificationCenter: { ...state.notificationCenter, message: action.value } };
    }
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

  if (action.type === "add-media-file") {
    const existing = state.media.files.filter((f) => f.name !== action.file.name);
    return {
      ...state,
      media: {
        ...state.media,
        activePhotoUrl: action.file.url || state.media.activePhotoUrl,
        files: [action.file, ...existing],
      },
      notification: `Uploaded ${action.file.name} (240×240)`,
    };
  }

  if (action.type === "delete-media-file") {
    const remaining = state.media.files.filter((f) => f.name !== action.name);
    return {
      ...state,
      media: {
        ...state.media,
        activePhotoUrl: state.media.activePhotoUrl && remaining.length > 0 ? remaining[0].url : null,
        files: remaining,
      },
      notification: `Removed ${action.name}`,
    };
  }

  if (action.type === "set-active-photo") {
    const updatedFiles = state.media.files.map((f) => ({
      ...f,
      active: f.name === action.name,
    }));
    return {
      ...state,
      media: {
        ...state.media,
        activePhotoUrl: action.url || state.media.activePhotoUrl,
        files: updatedFiles,
      },
      notification: `Active photo set to ${action.name}`,
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
