# Installer - Implementation Plan

Date: 2026-08-02. Executes `docs/specs/2026-08-02-installer-design.md`.
One issue per stage group, branch off `main`, land via PR referencing the issue.

Stages 1 and 2 are independently shippable and worth having even if stage 4 is abandoned. Stage 5
is explicitly allowed to fail.

## Stage 0 - prove the unknowns, before drawing anything

Everything here is cheap because `makensis.exe` lives in electron-builder's cache
(`%LOCALAPPDATA%\electron-builder\Cache\nsis-3.0.4.1\...`) and compiles a test script in about a
second. No `npm run dist` in this loop. A harness script compiles and runs a scratch installer and
captures the window with `CopyFromScreen`, so each iteration is measured rather than eyeballed.

Four questions, in order of how much they would hurt:

1. **Custom buttons.** Hide native controls 1, 2 and 3, draw our own on the page, and forward
   `WM_COMMAND` with the matching IDs to `$HWNDPARENT`. Prove a drawn button actually advances the
   page and that Cancel still aborts.
2. **Private fonts.** The repo ships Anton and Archivo as woff2 only, which GDI cannot load. Fetch
   the TTFs (extend `scripts/fetch-fonts.mjs`), extract to `$PLUGINSDIR` at run time,
   `AddFontResourceExW(..., FR_PRIVATE, ...)`, then `CreateFontW` by family name. Prove Anton
   renders in the installer on a machine where Anton is not installed.
3. **DPI.** Set `ManifestDPIAware true`, lay a page out in dialog units, and screenshot at 100% and
   225%. Decide from the two images. Fallback: leave it unaware.
4. **Frameless caption.** Strip `WS_CAPTION`, handle the drag. Deliberately last; expected to be the
   one that fails.

**Acceptance:** a scratch installer with a drawn amber button that advances a page, in Anton, with a
recorded verdict on DPI. Findings written to `docs/reference/nsis-findings.md`, including whatever
did not work, so the next person does not repeat the probe.

## Stage 1 - the icon

Independent of every NSIS question and the most visible single fix.

- Author `design/icon.svg` from `.brand-mark`: square rotated -3deg, paper border, two skewed amber
  bars, one paper bar.
- Hand-correct the 16 and 24 versions as separate SVG sources. At 16px the rotation and the 6px
  bars turn to mush, so those are redrawn upright with two bars, not scaled down.
- `design/make-icon.mjs` rasterises to PNG and packs `build/icon.ico` at 16/24/32/48/64/128/256.
  Checked in, because contributors should not need the toolchain.
- Replace `TRAY_ICON_PNG_BASE64` in `electron/tray.ts` with the matching 16 and 32 renders.

**Acceptance:** the icon reads at 16px against both a light and a dark taskbar; `dist/` shows it on
the setup exe in Explorer; the tray shows it. Screenshot each.

## Stage 2 - re-cut the mockups at shipping size

The approved mockups are 640x460 with 15px body and 40px targets, which breaks the app's own
accessibility floor. Redraw at 720x520, 17px body, 44px targets, before writing NSIS code against
the wrong numbers.

`design/shoot-installer.mjs` already fails on overflow; extend it to also assert the minimum type
size and target height, so the floor is enforced by the harness and not by memory.

**Acceptance:** five screens plus two uninstaller screens at 720x520, harness reporting no overflow
and no undersized target.

## Stage 3 - the shared page kit in NSIS

`build/installer/kit.nsh`: the parts every page needs, written once.

- `AudioDeckColours` - the palette as defines.
- `AudioDeckFonts` - load the private faces, create display and UI fonts, free them on exit.
- `AudioDeckPage` - create the nsDialogs surface, paint the paper, hide the native header and button
  strip, draw the spine, the brand and the step list.
- `AudioDeckButton` - a drawn button: label, position, target control ID.
- `AudioDeckMeter` - the tick meter, used by the Installing page.

Sizes and positions come from the stage 2 mockups, in dialog units.

**Acceptance:** a scratch page built only from the kit is indistinguishable from its mockup at 100%
and at 225%, compared side by side.

## Stage 4 - the five pages

One file per page under `build/installer/`, wired through `build/installer.nsh`:

- `customWelcomePage` - wordmark, one sentence, the ranked-list miniature.
- The directory page. `MUI_PAGE_DIRECTORY` cannot be restyled to this extent, so it is replaced with
  our own page that sets `$INSTDIR`, keeping the existing `instFilesPre` sanitising that appends the
  app folder name.
- `customPageAfterChangeDir` - the existing audio-effects page, redrawn. Its logic does not change:
  skipped when Equalizer APO is already installed, ticked by default, `ExecShellWait` with `runas`,
  errors cleared so a refusal never fails the install.
- The Installing page: tick meter, percentage in ink, detail lines with the current one in ink.
- `customFinishPage` - the tray pointer, "Open AudioDeck now", Finish.

Then `customUnWelcomePage` and `customUninstallPage` for the uninstaller. `build/installer.nsh` is
compiled into the uninstaller too, so everything installer-only stays inside the existing
`!ifndef BUILD_UNINSTALLER` guard.

**Acceptance:** a real `npm run dist`, then install and uninstall on this machine. Every screen
screenshotted against its mockup. Effects opt-in exercised both ticked and unticked. Cancel
exercised mid-install and the machine checked for leftovers.

## Stage 5 - the caption, behind a fallback

Strip `WS_CAPTION`, draw our own strip, handle dragging and close. Guarded so that failure leaves
the stock title bar and nothing else regresses.

If stage 0 question 4 came back bad, this stage is simply not done, and the spec's fallback stands.

**Acceptance:** the window drags, closes, and takes focus correctly, including through the UAC
elevation the effects page triggers. Any doubt here and it is reverted; a beautiful installer that
cannot be moved is worse than a plain one.

## Testing

There is no unit-testable surface: NSIS script is not reachable from vitest, and Playwright cannot
drive a Win32 installer. The verification is therefore the harness from stage 0 plus screenshot
comparison, and it needs saying plainly rather than being papered over with tests that prove
nothing.

What *is* automated: `design/shoot-installer.mjs` gates the mockups on overflow, type size and
target size, so the design contract cannot rot silently.

What stays manual and must be done before the PR: install, uninstall, reinstall over an existing
install, cancel mid-install, and effects both accepted and refused.

`scripts/check-bundle-inputs.mjs` gains `build/icon.ico`, so a missing icon fails the build with a
clear message instead of silently shipping the Electron default again.

## Order and risk

| Stage | Ships value alone | Risk |
|---|---|---|
| 0 probes | no | none, it is throwaway |
| 1 icon | yes, large | none |
| 2 mockups | no | none |
| 3 kit | no | medium, rests on stage 0 |
| 4 pages | yes, large | medium |
| 5 caption | marginal | high, and allowed to fail |

If stage 0 shows drawn buttons cannot drive the flow, stages 3 to 5 are abandoned and the work
falls back to stage 1 plus branded MUI bitmaps and colours. That fallback is worth having on its
own, and is the reason the icon goes first.
