# AudioDeck v1 - Design

Date: 2026-07-27
Status: approved

## Problem

Windows cannot tell when a wireless headset with an always-powered USB dongle or base station
is actually turned on. The audio endpoint belongs to the dongle, which is always connected, so:

- Turning the headset off does not move audio to speakers/TV.
- Turning it on does not move audio back.

Windows also scatters device management (default device, volumes, disabling endpoints) across
several settings surfaces. AudioDeck is a general Windows audio manager built around fixing this.

## Product

A tray-resident Windows app, public on GitHub, for any user. Three v1 features:

1. **Priority auto-switch.** The user orders their output devices in a priority list, and
   separately their input (mic) devices. AudioDeck continuously determines which devices are
   *actually available* and sets the Windows default to the highest-priority available device.
   - Normal devices (Bluetooth, HDMI, USB speakers): available = Windows endpoint state ACTIVE.
   - Dongle wireless headsets: available = endpoint ACTIVE **and** headset powered on, read
     through the dongle via the HeadsetControl protocol (supports SteelSeries, Logitech,
     Corsair, Razer, HyperX and more).
2. **Volume mixer.** Per-device volume and mute in one window.
3. **Device manager.** List all endpoints including disabled ones; enable, disable, rename.

Out of scope for v1: battery UI, per-app routing, hotkeys, profiles.

## Behavior rules

- Highest-priority available output wins. Independent list and same logic for mics.
- **Manual override holds until the next availability event.** If the user sets a different
  default (in Windows or in AudioDeck), automation pauses until some device's availability
  changes, then the priority list re-applies.
- New devices append to the bottom of the priority list. No shipped default order; first run
  seeds the list with the current Windows default first, then remaining devices in enumeration
  order. Nothing user-specific is programmed in.
- If HeadsetControl reports an error or does not support the headset, that device degrades to
  normal endpoint-state detection (fail open, never switch away wrongly).
- Communications default follows the same device as the default (output and input).
- Poll interval 2 s (config-adjustable).
- Autostart with Windows, on by default, toggle in UI.

## Architecture

Three parts:

1. **Daemon** - Electron main process, tray icon, no window normally. Owns config, the poller,
   and the rules engine. Autostart registration.
2. **audioctl.exe** - small C# (.NET 8, NativeAOT if the build environment allows, otherwise
   self-contained trimmed) CLI wrapping Windows Core Audio:
   `list` (endpoints with id, name, flow, state, default flags, volume, mute),
   `set-default <id>` (IPolicyConfig, also sets communications),
   `set-volume <id> <0-100>`, `mute/unmute <id>`,
   `enable <id>` / `disable <id>` (IPolicyConfig SetEndpointVisibility).
   All output JSON. Stateless, one shot per call.
3. **UI** - Electron renderer (Vite + React + TypeScript), created on demand from the tray,
   destroyed on close so idle cost stays near zero. Views: Priority, Mixer, Devices.
   Large text and strong contrast throughout.

Bundled third-party binary: HeadsetControl (GPL-3) invoked as a separate process; fetched by a
script at build time, credited in README with license.

## Config

JSON at `%APPDATA%\AudioDeck\config.json`: output priority (endpoint IDs), mic priority,
override state, poll interval, autostart flag, hidden devices. Written atomically.

## Error handling

- audioctl failures: log, keep last known state, never crash the daemon.
- HeadsetControl failures: per-device fallback to endpoint-state detection.
- Endpoint disappears entirely: treated as unavailable, skipped; reappearing keeps its list slot
  (IDs are stable per device).

## Testing

- Unit tests (vitest) for the rules engine: priority selection, override hold, event detection,
  seeding, new-device append.
- Playwright driving Electron for e2e UI tests.
- Live verification on real hardware: Arctis Nova Pro Wireless power toggle, AirPods
  connect/disconnect, TV fallback.
