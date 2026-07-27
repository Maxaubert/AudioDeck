# AudioDeck v1 - Implementation Plan

Date: 2026-07-27. Executes the approved design in `docs/specs/2026-07-27-audiodeck-v1-design.md`.
Work happens on branch `v1`, lands via PR referencing the v1 tracking issue.

## Stage 1 - audioctl helper (C#)

`audioctl/` .NET 8 console project, publishable self-contained (NativeAOT if VS C++ tools are
present, trimmed self-contained otherwise).

Commands (all print JSON to stdout, exit 0/1):
- `list` - render + capture endpoints: `{id, name, flow, state(active|disabled|notpresent|unplugged), isDefault, isDefaultComms, volume, mute}`. Includes disabled endpoints.
- `set-default <id>` - IPolicyConfig SetDefaultEndpoint for all three roles.
- `set-volume <id> <0-100>`, `mute <id>`, `unmute <id>` - IAudioEndpointVolume.
- `enable <id>`, `disable <id>` - IPolicyConfig SetEndpointVisibility.

COM interop signatures were proven in session on 2026-07-27 (IPolicyConfig
f8679f50-850a-41cf-9c72-430f290290c8 via CLSID 870af99c, SetEndpointVisibility at vtable slot 12;
IMMDeviceEnumerator; IAudioEndpointVolume). Reuse those exact definitions.

Acceptance: `audioctl list` shows the machine's real devices; `set-default` audibly moves audio;
`disable`/`enable` verified against a test endpoint.

## Stage 2 - Electron scaffold + daemon core

Electron 31+ with Vite + React + TS (electron-vite). Main process modules, one file one job:
- `electron/config.ts` - load/save/atomic-write config, schema + migration stub.
- `electron/audioctl.ts` - typed wrapper spawning audioctl, JSON parse, error mapping.
- `electron/headsetcontrol.ts` - typed wrapper for HeadsetControl `-o json` battery/status;
  maps device product IDs to endpoints by name match; per-device fail-open.
- `electron/availability.ts` - merges endpoint states + headset power into per-device
  `available: boolean`.
- `electron/rules.ts` - PURE functions: seed lists, pick winner, override hold logic,
  diff events. No I/O; this is the unit-tested core.
- `electron/poller.ts` - 2 s loop: gather, evaluate, act (set-default via audioctl), detect
  external manual changes for override hold.
- `electron/tray.ts` - tray icon, menu (Open AudioDeck, Pause automation, Quit).
- `electron/autostart.ts` - HKCU Run key registration, on by default, toggleable.
- `electron/main.ts` - wiring only.

Acceptance: daemon runs, logs availability transitions, switches default output when the
Arctis powers off/on (verified live), respects manual override until next event.

## Stage 3 - UI

Renderer with three views (React, large type, strong contrast; design-taste + frontend-design
skills govern the look). IPC via contextBridge, typed channels.
- Priority: two drag-to-reorder lists (outputs, mics) with availability badges and current
  default indicator.
- Mixer: slider + mute per active device.
- Devices: all endpoints incl. disabled; enable/disable, rename (local alias stored in config).
- Settings strip: autostart toggle, pause automation, poll interval.

Window created on demand from tray, destroyed on close.

## Stage 4 - Tests

- vitest unit tests for `rules.ts` (priority, override, seeding, append, event diffing).
- Playwright Electron e2e: app launches, tray-less test mode opens window, views render,
  reorder persists to config.
- `npm run typecheck`, `npm test`, `npm run e2e` all green is the baseline gate.

## Stage 5 - Packaging + docs

- `scripts/fetch-headsetcontrol.ps1` downloads the pinned HeadsetControl release into
  `vendor/` (gitignored); build fails with a clear message if missing.
- electron-builder: NSIS installer + portable exe, bundling audioctl publish output + vendor
  binary. HeadsetControl credited in README with GPL-3 note (invoked as separate process).
- README via the readme skill: what it fixes, supported headsets (HeadsetControl list link),
  screenshots, install, build-from-source.

## Stage 6 - Verification + landing

- Live hardware pass: Arctis off/on switching, AirPods connect/disconnect priority, manual
  override hold, volume + disable round-trips.
- PR from `v1` to `main` referencing the tracking issue; merge after checks.
