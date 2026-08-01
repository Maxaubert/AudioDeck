# Equalizer APO: what was proven, not assumed

Findings from stage 0 of the Studio tab work, against Equalizer APO 1.4.2 on Windows 11,
2026-08-01. Everything here was observed on a real installation. Where something is still
unverified it says so.

## Devices can be targeted by GUID, and that survives renaming

`Device:` matches space-separated words against the string `"Device_name Connection_name GUID"`.
All words in the pattern must appear. A GUID contains no spaces, so a GUID alone is a valid and
exact pattern:

```
Device: {37de265e-81bb-4abb-b249-5894f9a09f45}
Preamp: -25 dB
```

**Proven both ways by ear.** Targeting the AirPods' GUID dropped the AirPods and nothing else;
re-aiming the same file at the LG TV's GUID returned the AirPods to full volume. The match hits one
endpoint and does not leak.

This matters more than it looks. Equalizer APO's own device list shows the endpoint's `DeviceDesc`
in its "Connector" column, which is exactly the property AudioDeck's rename feature writes: after
renaming, its list showed *"LG"*, *"Steelseries"*, *"Apple"* and *"Meta"*, not the driver names.
Matching by name would therefore break every time a user renamed a device in AudioDeck. Matching by
GUID cannot.

AudioDeck endpoint ids are `{0.0.0.00000000}.{<guid>}`; the pattern is the `{<guid>}` half.

## The GUID is the same one AudioDeck already uses

The endpoint GUID is the leaf of the MMDevices registry path, so no translation table is needed:

```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\{107856e0-...}
audioctl id                     {0.0.0.00000000}.{107856e0-...}
Equalizer APO pattern                            {107856e0-...}
```

## Include works, and config changes apply live

`Include: audiodeck.txt` at the end of `config.txt` pulled in a separate file, and edits to that
file took effect immediately with no service restart and no reboot. The non-destructive design
(AudioDeck owns `audiodeck.txt`, adds one line to `config.txt`, never rewrites the rest) is sound.

## No reboot was needed

The installer restarts the audio service itself and reported "Checks done. No problems were
detected". Effects worked immediately afterwards without a restart. The spec's claim that a reboot
is unavoidable was **wrong for this version on this machine**; it should be presented as "may need
a restart" rather than promised. Not yet verified on a machine where the audio service cannot be
restarted cleanly.

## Detection

```
HKLM\SOFTWARE\EqualizerAPO
  InstallPath  C:\Program Files\EqualizerAPO
  ConfigPath   C:\Program Files\EqualizerAPO\config
  EnableTrace  false
```

Both values exist as soon as it is installed. `ConfigPath` should be read rather than assumed, since
the install location is user-selectable.

## Enabling a device is registry work, with a caveat

Enabling an endpoint rewrites its `FxProperties`. Before, on the LG TV:

```
{d04e05a6-...},5 = {C9453E73-8C5C-4463-9984-AF8BAB2F5447}   original pre-mix APO
{d04e05a6-...},6 = {13AB3EBD-137E-4903-9D89-60BE8277FD17}
```

After:

```
{d04e05a6-...},5 = {EACD2258-FCAC-4FF4-B36D-419E924A6D79}   Equalizer APO pre-mix
{d04e05a6-...},7 = {EC1CC9CE-FAED-4822-828A-82A81A6F018F}   Equalizer APO post-mix
{d3993a3f-...},5/6/7 and {9c119480-...},7 added
```

The installer writes a `backup_<device>_<connector>.reg` per device holding the original values, so
its own uninstall path is a registry restore.

**The caveat:** the install log showed it failing a device and retrying with different install
modes ("Setting install mode for Virtual Desktop Audio Microphone to SFX/EFX… Trying other
configurations… to LFX/GFX"). That fallback logic is device-specific and not documented.
Reimplementing device enabling inside AudioDeck means reimplementing that too, and getting it wrong
means a device with no audio.

`DeviceSelector.exe` is its GUI for this. It requires elevation and exposes no command line (only Qt
window options), so it cannot be driven headlessly.

**Consequence for the install flow:** a fully invisible setup would require AudioDeck to own that
fallback logic. Running the bundled installer with its device page visible is one third-party window
but inherits its handling of awkward devices. This is a real trade and the spec should stop
promising an invisible install until it is decided.

## VST is supported after all

The installation contains a `VSTPlugins` folder. The configuration reference summary used when
scoping said there was no VST support, and that was wrong. This potentially puts **Dynamic Boost**
(a compressor) back within reach for a later version, since it was dropped only because Equalizer
APO has no native dynamics processing. Not investigated further; it does not affect v1.

## The stock config colours the sound

A fresh install ships this, which applies to every enabled device:

```
Preamp: -6 dB
Include: example.txt      # a bass boost: +4 dB @ 20 Hz, +2 dB @ 45 Hz
GraphicEQ: 25 0; 40 0; ...
```

So an untouched install is already 6 dB down with a bass lift. AudioDeck should say so and offer to
clear it, rather than silently competing with it or leaving the user to wonder why "flat" is not
flat.

## Copy: assignments are sequential, and negative factors are unusable

Two findings, both from listening rather than from the documentation.

**Assignments in one `Copy:` line apply one after another, not simultaneously.**
A mid-side matrix written directly:

```
Copy: L=1.5*L-0.5*R R=1.5*R-0.5*L
```

computes the new L, then computes R from that *already modified* L, giving
`1.75R - 0.75L` rather than the intended `1.5R - 0.5L`. Snapshot the originals
into virtual channels first, which is why Equalizer APO's own
`selective_delay.txt` example does exactly that:

```
Copy: ADL=L ADR=R
Copy: L=a*ADL+b*ADR R=a*ADR+b*ADL
```

**A negative factor destroys the audio.** With the snapshot form above and
correct coefficients, every width setting over 100 %, where `b = (1-w)/2` turns
negative, came back as "just thud sounds" on real hardware, three separate
attempts. Below 100 %, where both coefficients are positive, the same code path
behaves correctly. Nothing Equalizer APO ships uses a negative factor.

Stereo *widening* needs each channel to subtract some of the other, so it is
not implementable through `Copy:` and AudioDeck does not offer it. Narrowing
towards mono is, and is what the Stereo width control does. If this is ever
revisited, the thing to establish first is whether the parser accepts a
negative coefficient at all, ideally through Equalizer APO's own trace or
benchmark tooling rather than by asking someone to listen again.
