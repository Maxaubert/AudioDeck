# Studio tab (equalizer and effects) - Design

Date: 2026-08-01. A third tab giving each output device its own EQ curve and effect settings,
processed by Equalizer APO.

## Why this shape

Windows has no system-wide EQ API. The processing has to live somewhere, and the three candidates
are not equivalent:

- **FxSound** (the app the reference screenshot comes from) works by installing a *virtual audio
  device* that the user sets as their Windows default. AudioDeck's whole purpose is to switch the
  default device automatically. The two would fight over the same setting, so this is rejected on
  architecture, before its AGPL-3 licence is even considered.
- **Our own APO** would be a C++ COM component plus a DSP engine. Best latency and no dependency,
  but a large new codebase in a language this project does not use, where every bug is audible.
- **Equalizer APO** processes *in place on the endpoint*. AudioDeck keeps managing defaults and the
  curve simply follows whichever device is in use. Its config is a text file it watches, and that
  file is natively per-device. Chosen.

AudioDeck is MIT; Equalizer APO is GPL-3. We never link it. AudioDeck writes a text file that a
separate program reads, exactly as it already invokes HeadsetControl as a separate process.

## What can and cannot be built

Equalizer APO's command set is filters, delay, channel mixing and convolution. Measured against the
reference screenshot:

| Control | Built from | Cost |
|---|---|---|
| EQ curve | `GraphicEQ` (frequency/gain pairs, log interpolation) | negligible |
| Bass Boost | `Filter: LS` low shelf | negligible |
| Clarity | `Filter: HS` presence lift | negligible |
| Width | `Copy:` channel matrix (mid-side) | negligible |
| Reverb / Ambience | `Convolution` with an impulse response | real CPU and latency |
| Distance | `Convolution` + high shelf rolloff + preamp | real CPU and latency |
| **Dynamic Boost** | **nothing: it has no dynamics processing** | n/a |

Dynamic Boost is not implementable and is dropped from the design rather than faked. Reverb and
Distance are deferred to a second pass: both rest on convolution, both need impulse-response files
under a redistributable licence, and both cost exactly the kind of per-sample work the poller work
of 2026-08-01 was careful to avoid.

**Version 1 ships:** the EQ curve, Bass Boost, Clarity, Width, per device.

## The tab

Tabs become `Devices | Studio | Settings`. "Studio" rather than "Equalizer" because it will hold
more than an equalizer, and because it fits the tab strip at the display font's width.

### When Equalizer APO is absent

The tab shows only a setup panel: what Equalizer APO is, that it processes the audio, that it
installs once and needs a restart, and a button that runs the bundled installer. AudioDeck states
plainly that this is a third-party GPL-3 component before running anything, and the button triggers
the normal Windows elevation prompt rather than acquiring admin silently.

After the installer exits, the panel asks for a restart and offers a Recheck button. Nothing else
in the tab renders until detection succeeds.

### When it is present

```
STUDIO                                    STEELSERIES (ARCTIS NOVA PRO)  v

 +12 dB  ---------------------------------------------------------------
         .    .    .    .    .    .    .    .    .    .
    0 dB  ---o----o----o----o----o----o----o----o----o----o-------------
         .    .    .    .    .    .    .    .    .    .
 -12 dB  ---------------------------------------------------------------
         32   64  125  250  500   1k   2k   4k   8k  16k

  BASS BOOST    [======|--------]   +3.0 dB
  CLARITY       [====|----------]   +1.5 dB
  WIDTH         [========|------]   115 %

  [ FLAT ]  [ PRESETS v ]                          EFFECTS  ( ON )
```

A device picker at the top selects which device's profile is being edited, defaulting to the one in
use. The curve is ten draggable points on a fixed logarithmic frequency axis; dragging a point
changes only its gain. The three sliders sit below it. `EFFECTS` is a per-device bypass, so any
setting can be A/B tested against unprocessed audio in one click.

Every control writes through to the config file on release, debounced, in the same way the mixer
commits volume.

