# Installer - Design

Date: 2026-08-02. Replacing the stock NSIS wizard with an installer cut from the same stock as the
app, and giving AudioDeck an application icon, which it has never had.

## Why bother

The installer is the first thing anyone sees, and right now it is a grey MUI wizard carrying the
default Nullsoft globe. Worse, `build/icon.ico` does not exist, so the setup executable, the
taskbar button, the Start menu entry and the Add/Remove Programs row all show the stock Electron
icon. The tray is a hand-rolled 16x16 speaker PNG embedded as base64 in `electron/tray.ts`.

The icon is the larger of the two problems and the cheaper to fix. It ships first and independently
of everything else here.

## What NSIS actually permits

Measured on this machine rather than taken from documentation. A throwaway script compiled with the
`makensis.exe` in electron-builder's cache and run:

| Attempt | Result |
|---|---|
| Paper background on an nsDialogs page (`SetCtlColors $Dialog`) | works |
| Repainting the MUI header statics and the separator | works |
| A display-weight font on a label (`CreateFont` + `WM_SETFONT`) | works |
| Stripping a button's visual style (`uxtheme::SetWindowTheme`) | works, the button loses its theme |
| **Colouring that button's face (`SetCtlColors`)** | **does not work; the face stays system grey** |

That last row decides the architecture. A themed Win32 button ignores `WM_CTLCOLORBTN`, and removing
the theme only returns it to the classic grey face. There is no colour route to a flat amber
button, so the native Back/Next/Cancel strip cannot be restyled. It has to be **hidden and
replaced**: our own controls drawn on the page, forwarding `WM_COMMAND` to `$HWNDPARENT` with the
native control IDs (1 Next, 2 Cancel, 3 Back) so NSIS's own page machinery still drives the flow.

Once the buttons are ours, the header band and branding text may as well go too, and each page
becomes one full-bleed nsDialogs surface. That is the design below.

The electron-builder hooks needed all exist, verified in
`node_modules/app-builder-lib/templates/nsis/assistedInstaller.nsh`: `customWelcomePage`,
`customPageAfterChangeDir` (already in use), `customFinishPage`, `customUnWelcomePage`,
`customUninstallPage`, plus `customHeader` and `customInit` in `installer.nsi`. Our
`build/installer.nsh` is included *before* `MUI2.nsh`, which is why the existing file cannot use
`MUI_HEADER_TEXT`, and equally why it *can* set `MUI_*` defines that the page macros later read.

## Rejected alternatives

- **One-click installer** (`oneClick: true`). No wizard at all, just a branded progress splash.
  Much less work and genuinely tasteful. Rejected because it removes the audio-effects page, and
  registering a component in the system audio path must stay something the user can refuse.
- **`nsis.script`**, replacing electron-builder's generated script wholesale. Total freedom, but we
  would inherit responsibility for per-user install mode, the uninstaller, the registry keys, the
  update path and the UAC dance. The cost is permanent and the gain is cosmetic.
- **Recolouring MUI in place.** The table above rules it out.

## The design

Direction: **Sleeve**. Mockups in `design/mockups/inst-a-sleeve.html`, shot to
`design/shots/inst-a-sleeve.png`. A black spine down the left carries the brand and the step list;
the page to the right is paper. The spine is identical on every screen, so the flow reads as one
object being turned rather than five dialogs in sequence.

Five screens: **Welcome**, **Where it goes**, **Audio effects**, **Installing**, **Ready**.

Two details carry most of the character:

- The welcome screen shows a **miniature of the ranked device list**, built from the app's own row
  parts: rank block, name, meter, and the hatched fill used for hardware that is not plugged in.
  The installer demonstrates the product instead of describing it, and nothing new had to be
  invented to draw it.
- The **progress meter is the app's volume readout**, discrete ticks rather than a themed bar. The
  detail lines NSIS prints anyway are kept, history fading back into the stock, with the line being
  worked on set in ink.

Amber is used as ink and never as type on paper: `#ffb454` on `#f2f0ea` measures about 1.7:1. The
percentage figure on the Installing screen is therefore black, not amber.

### Sizing, and an accessibility correction

The mockups are drawn at 640x460 with 15px body text and 40px buttons. That breaks the app's own
stated floor in `src/renderer/src/styles.css`: *"Body text >= 17px; every interactive target >=
44px"*, set for a low-vision user. An installer that violates the app's accessibility rule is not
acceptable, so the window grows instead:

- Window **720 x 520**.
- Body **17px**, fine print no smaller than **13px**.
- Every button and checkbox target **>= 44px**.

The mockups are re-cut at these numbers before any NSIS work begins, so what gets built is what was
approved at the size it will ship.

### The caption

The mockups show our own black caption strip, matching the app's frameless window. This needs
`WS_CAPTION` stripped from `$HWNDPARENT` and the drag handled by us. It is the highest-risk piece of
the whole design and the least important, so it is built last, behind a fallback: if it misbehaves,
the stock Windows title bar stays and nothing else changes.

### The uninstaller

Gets the welcome and finish screens in the same language via `customUnWelcomePage` and
`customUninstallPage`. Cheap, and an unstyled uninstaller would undo the point.

## The icon

Derived from `.brand-mark` in the app's stylesheet, which is already a drawn logo: a square rotated
-3 degrees, a paper border, two skewed amber bars and a paper bar. Authored as SVG, rasterised to a
multi-resolution `.ico` at 16, 24, 32, 48, 64, 128 and 256, with the 16 and 24 hand-corrected
rather than downsampled, because the -3 degree rotation and the 6px bars turn to mush at that size.

It becomes `build/icon.ico` (electron-builder picks it up for the app, the setup executable, the
uninstaller and the Add/Remove Programs entry) and replaces the base64 speaker glyph in
`electron/tray.ts`.

## DPI

NSIS installers are DPI-unaware by default, so at this machine's 225% Windows bitmap-scales the
whole window and everything softens. The design survives that better than most, being flat colour,
heavy rules and Anton, but it is still soft.

`ManifestDPIAware true` fixes it, at the cost that nothing scales automatically except what is
expressed in dialog units. The design is almost entirely type and rectangles, which dialog units
handle; the brand mark is the exception and ships as pre-rendered bitmaps at several scales.

This is unverified and is the first thing the plan proves. If DPI-awareness breaks the layout, the
fallback is DPI-unaware, which is uniformly soft but never broken.

## Success criteria

1. `build/icon.ico` exists and shows in Explorer, the taskbar, and Add/Remove Programs.
2. All five installer screens and both uninstaller screens render in the Sleeve language.
3. No system-grey button, no Nullsoft globe, no MUI header band anywhere in the flow.
4. Body text >= 17px and every target >= 44px, measured.
5. The audio-effects opt-in still works: ticked by default, refusable, its failure never fails the
   install.
6. A cancelled install still cleans up, and the uninstaller still leaves the machine as found.
