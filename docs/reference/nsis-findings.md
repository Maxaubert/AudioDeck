# What NSIS will and will not do

Date: 2026-08-02. Measured on this machine, not taken from documentation. Probes live in
`design/probe/`; run one with `node design/probe/probe.mjs p1-buttons.nsi [clickX clickY]`, which
compiles with the `makensis.exe` electron-builder already cached and photographs the result. The
loop is about a second, so none of this needs `npm run dist`.

Written down because every one of these cost something to learn, and the next person should not
have to pay again.

## Controls

| Question | Answer |
|---|---|
| Paint an nsDialogs page background | yes, `SetCtlColors` on the dialog |
| Paint a label | yes, statics honour `WM_CTLCOLORSTATIC` |
| Paint a **button** face | **no.** Themed buttons ignore `WM_CTLCOLORBTN`, and `SetWindowTheme` only returns them to the classic grey face |
| Drive the page flow from a drawn control | **yes**, and this is what makes the design possible |

The button answer decides the architecture. Since a button cannot be coloured, the native
Back/Next/Cancel strip is hidden and replaced with `STATIC` controls carrying `SS_NOTIFY`, which
are paintable and clickable. Their click handler forwards to the parent:

```nsis
SendMessage $HWNDPARENT ${WM_COMMAND} 1 0   ; 1 Next, 2 Cancel, 3 Back
```

NSIS still runs its own page machinery, so Back, Cancel and the leave functions all keep working.
Hiding the native buttons does not stop them receiving the command.

## The canvas

The nsDialogs page normally sits in a well between the MUI header and the button strip, so paper
covers only the middle band and the parent's grey shows above and below. Stretching it over the
whole client area is what makes a full-bleed design possible:

```nsis
System::Call "user32::GetClientRect(p $HWNDPARENT, p r3)"
System::Call "user32::SetWindowPos(p $Dlg, p 0, i 0, i 0, i r6, i r7, i ${SWP_NOZORDER})"
```

The MUI furniture is hidden by control id on `$HWNDPARENT`: 1034 to 1039 (header statics), 1028
(the Nullsoft branding), 1256 (the separator), and 1, 2, 3 (the buttons).

## Fonts

The app ships Anton and Archivo as woff2, which GDI cannot read. `scripts/fetch-fonts.mjs` now also
writes TrueType copies to `build/fonts/` from the same Google Fonts source, so the two cannot
drift.

Extract to `$PLUGINSDIR` and register privately, which needs no administrator and leaves nothing
behind:

```nsis
System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\anton.ttf', i 0x10, p 0)"   ; FR_PRIVATE
CreateFont $Font "Anton" 30 400
SendMessage $ctl ${WM_SETFONT} $Font 1
```

Verified against a control label asking for a family nobody has: it falls back to something
completely unlike Anton, so the private registration is doing the work. Neither face is installed
on this machine.

**Anton needs generous rows.** At 30pt it is clipped by a 26u label, top and bottom. Point sizes and
row heights have to be tuned together and checked in a capture, not assumed.

## DPI

`ManifestDPIAware true` is worth taking. Same window, measured in real pixels:

| | Physical size | Window DPI | Look |
|---|---|---|---|
| Default (unaware) | 1132 x 878 | 96 | Windows bitmap-scales a 503 x 390 render. Soft. |
| `ManifestDPIAware true` | 1082 x 862 | 216 | Renders natively at 225%. Crisp. |

Same apparent size, far better rendering. **The cost: only dialog units scale.** In the probe the
bar sized `60u 4u` tracked the font correctly, while the bar sized in raw pixels stayed small and
landed in the wrong place entirely.

**Rule: every coordinate and size in the installer is in dialog units. Never pixels.**

Measuring this needs a DPI-aware observer. `design/probe/capture.ps1` calls
`SetProcessDpiAwarenessContext(-4)` first, or `GetWindowRect` hands back virtualised numbers and
both variants appear to be the same size, which is the one comparison that matters.

## The caption

`WS_CAPTION` and `WS_SYSMENU` can be stripped from `$HWNDPARENT`, followed by `SetWindowPos` with
`SWP_FRAMECHANGED` or it keeps painting the old frame. The window then renders with no title bar
and our own strip reaches the edge. The look is available.

**Dragging is not solved.** A static reports a click, not a button-down, so the usual
`ReleaseCapture` plus `WM_NCLBUTTONDOWN HTCAPTION` trick has nothing to hang on without subclassing
the dialog window proc. Until that is answered, the caption stays native: a window that cannot be
moved is worse than a plain one.

## Traps

- `OutFile` in a probe script overrides `/XOutFile`, because script lines run after `/X` commands.
  The probes leave `OutFile` out and let the harness supply it.
- **NSIS silently treats an unknown `${DEFINE}` as empty.** `IntOp $1 ${WS_CAPTION} | ${WS_SYSMENU}`
  compiled to a zero mask and stripped nothing, with only a warning to show for it. `GWL_STYLE`
  comes from WinCore, the `WS_*` window styles do not. Read the warnings.
- `SS_NOTIFY`, `SS_CENTER` and `SS_CENTERIMAGE` *are* already defined by WinCore. Guard redefinitions
  with `!ifndef`.
- A synthetic click goes to whichever window is physically on top, so the probe harness lifts the
  installer topmost before clicking. Without it the click silently lands on whatever was in front,
  which is indistinguishable from a control that did not fire.
- `PrintWindow` with `PW_RENDERFULLCONTENT` captures an occluded window correctly and never steals
  focus. `CopyFromScreen` photographs whatever is in front of it.
