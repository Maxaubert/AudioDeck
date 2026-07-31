# One device page - Design

Date: 2026-07-31. Folds Priority into the Devices page, leaving `Devices | Settings`.
Supersedes the tab layout in `2026-07-31-device-manager-design.md`.

## Why

Priority and Devices still show the same hardware twice. The priority list is just the device list
in a chosen order, so the order should live on the device rows themselves rather than on a page of
its own. Ranking is also the only thing you ever do to more than one device at a time, and doing it
on a page that cannot show volume or state made it a guess.

## The page

Tabs are `Devices | Settings`. Two sections, Outputs and Microphones.

At rest a section shows **only ranked devices**, in priority order, numbered:

```
OUTPUTS                                          2 ranked

 1  [H] STEELSERIES              ####...... 40%   MUTE   ...
        Arctis Nova Pro
 2  [T] LG TV                    ##........ 25%   MUTE   ...
        NVIDIA High Definition Audio

[ + MORE DEVICES (3) ]
```

Pressing `+ MORE DEVICES (n)` expands the rest in place, as ordinary rows under a
`NOT IN PRIORITY` break: same row design, working faders, working mute. Pressing it again
collapses them. `n` counts real endpoints only. The remembered-ghost toggle moves inside the
revealed section, so endpoints Windows merely remembers are two presses away rather than one.

The row is unchanged from the current Devices page: rank, glyph, name and detail, volume,
percentage, action slot, expander. Every volume treatment stays as it is, including the Ø stamp.

## Ordering

Ranked rows are draggable. Drag a row onto another row's slot and it takes that position; the
existing drop-target styling carries over. The ▲▼ buttons are gone.

Drag-and-drop is mouse-only, so a focused ranked row also answers `Alt+ArrowUp` and
`Alt+ArrowDown` to move one place. This adds nothing visible to the row and keeps reordering
possible without a mouse. The row's hint text names it.

## Ranking and unranking

An unranked row carries a `+` button **in the rank slot** rather than a number. The left column
means "position in the order", so the control that grants a position belongs there, and it costs no
width. Pressing it appends the device to the bottom of its list, exactly as the old Add picker did,
and clears any exclusion.

`Remove from priority` lives in the expanded panel, next to Rename and Disable. It keeps the
current behaviour: the device is excluded and does not come back on its own.

## What is deleted

`views/PriorityView.tsx`, `components/PriorityList.tsx` and `components/AddDevicePicker.tsx` all
go. Their drag logic moves onto the device row; `reorder.ts`'s `moveItem` is reused unchanged.

Priority rows for ids Windows no longer reports stay invisible, which comes free:
`partitionDevices` already drops ids it cannot resolve.

## Files

- `views/DeviceManagerView.tsx` - sections, the reveal, the ghost toggle, which row is expanded,
  and the drag state. Owns reorder and rank/unrank calls.
- `components/DeviceRow.tsx` - gains `draggable`, the drag handlers, the `+` in the rank slot, and
  the Alt+Arrow handler.
- `components/DeviceControls.tsx` - gains `Remove from priority` for ranked devices.
- `components/DeviceList.tsx` - new: the `<ol>` wrapper plus the drag bookkeeping shared by both
  sections, so `DeviceManagerView` does not grow a second job.

## Testing

- vitest: `deviceOrder` is unchanged and its tests stand. No new pure logic beyond reuse.
- Playwright: `priority-reorder.spec.ts` is rewritten against the one page - drag reorders and
  persists to `config.json`, `Alt+ArrowDown` does the same, `+` appends and clears the exclusion,
  `Remove from priority` excludes. `views.spec.ts` loses its Priority-tab navigation and gains a
  check that unranked devices are hidden until `+ MORE DEVICES` is pressed.
- Screenshots and README follow: one `devices.png`, no priority shot.

## Out of scope

No daemon, IPC, config or `audioctl` change. The rules engine still seeds and appends devices the
same way; this is a renderer-only change.
