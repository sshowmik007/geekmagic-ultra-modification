# SmallTV dashboard prototype design

## Goal

Create a local, browser-only prototype for a clearer SmallTV-Ultra web dashboard. It is a design playground, not firmware and not a replacement for the device's current web server.

## Scope

The new work lives only under `smalltv-dashboard/`. The two supplied repositories remain read-only references. The prototype will use mock data and must never send requests to `192.168.0.198`, upload firmware, save settings, reboot, reset, or alter Wi-Fi.

The first screen is an overview that brings together the settings currently spread across the stock Network, Weather, Time, Pictures, and Settings pages:

- connection and device identity;
- selected display theme and brightness;
- weather city and refresh cadence;
- timezone, clock mode, and NTP source;
- picture rotation state;
- clearly separated, disabled-by-default system actions.

## User experience

The interface is a desktop-first control surface that collapses to one column on narrow screens. A fixed left navigation lists Overview, Display, Time, Network, Media, and System. The main area uses grouped controls rather than a dense settings table.

The visual direction is quiet technical minimalism: a warm off-white canvas, white surfaces, charcoal text, one muted blue accent, 8px corners, one-pixel borders, and no gradients or heavy shadows. System status uses readable text and restrained pastel tags. Motion is limited to a short opacity/transform entrance and disabled when the user prefers reduced motion.

## Technical shape

The first implementation uses semantic static HTML, a small JavaScript module for local page switching and mock interactions, and Tailwind compiled locally. There is no React, no router, no API client, no device protocol, and no image upload implementation. The output remains ordinary static assets so it can later be adapted to an ESP8266-compatible filesystem build.

Planned files:

```text
smalltv-dashboard/
  index.html                 # Prototype page and accessible controls
  src/
    input.css                # Tailwind imports and project tokens
    main.js                  # Local navigation and mock-only UI state
  package.json               # Local Tailwind build scripts only
  docs/superpowers/specs/
    2026-10-23-dashboard-prototype-design.md
```

## Boundaries for a later firmware stage

A later firmware project will need its own PlatformIO configuration, ESP8266 routes, form validation, persisted settings, LittleFS assets, OTA-size budgeting, and real-device verification. That stage must retain a UART recovery path and must not be flashed to the device until a recovery image and checked MD5 are available.

## Error handling and safety

The prototype labels all data as sample data. Potentially destructive actions appear as disabled buttons with an explanation. No browser action has a device-side effect. All controls have visible labels, keyboard focus, and sufficient contrast.

## Verification

For the prototype: build the CSS locally, open it in a browser, inspect the console, and check desktop and narrow layouts. No device connection or flashing is part of this stage.

## Explicitly excluded

- Changes to `geekmagic-tv-esp8266-master/` or `codelight-master/`
- Vendor firmware extraction or modification
- Authentication, real HTTP requests, credentials, Wi-Fi scanning, uploads, or OTA
- Firmware compilation, hardware flashing, or device configuration changes
