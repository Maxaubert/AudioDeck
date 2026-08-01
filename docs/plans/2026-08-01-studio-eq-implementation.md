# Studio tab - Implementation Plan

Date: 2026-08-01. Executes `docs/specs/2026-08-01-studio-eq-design.md`.
Branch off `main`, land via PR referencing its issue.

## Stage 0 - prove the unknown first

Nothing else is worth building until Equalizer APO is installed on this machine and we know, from
observation rather than documentation:

1. Which `Device:` line matches which AudioDeck endpoint. Write a config with an obviously audible
   filter (`Preamp: -20 dB`) targeted at one device, confirm by ear that only that device changes,
   and record the exact string Equalizer APO matched on.
2. Whether `Include:` from `config.txt` behaves as documented, so the user's own config survives.
3. What detection looks like when installed: registry key, install path, config directory.
4. **How little of the install the end user has to see.** The bundled installer is NSIS, so `/S`
   should install it silently. The open question is enabling the APO per device, which Equalizer
   APO normally does through its Configurator: find what that writes (expected to be the endpoint's
   `FxProperties` in the MMDevices registry) by diffing the registry before and after enabling a
   device by hand. If AudioDeck can write the same thing, the user sees only AudioDeck's own UI,
   one elevation prompt and one restart. If not, the fallback is the installer's device page shown
   once.

Written up as a short findings note in `docs/reference/`. If device matching turns out not to be
reliable, the design needs revisiting before any UI exists, and this stage is where that is cheap.

**Acceptance:** a hand-written config demonstrably changes one device and not another, and the
matching rule is written down.

## Stage 1 - the pure renderer

`electron/eqapo/render.ts`: `renderConfig(profiles: DeviceProfiles): string`.

- `GraphicEQ` line from the band gains.
- `Filter: ON LS Fc 100 Hz Gain <bassBoost> dB` when bass boost is non-zero.
- `Filter: ON HS Fc 6000 Hz Gain <clarity> dB` when clarity is non-zero.
- `Copy:` mid-side matrix from the width percentage; omitted entirely at 100.
- A `Preamp:` that offsets the largest positive gain, so boosting cannot clip.
- One `Device:` section per profile; profiles with `enabled: false` emit nothing.
- A header comment marking the file as generated and naming AudioDeck.

`render.test.ts` covers: flat profile emits no filters; each effect in isolation; the preamp
tracking the peak gain; width 100 emitting no `Copy`; two devices producing two sections; a
disabled profile being skipped; gains clamped to the supported range.

**Acceptance:** `npm run test` green. No Electron import in this file.

## Stage 2 - detection and application

`electron/eqapo/detect.ts`: install path from `HKLM\SOFTWARE\EqualizerAPO`, falling back to the
Program Files path, returning `{ installPath, configDir } | null`. Injectable filesystem and
registry readers so it is unit-testable.

`electron/eqapo/apply.ts`: atomic write of `audiodeck.txt`, and an idempotent `Include:` line in
`config.txt` (read, check, append only if missing). Never rewrites the user's other lines.

`electron/eqapo/remove.ts`: deletes `audiodeck.txt` and strips the `Include:` line.

**Acceptance:** unit tests for both against a temp directory; applying twice leaves exactly one
`Include:` line; removing restores the original file byte for byte.

## Stage 3 - config, IPC, wiring

- `AudioDeckConfig` gains `eq: Record<string, EqProfile>`, with migration defaulting to `{}`.
- IPC: `getEqProfile(deviceId)`, `setEqProfile(deviceId, profile)`, `getEqStatus()` (installed,
  config path, which devices are enabled), `installEqualizerApo()`, `removeEqEffects()`.
- The daemon re-renders and applies on any profile change and once on start.
- Identity migration: when an endpoint is superseded, its EQ profile moves with everything else
  (`identity.ts` already rekeys config; add `eq` to the fields it carries).

**Acceptance:** typecheck clean; existing identity tests extended to cover the `eq` key.

## Stage 4 - the UI

- `views/StudioView.tsx`: device picker, setup panel when absent, otherwise graph and sliders.
- `components/EqCurve.tsx`: SVG, ten points on a log frequency axis, pointer drag on each point,
  keyboard support (arrows adjust the focused band, matching the app's existing keyboard-reachable
  patterns), `aria-valuenow` per band.
- `components/EffectSlider.tsx`: a labelled slider in the print theme, reusing the mixer's debounce
  approach so dragging does not write on every frame.
- Styles follow the existing system: hard edges, amber as accent ink, 44px targets, body text at or
  above 17px. The curve is drawn with the marker colour on the sheet.

**Acceptance:** visual check at 940px and 1180px, no horizontal overflow, screenshots regenerated.

## Stage 5 - packaging and safety

- `scripts/fetch-equalizerapo.ps1`, pinned, mirroring `fetch-headsetcontrol.ps1`, with the same
  post-download verification. (Done ahead of schedule, along with the extraResources entry and the
  preflight check.)
- `build/installer.nsh`, referenced from `electron-builder.yml` as `nsis.include`:
  - a page with one checkbox, ticked by default, offering to set up audio effects;
  - `customInstall` running `vendor\equalizerapo-setup.exe /S` through `ExecShellWait "runas"` so
    only that step elevates, skipped entirely when the box is unticked or when detection shows it
    is already installed;
  - the result ignored for the purposes of AudioDeck's own success, and a reboot offered on the
    finish page.
- Verify by installing from the built NSIS package on this machine: one wizard, one elevation
  prompt, no second window, and AudioDeck still installs cleanly when the box is unticked and when
  the elevation prompt is cancelled.
- Settings gains `Remove audio effects`, calling `remove.ts`.
- README: credit Equalizer APO under GPL-3 next to HeadsetControl, and document that effects
  require it.

**Acceptance:** `npm run dist` produces a package containing the installer; removing effects from
Settings leaves the machine as it was.

## Stage 6 - tests and verification

- Playwright: setup panel when absent, graph with ten points, drag changing the stored profile,
  bypass round-trip, device picker switching profiles. Mock backend gains a fake Equalizer APO.
- By hand on the real machine, because no test can hear: a curve audibly changes the Steelseries
  and not the LG TV; the bypass is audible; removing effects restores the original sound; a reboot
  leaves the profile applied.

**Acceptance:** `npm run typecheck`, `npm run test`, `npm run e2e` green, plus the hand checks above.

## Risks

- **Device matching** is the one that can invalidate the design; Stage 0 exists to find out first.
- **Equalizer APO can break audio on a device** if misconfigured. Every stage keeps the removal path
  working, and the bypass is per device.
- **SteelSeries Sonar** is installed on this machine and is itself a DSP layer. If its virtual
  device is ever enabled the two will interact; worth checking during Stage 0 and documenting.
- **Latency**: negligible for the v1 filters, which is why convolution is deliberately deferred.
