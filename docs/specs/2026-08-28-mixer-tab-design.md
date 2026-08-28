# Mixer Tab Design

2026-08-28. Approved scope: per-app volume mixer as a new "Mixer" tab, mirroring the
Windows 11 Settings volume-mixer page for the current default output device, with
per-app icons. Volume + mute only; per-app device routing is explicitly out of scope
(follow-up feature if wanted).

## What it is

A new tab between Devices and Studio that shows:

1. **Master row** - the current default output device with its existing fader and mute,
   so the page reads like the Windows mixer (system volume on top, apps under it).
2. **App rows** - one row per application with an audio session on the default output:
   app icon, app name, fader, mute toggle. "System sounds" is pinned first.

Muting or changing an app here changes the same WASAPI session state the Windows
volume mixer reads and writes, so the two stay in sync by construction. External
changes (Windows mixer, the app's own volume UI) appear on the next mixer poll.

## Why this shape

- **Default output only.** Matches the Windows Settings page exactly and keeps the UI
  flat. Sessions on other devices are invisible, as in Windows.
- **No persistence in AudioDeck.** Windows itself remembers per-app levels and
  reapplies them; AudioDeck stores nothing for the mixer. No config changes.
- **Polling, not session events.** audioctl stays a one-shot helper (spawn, print
  JSON, exit). The Mixer view polls a new `getMixer` IPC call every 1 s while the tab
  is mounted, so the tray-idle daemon pays nothing and the helper contract is
  unchanged. 1 s matches the responsiveness of the device views (renderer polls
  getState at 1.5 s).

## Architecture

Same four layers as every other feature, extended in place:

```
audioctl.exe (C#, new session/icon commands)
  -> electron/audioctl.ts (AudioControl gains sessions/set-app-volume/mute/app-icon)
  -> electron/ipc.ts (getMixer / setAppVolume / setAppMute / getAppIcon handlers)
  -> src/renderer (MixerView, polls getMixer while mounted)
```

### audioctl (C#) - the session layer

New raw-vtable interop (same style as the endpoint interop, NativeAOT-safe):
`IAudioSessionManager2` (activated from the default render `IMMDevice`) ->
`IAudioSessionEnumerator` -> `IAudioSessionControl` / `IAudioSessionControl2` /
`ISimpleAudioVolume` (both via QueryInterface on the session control).

New commands:

- `sessions` - JSON array over the default render endpoint's sessions. Per row:
  `id` (session instance identifier - the stable handle for set commands), `pid`,
  `exePath` (null when unreadable or system sounds), `name`, `state`
  (`active` | `inactive`; expired sessions are skipped), `isSystemSounds`,
  `volume` (0-100, the session's ISimpleAudioVolume scalar), `mute`.
  Name resolution in C#: session display name if set, else the exe's
  `FileDescription` version string (what Windows shows, e.g. "Google Chrome"),
  else the exe stem, else "System sounds" / `App <pid>`.
  No default render device -> empty array.
- `set-app-volume <0-100> <sessionId...>` and `mute-app <sessionId...>` /
  `unmute-app <sessionId...>` - re-enumerate, match session instance ids, apply to
  every match in one spawn (a fader drag on a grouped app writes all its sessions
  atomically). Zero matches is an error (the session died); one-of-N matching is
  success.
- `app-icon <exePath> <outPng> <size>` - extract the shell icon via
  `IShellItemImageFactory::GetImage` (SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK) at
  256 px and write a PNG. PNG encoding is a small hand-rolled RGBA encoder
  (zlib via System.IO.Compression + CRC32) because NativeAOT has no imaging
  library. 256 px source keeps icons crisp at this machine's 225 % display
  scaling; the renderer scales down.

### Electron main

- `electron/audioctl.ts`: `AudioControl` gains `sessions()`, `setAppVolume(ids,
  level)`, `setAppMute(ids, mute)`, `appIcon(exePath, outPath, size)`; `Audioctl`
  spawns the new verbs; `MockAudioctl` implements them in memory for e2e.
- `electron/mixer.ts` (new): pure `groupSessions(sessions)` - groups rows the way the
  Windows mixer does: system sounds first as its own pinned row, then one row per
  exe path (case-insensitive; sessions with no exe path stay individual rows keyed
  by pid), sorted by name. Group volume is the loudest member (they are normally
  identical), mute is true only when every member is muted, and the row carries all
  member session ids so writes fan out. Unit-tested.
- `electron/icons.ts` (new): `AppIconCache` - disk cache under
  `userData/icon-cache/`, keyed by sha1(exePath lowercase + exe mtime) so an app
  update refreshes its icon. Returns a `data:image/png;base64` URL, memoized per
  run; extraction failure caches null (renderer falls back to a generic glyph).
- `electron/ipc.ts`: four handlers. `getMixer` spawns `sessions`, groups, remembers
  the exe paths it saw; `getAppIcon` only serves paths seen by a prior `getMixer`
  (the renderer cannot probe arbitrary files); `setAppVolume` / `setAppMute`
  validate and pass through. No poller involvement - mixer state is not part of
  `AppState`.

### Renderer

- `App.tsx`: `TABS` gains `{ name: "mixer", label: "Mixer" }` after Devices.
- `views/MixerView.tsx` (new): master row (the default render `DeviceView` from the
  existing `AppState`, reusing `VolumeFader` and the existing mute control), then app
  rows. Its own `useMixer` hook polls `getMixer` every 1 s while mounted and
  refreshes after each action; app faders reuse the fader logic below. Empty state
  when nothing is playing.
- `components/Fader.tsx` (targeted refactor): the optimistic drag/debounce/flush
  logic inside `VolumeFader` is extracted into a generic `Fader` taking
  `{ value, muted, ariaLabel, onCommit }`; `VolumeFader` becomes a thin device
  wrapper. App rows use `Fader` directly. No behavior change for the Devices tab.
- Icons: `<img>` with the data URL, fetched once per exe path via `getAppIcon` and
  cached module-side. Fallback (no icon / mock backend): inline generic-app SVG
  glyph. System sounds always uses an inline SVG speaker-cog glyph - SVG per this
  machine's scaling rule.
- Visual language: same print-language row grammar as the Devices tab (segmented
  meter, percentage cell, row typography). Implementation applies the standing
  design skills.

## Error handling

- `sessions` spawn failure -> `getMixer` throws -> MixerView shows its error line and
  keeps the last rows (same pattern as `useAppState`).
- Set on a dead session -> audioctl error -> action error shown, next poll (<=1 s)
  removes the row.
- Icon extraction failure -> null -> fallback glyph, cached so it is not retried
  every poll.
- No default output -> empty sessions -> the empty state (the master row also
  disappears with no default device, matching the Devices tab's view of the world).

## Testing

- **Vitest**: `groupSessions` (grouping, pinning, sorting, volume/mute aggregation,
  pid-keyed fallback), `iconCacheKey` stability.
- **C#**: no test infra exists; each command is smoke-verified by running
  `audioctl.exe` by hand with audio playing (documented in the plan).
- **E2E (Playwright, mock backend)**: fixture sessions (two Chrome sessions to prove
  grouping, Spotify, System sounds). Tests: tab renders rows in pinned order,
  mute round-trips, keyboard volume change round-trips, fallback glyphs render.
- **Hands-on**: branch build installed locally before the merge question, checking
  live sync against the Windows mixer both directions.

## Out of scope

- Per-app output routing (AudioPolicyConfig) - follow-up feature.
- Capture (mic) sessions, per-device session sections, session peak meters.
- Any mixer state in config.json.