## Architecture

Four new units, each with one job:

- **`electron/eqapo/detect.ts`** - is Equalizer APO installed, and where. Reads `InstallPath` from
  `HKLM\SOFTWARE\EqualizerAPO`, falling back to the default Program Files path. Returns null when
  absent. No side effects.
- **`electron/eqapo/render.ts`** - **pure**: takes the set of device profiles and returns the text
  of a config file. No I/O, no Electron. This is where the filter maths lives and where the tests
  concentrate.
- **`electron/eqapo/apply.ts`** - writes the rendered text to `<install>/config/audiodeck.txt` and
  ensures `<install>/config/config.txt` contains `Include: audiodeck.txt`. Never overwrites the
  user's own config; adds one line to it and leaves the rest alone.
- **`electron/eqapo/install.ts`** - runs the bundled installer, elevated, and reports the outcome.

Renderer: `views/StudioView.tsx`, with `components/EqCurve.tsx` (the draggable graph) and
`components/EffectSlider.tsx`. The graph is SVG, sized in CSS pixels, dragging by pointer events on
the points.

### Data flow

```
StudioView  --IPC-->  main  --> config.json (profiles)
                            --> render.ts --> audiodeck.txt --> Equalizer APO --> your ears
```

Profiles are stored in AudioDeck's own `config.json` under `eq: Record<deviceId, EqProfile>`, so
they survive an Equalizer APO reinstall and are backed up with everything else. The generated
`audiodeck.txt` is a derived artefact, rewritten from the profiles whenever they change and on
daemon start.

```ts
interface EqProfile {
  enabled: boolean;
  /** Gain in dB per band, indexed against the fixed BANDS frequency table. */
  bands: number[];
  bassBoost: number;   // dB, 0..12
  clarity: number;     // dB, 0..12
  width: number;       // percent, 0..200; 100 is untouched
}
```

### Matching a device

Equalizer APO's `Device:` line matches on the device name and connection shown by its own
Configurator, not on AudioDeck's endpoint id. The mapping between the two must be established
against a real installation rather than assumed; this is the single largest unknown in the design
and the implementation plan verifies it before anything is built on top.

## Error handling

- **Equalizer APO absent or uninstalled later:** detection runs on daemon start and whenever the
  Studio tab opens. Absent means the setup panel, never a silent failure.
- **Config directory not writable:** surfaces in the existing error banner with the path, and the
  profile stays in AudioDeck's config so nothing is lost.
- **A device Equalizer APO is not enabled for:** its profile still saves, and the tab says the
  effects are not active for that device until it is enabled, with a button to open the
  Configurator.
- **Recovery:** a `Remove AudioDeck's effects` action in Settings deletes `audiodeck.txt` and the
  `Include:` line, returning the system to how it was. Audio processing that cannot be undone from
  inside the app is not acceptable.

## Testing

- **vitest, the bulk:** `render.ts` is pure, so the filter maths, the per-device sections, the
  bypass, the flat case and the mid-side matrix are all unit-tested against expected config text.
  `detect.ts` is tested against a fake filesystem.
- **Playwright:** the setup panel shows when detection fails; the graph renders ten points; dragging
  a point changes the stored profile; the bypass toggle round-trips; switching device in the picker
  loads that device's curve. The mock backend gains a fake Equalizer APO so this runs on any machine.
- **Live verification, by hand:** that a written config actually changes what a device sounds like,
  and that device matching works. No automated test can hear.

## Licensing and packaging

The Equalizer APO installer is fetched at build time by `scripts/fetch-equalizerapo.ps1`, pinned to
a version, mirroring `fetch-headsetcontrol.ps1`. The binary is not committed. The README credits it
under GPL-3 alongside HeadsetControl, and the setup panel names the licence before installing.

## Out of scope for v1

Reverb, Distance, Dynamic Boost (impossible), microphone-side effects, per-application processing,
importing other tools' presets, and any automatic profile switching beyond following the device in
use.
