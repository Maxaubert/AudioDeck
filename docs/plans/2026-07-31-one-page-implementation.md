# One device page - Implementation Plan

Date: 2026-07-31. Executes `docs/specs/2026-07-31-one-page-design.md`.
Continues on branch `device-manager`, into the open PR #4.

## Stage 1 - the list wrapper and its drag state

`components/DeviceList.tsx`: the `<ol className="strip-list">` plus drag bookkeeping lifted from
`PriorityList` (drag index, drop-target index, the `dragHappened` ref that stops a completed drag
from also reading as a click). Props: the rows to draw, the ranked count, and `onReorder`.

Only ranked rows are draggable; a drop onto an unranked row is ignored, so dragging can never
imply ranking. That keeps `+` the single way in.

Acceptance: typecheck clean, nothing wired up yet.

## Stage 2 - the row

`components/DeviceRow.tsx`:
- rank slot renders the number when ranked, and a `+` button labelled
  `Add <name> to priority` when not.
- `draggable` and the drag handlers when ranked, forwarded from `DeviceList`.
- `onKeyDown` gains `Alt+ArrowUp` / `Alt+ArrowDown` calling the move callback. The existing
  Enter/Space switch-device handling stays; Alt distinguishes them.
- the `title` hint mentions dragging and the Alt+Arrow keys.

`components/DeviceControls.tsx`: add `Remove from priority`, shown only for ranked devices.

Acceptance: typecheck clean.

## Stage 3 - the page

`views/DeviceManagerView.tsx`:
- per-section `revealed` state, default false; `+ MORE DEVICES (n)` toggles it, where `n` is
  `unranked.length`.
- the `NOT IN PRIORITY` break and the unranked rows render only while revealed.
- the remembered-ghost toggle renders only while revealed, below the unranked rows.
- reorder calls `setPriority(flow, moveItem(rankedIds, from, to))`; rank calls `addToPriority`;
  unrank calls `removeFromPriority`.

`App.tsx`: `ViewName` becomes `devices | settings`; tabs become `Devices | Settings`; the initial
view is `devices`.

Delete `views/PriorityView.tsx`, `components/PriorityList.tsx`, `components/AddDevicePicker.tsx`.

Acceptance: app builds, both old pages gone.

## Stage 4 - styles

- `.rank-add`: the `+` button filling the rank slot, solid border (it is a control), inverting on
  hover, 44px minimum.
- Keep `.is-dragging` and `.is-drop-target`; confirm they still read on the merged row.
- Drop `.add-device`, `.add-device-head`, `.add-device-list`, `.btn-add-row` if the picker was
  their only user; keep `.btn-add-device` for the reveal and the ghost toggle.
- `cursor: grab` on ranked rows, `grabbing` while dragging.

Acceptance: visual check at 940px and 1180px, no horizontal overflow, screenshots regenerated.

## Stage 5 - tests and docs

- Rewrite `e2e/priority-reorder.spec.ts` against the one page: drag reorders and persists;
  `Alt+ArrowDown` reorders and persists; `+` appends and clears `excluded`;
  `Remove from priority` excludes and the row leaves the ranked list.
- `views.spec.ts`: drop Priority-tab navigation, assert unranked devices are hidden until
  `+ MORE DEVICES` is pressed and that the ghost toggle only exists once revealed.
- `scripts/capture-screenshots.mjs`, `design/shoot-app.mjs`: one Devices shot.
- README: gallery down to one image, feature list rewritten for the single page.

Acceptance: `npm run typecheck`, `npm run test`, `npm run e2e` green.

## Verification

`npm run dist` (stop the daemon first, it holds the exe), relaunch, then on the real machine:
reorder by dragging and confirm auto-switch follows the new order; reveal more devices and rank
one with `+`; remove one and confirm it stays out.
