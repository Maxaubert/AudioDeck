# Device Manager - Design

Date: 2026-07-31. Merges the Mixer and Devices tabs into a single Devices view.

## Why

Mixer and Devices show the same devices twice. Mixer owns volume, mute and switching for ranked
devices; Devices owns naming, type and enable/disable for every endpoint. A device you want to
rename and then set the level of costs a tab change, and a device that is not in the priority list
has no volume control at all even when it is active and selectable. One list per flow, carrying
every control that device has, removes the split.

Priority keeps its own tab. Ranking is an ordering task with drag-and-drop, not a per-device
property, and mixing it into a per-row control panel would make both worse.

## The view

Tabs become `Priority | Devices | Settings`. The heading is "Devices".

Two sections, Outputs and Microphones, as today. Inside a section:

1. Ranked devices, in priority order, numbered, each carrying its rank slab.
2. A `NOT IN PRIORITY` break.
3. Every other endpoint Windows reports as real, in enumeration order.
4. The existing `Show remembered devices (n)` toggle, revealing `notpresent` ghosts.

Ordering matches the Priority tab, so the two views read the same way down the page.

## The row

At rest, one line, keeping the Mixer's rhythm:

```
 1  [H] STEELSERIES              ####...... 40%   MUTE   ...
        Arctis Nova Pro
```

Columns: rank slab (blank for unranked), glyph, name and detail, volume, percentage, primary
action, expander. The rank slab stays in the grid for unranked rows so every row's columns line up.

Row state drives the volume columns, unchanged from the current Mixer:

- Active, writable: segmented meter with the invisible range input over it, percentage, `MUTE`.
- Active, volume-locked: `Volume set on the device`, `--`, and the dashed Ø stamp with its tooltip.
- Not active: `Unavailable`, `--`, and no mute. A `disabled` endpoint shows `ENABLE` in the action
  slot, because enabling is the only thing that row can do and the slot is otherwise empty.

Clicking the row body switches the default device, as the Mixer row does now. Clicks inside the
fader, a button, a select or the expanded panel are controls, not a switch request.

## The expander

The `...` button toggles a panel below the row holding the management controls:

```
    +----------------------------------------------------+
    | TYPE [ TV        v ]     RENAME       DISABLE      |
    +----------------------------------------------------+
```

- Type dropdown, exactly the current control including the disabled-option handling for types the
  app does not offer.
- `RENAME`, opening the existing two-field form (name and parenthesized text) inside the panel.
- `DISABLE` for active endpoints, `ENABLE` for disabled ones. Disable is destructive enough that it
  should not sit one click away next to Mute; enable is not, which is why a disabled row also
  surfaces it in the collapsed line.

One row is expanded at a time. Opening a second closes the first, so the list never grows into a
wall of open panels. Expansion is renderer state only, not persisted.

The `Saving` chip stays on the collapsed row, so an optimistic rename or type change is visible
after the panel closes.

Accessibility: the expander is a real button with `aria-expanded` and `aria-controls` pointing at
the panel; the panel is labelled by the device name. Body text stays at or above the existing
sizes and every target keeps its 44px minimum.

## Ordering logic

A pure helper, `src/renderer/src/deviceOrder.ts`:

```ts
partitionDevices(devices: DeviceView[], priority: string[], flow: Flow):
  { ranked: DeviceView[]; unranked: DeviceView[]; ghosts: DeviceView[] }
```

`ranked` follows the priority array and skips ids Windows no longer reports. `unranked` is every
remaining endpoint whose state is not `notpresent`, in the order the daemon listed them. `ghosts`
is the `notpresent` remainder. This is the only new logic in the change and it is unit-tested.

## Files

`MixerView.tsx` and `DevicesView.tsx` are both deleted. The merged view is split rather than
concatenated, since together they are over 450 lines:

- `views/DeviceManagerView.tsx` - sections, ordering, ghost toggle, which row is expanded.
- `components/DeviceRow.tsx` - the collapsed line and its switch-on-click behaviour.
- `components/VolumeFader.tsx` - meter, range input, local state, debounced commit, flush on
  unmount. Lifted verbatim out of `MixerStrip`.
- `components/DeviceControls.tsx` - the expanded panel: type, rename form, enable/disable, and the
  optimistic pending state that currently lives in `DeviceRow` of the Devices view.

## Testing

- vitest: `deviceOrder.test.ts` covers ranked ordering, ids in priority that no longer exist,
  unranked partitioning, ghost separation, and an empty priority list.
- Playwright: the existing Mixer and Devices specs merge into one `devices.spec.ts`. Fader, mute,
  the volume-lock stamp, switch-on-row-click and the debounce-survives-tab-change test keep their
  assertions and lose the tab hop. Rename and type change gain an expander click. New assertions:
  an unranked active device has a working fader, opening a second expander closes the first.
- Screenshots: `docs/screenshots/mixer.png` and `devices.png` collapse to one `devices.png`;
  `scripts/capture-screenshots.mjs` and the README gallery follow.

## Out of scope

Adding to or removing from the priority list stays on the Priority tab, including its Add picker.
Reordering stays drag-and-drop on the Priority tab. No change to the daemon, IPC surface, config
schema or `audioctl`; this is a renderer-only change.
