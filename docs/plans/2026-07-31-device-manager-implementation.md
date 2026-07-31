# Device Manager - Implementation Plan

Date: 2026-07-31. Executes `docs/specs/2026-07-31-device-manager-design.md`.
Renderer-only change. Work happens on a branch off `main`, lands via PR referencing its issue.

## Stage 1 - ordering helper

`src/renderer/src/deviceOrder.ts`: `partitionDevices(devices, priority, flow)` returning
`{ranked, unranked, ghosts}`. Pure, no React.

`deviceOrder.test.ts`: priority order is honoured; a priority id Windows no longer reports is
skipped rather than rendered as a hole; unranked actives keep enumeration order; `notpresent`
endpoints land in `ghosts` whether or not they are ranked; empty priority puts everything in
`unranked`.

Acceptance: `npm run test` green with the new file.

## Stage 2 - extract the fader

`components/VolumeFader.tsx`: the `Meter` component plus the local-value state, the 200ms debounced
commit, the follow-the-daemon effect and the flush-on-unmount effect, lifted out of `MixerStrip`
unchanged. Props: `device`, `actions`.

No behaviour change; this stage exists so the merged row is assembled from parts rather than
rewritten. `MixerView` temporarily imports it so the app keeps building.

Acceptance: typecheck clean, existing e2e volume tests still pass against the old tabs.

## Stage 3 - the row and its panel

`components/DeviceControls.tsx`: type select, rename form, enable/disable button, and the pending
name/detail/type optimistic state with its 8s clear timer, moved from the Devices view's
`DeviceRow`. Props: `device`, `actions`, `onClose`.

`components/DeviceRow.tsx`: the collapsed line. Rank slab, glyph, name and detail with
`StateBadge`, then one of the three volume treatments (fader, volume-locked stamp, unavailable),
then the action slot (`MUTE`, `ENABLE`, or empty), then the `...` expander. Row-body click and
Enter/Space switch the default. Props include `expanded` and `onToggleExpand`, so the parent owns
which row is open.

Acceptance: components typecheck in isolation; not yet wired into a view.

## Stage 4 - the merged view

`views/DeviceManagerView.tsx`: Outputs and Microphones sections, each running `partitionDevices`,
rendering ranked rows, the `NOT IN PRIORITY` break when `unranked` is non-empty, the unranked rows,
and the existing ghost toggle. Holds `expandedId: string | null` for the whole view, so opening one
panel closes any other.

Delete `views/MixerView.tsx` and `views/DevicesView.tsx`.

`App.tsx`: `ViewName` becomes `priority | devices | settings`; tabs become
`Priority | Devices | Settings`.

Acceptance: app builds and both old tabs are gone.

## Stage 5 - styles

`styles.css`:
- Replace `.mixer-strip` and `.device-strip` grids with one `.device-strip` grid carrying the
  expander column. Check the row still fits at the 900px `minWidth`; raise `minWidth` in
  `electron/window.ts` only if it genuinely does not.
- `.btn-expand`: square, 44px minimum, dashed border when closed and solid when open, so open state
  reads without colour.
- `.device-panel`: the expanded strip, sitting inside the row's grid across all columns, with the
  sheet background and a solid rule above it.
- `.section-break`: the `NOT IN PRIORITY` rule.
- Drop `.move-controls` if nothing else uses it.

Follow the existing print language: hard edges, no radius, dashed means inert, amber as accent ink.

Acceptance: visual check of the running app against the design skills' guidance
(design-taste, frontend-design, web-design-guidelines).

## Stage 6 - tests and docs

- Merge `e2e/views.spec.ts`'s Mixer and Devices tests into the single Devices tab: fader values,
  mute count, the volume-lock stamp with its focus-route tooltip assertions, switch-on-row-click,
  the debounce-survives-navigation test, ghosts behind the toggle. Rename and the type dropdown
  gain an expander click first. Add: an unranked active device has a working fader; opening a
  second expander closes the first.
- `scripts/capture-screenshots.mjs` and `design/shoot-app.mjs`: one Devices shot, not two.
- `docs/screenshots/`: regenerate, delete `mixer.png`.
- README: update the gallery and any Mixer/Devices wording.

Acceptance: `npm run typecheck`, `npm run test`, `npm run test:e2e` all green; screenshots
regenerated; README matches what the app now shows.

## Verification

Build with `npm run dist`, stop the running daemon first (it holds `AudioDeck.exe`), relaunch
after. Then on the real machine: an unranked active device shows a fader that moves audio; the
Arctis still shows the Ø stamp and no percentage; rename through the panel still changes the name
in Windows itself; disable and re-enable an endpoint.
