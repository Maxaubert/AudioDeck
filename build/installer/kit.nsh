; AudioDeck installer: the shared parts every page is built from.
;
; Why this exists at all is recorded in docs/reference/nsis-findings.md. The
; short version: SetCtlColors will not paint a themed button face, so the native
; Back/Next/Cancel strip cannot be restyled. It is hidden and replaced with
; STATIC controls carrying SS_NOTIFY, which are paintable and clickable, and
; which forward WM_COMMAND to the parent with the native ids so NSIS keeps
; running its own page machinery.
;
; Coordinates. Everything here is written in the mockup's own pixels
; (design/mockups/inst-a-sleeve.html, 720x520) and converted to device pixels by
; AdPx. The installer is DPI aware, so nothing scales on its own; doing the
; arithmetic explicitly is more predictable than dialog units, which move with
; the dialog font, and it means the mockup and this file can be read side by
; side.

!ifndef AUDIODECK_KIT_INCLUDED
!define AUDIODECK_KIT_INCLUDED

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; WinCore defines the SS_* styles but not the window styles we need.
!ifndef SS_NOTIFY
  !define SS_NOTIFY 0x00000100
!endif
!ifndef SS_CENTER
  !define SS_CENTER 0x00000001
!endif
!ifndef SS_CENTERIMAGE
  !define SS_CENTERIMAGE 0x00000200
!endif
!ifndef SS_RIGHT
  !define SS_RIGHT 0x00000002
!endif
!define AD_SWP_NOZORDER 0x0004
!define AD_FR_PRIVATE 0x10

; The design system, straight from src/renderer/src/styles.css.
!define AD_INK      "000000"
!define AD_PAPER    "F2F0EA"
!define AD_SHEET    "FFFFFF"
!define AD_DEAD     "E3E0D8"
!define AD_DEADINK  "46463F"
!define AD_MARKER   "FFB454"
!define AD_DIM      "6F6D63"
!define AD_CAPTXT   "9D9A8F"
; Ink for type sitting on amber. Amber on paper measures about 1.7:1, so amber
; is only ever a fill here, never type on stock.
!define AD_ONMARKER "6B3C00"

; The window, in mockup pixels.
!define AD_W 720
!define AD_H 520
!define AD_SPINE_W 218
!define AD_RULE 6
!define AD_PAD 28

!define AD_DRAWN "${WS_VISIBLE}|${WS_CHILD}|${SS_NOTIFY}|${SS_CENTER}|${SS_CENTERIMAGE}"
!define AD_PLATE "${WS_VISIBLE}|${WS_CHILD}|${SS_CENTERIMAGE}"

Var AdDlg
Var AdDpi
Var AdFontH1      ; Anton 40px, page headline
Var AdFontWord    ; Anton 38px, the wordmark
Var AdFontStepN   ; Anton 19px, step numerals
Var AdFontNum     ; Anton 23px, the ranked-list figures
Var AdFontBig     ; Anton 62px, the percentage
Var AdFontBody    ; Archivo 600 17px
Var AdFontLabel   ; Archivo 800 15px, buttons
Var AdFontStep    ; Archivo 800 13px, the step list
Var AdFontFine    ; Archivo 800 13px, fine print
Var AdBtnNext
Var AdBtnBack
Var AdBtnCancel

/**
 * Mockup pixels to device pixels. The window reports its own DPI, so this is
 * the one place scaling happens.
 */
!macro AdPx out value
  IntOp ${out} ${value} * $AdDpi
  IntOp ${out} ${out} / 96
!macroend
!define AdPx "!insertmacro AdPx"

/**
 * Load the app's faces privately. GDI cannot read the woff2 the renderer uses,
 * so build/fonts carries TrueType copies fetched from the same source by
 * scripts/fetch-fonts.mjs. FR_PRIVATE needs no administrator and leaves nothing
 * registered behind.
 *
 * Point sizes are the mockup's pixel sizes times 0.75; CreateFont converts
 * points to pixels against the screen DPI itself, so these must NOT go through
 * AdPx or they scale twice.
 */
!macro AdLoadFonts
  InitPluginsDir
  File "/oname=$PLUGINSDIR\ad-anton.ttf" "${AD_BUILD_DIR}\fonts\anton-400.ttf"
  File "/oname=$PLUGINSDIR\ad-archivo-600.ttf" "${AD_BUILD_DIR}\fonts\archivo-600.ttf"
  File "/oname=$PLUGINSDIR\ad-archivo-800.ttf" "${AD_BUILD_DIR}\fonts\archivo-800.ttf"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\ad-anton.ttf', i ${AD_FR_PRIVATE}, p 0)"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\ad-archivo-600.ttf', i ${AD_FR_PRIVATE}, p 0)"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\ad-archivo-800.ttf', i ${AD_FR_PRIVATE}, p 0)"

  CreateFont $AdFontH1    "Anton"   30 400
  CreateFont $AdFontWord  "Anton"   28 400
  CreateFont $AdFontStepN "Anton"   14 400
  CreateFont $AdFontNum   "Anton"   17 400
  CreateFont $AdFontBig   "Anton"   46 400
  CreateFont $AdFontBody  "Archivo" 13 600
  CreateFont $AdFontLabel "Archivo" 11 800
  CreateFont $AdFontStep  "Archivo" 10 800
  CreateFont $AdFontFine  "Archivo" 10 800
!macroend

/** Size the window to the design and centre it. */
!macro AdSizeWindow
  System::Call "user32::GetDpiForWindow(p $HWNDPARENT) i .s"
  Pop $AdDpi
  ${If} $AdDpi < 96
    StrCpy $AdDpi 96
  ${EndIf}
  ${AdPx} $0 ${AD_W}
  ${AdPx} $1 ${AD_H}

  ; The design is 720x520 of *page*, and every control is positioned against the
  ; page origin. Sizing the window to those numbers instead makes the client
  ; short by the caption and borders, so the layout runs off the bottom. Measure
  ; the non-client difference and add it back.
  ; System names $0-$9 as r0-r9; $R0-$R9 are r10-r19, and a bare .rR9 is not a
  ; register at all. Keeping to $0-$9 here avoids writing the size into nothing.
  System::Alloc 16
  Pop $4
  System::Call "user32::GetWindowRect(p $HWNDPARENT, p r4)"
  System::Call "*$4(i .r5, i .r6, i .r7, i .r8)"
  IntOp $7 $7 - $5      ; current window width
  IntOp $8 $8 - $6      ; current window height
  System::Call "user32::GetClientRect(p $HWNDPARENT, p r4)"
  System::Call "*$4(i .r5, i .r6, i .r9, i .r2)"
  System::Free $4
  IntOp $7 $7 - $9      ; width the frame costs
  IntOp $8 $8 - $2      ; height the frame and caption cost
  IntOp $0 $0 + $7
  IntOp $1 $1 + $8

  System::Call "user32::GetSystemMetrics(i 0) i .r2"
  System::Call "user32::GetSystemMetrics(i 1) i .r3"
  IntOp $2 $2 - $0
  IntOp $2 $2 / 2
  IntOp $3 $3 - $1
  IntOp $3 $3 / 2
  System::Call "user32::SetWindowPos(p $HWNDPARENT, p 0, i r2, i r3, i r0, i r1, i ${AD_SWP_NOZORDER})"
!macroend

/**
 * Take the MUI furniture off the parent: header statics, the Nullsoft branding,
 * the separator, and the three buttons we are replacing. Hidden rather than
 * destroyed, because the buttons still have to receive WM_COMMAND.
 */
!macro AdStripChrome
  StrCpy $1 1034
  ${Do}
    GetDlgItem $0 $HWNDPARENT $1
    ${If} $0 <> 0
      ShowWindow $0 ${SW_HIDE}
    ${EndIf}
    IntOp $1 $1 + 1
  ${LoopUntil} $1 > 1039
  GetDlgItem $0 $HWNDPARENT 1028
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1256
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}
!macroend

/**
 * A paper-coloured page filling the whole window.
 *
 * The nsDialogs page normally sits in a well between the MUI header and the
 * button strip, so paper would cover only a middle band with the parent's grey
 * showing above and below. Stretching it over the parent's client area is what
 * makes the design possible at all.
 */
!macro AdBeginPage
  nsDialogs::Create 1018
  Pop $AdDlg
  ${If} $AdDlg == error
    Abort
  ${EndIf}
  SetCtlColors $AdDlg ${AD_INK} ${AD_PAPER}
  !insertmacro AdStripChrome

  System::Alloc 16
  Pop $3
  System::Call "user32::GetClientRect(p $HWNDPARENT, p r3)"
  System::Call "*$3(i .r4, i .r5, i .r6, i .r7)"
  System::Free $3
  System::Call "user32::SetWindowPos(p $AdDlg, p 0, i 0, i 0, i r6, i r7, i ${AD_SWP_NOZORDER})"
!macroend

/** A flat rectangle of colour: the rules, plates and meter ticks. */
!macro AdRect x y w h colour
  ${AdPx} $R0 ${x}
  ${AdPx} $R1 ${y}
  ${AdPx} $R2 ${w}
  ${AdPx} $R3 ${h}
  nsDialogs::CreateControl STATIC ${AD_PLATE} 0 $R0 $R1 $R2 $R3 ""
  Pop $R4
  SetCtlColors $R4 ${colour} ${colour}
!macroend
!define AdRect "!insertmacro AdRect"

/** A line of type. Pops the control handle so callers can keep it. */
!macro AdText x y w h font ink back style text
  ${AdPx} $R0 ${x}
  ${AdPx} $R1 ${y}
  ${AdPx} $R2 ${w}
  ${AdPx} $R3 ${h}
  nsDialogs::CreateControl STATIC "${WS_VISIBLE}|${WS_CHILD}|${style}" 0 $R0 $R1 $R2 $R3 "${text}"
  Pop $R4
  SendMessage $R4 ${WM_SETFONT} ${font} 1
  SetCtlColors $R4 ${ink} ${back}
  Push $R4
!macroend
!define AdText "!insertmacro AdText"

/**
 * A drawn button. `id` is the native control it stands in for: 1 Next,
 * 2 Cancel, 3 Back. The click handler forwards WM_COMMAND to the parent, so
 * NSIS advances, goes back or aborts exactly as it would have.
 */
!macro AdButton var x y w h ink back onclick text
  ${AdPx} $R0 ${x}
  ${AdPx} $R1 ${y}
  ${AdPx} $R2 ${w}
  ${AdPx} $R3 ${h}
  nsDialogs::CreateControl STATIC ${AD_DRAWN} 0 $R0 $R1 $R2 $R3 "${text}"
  Pop ${var}
  SendMessage ${var} ${WM_SETFONT} $AdFontLabel 1
  SetCtlColors ${var} ${ink} ${back}
  ${NSD_OnClick} ${var} ${onclick}
!macroend
!define AdButton "!insertmacro AdButton"

/**
 * The secondary action: a 3px rule with paper inside, drawn as a plate with the
 * clickable face inset. Two controls rather than one because a static has no
 * border of its own.
 */
!macro AdButtonOutlined var x y w h ink onclick text
  ${AdRect} ${x} ${y} ${w} ${h} ${ink}
  ; The inset is arithmetic on mockup pixels, resolved here rather than passed
  ; along as an expression: AdPx hands its argument straight to IntOp, which
  ; takes a single operand and would choke on "470 + 3".
  !define /math AD_BI_X ${x} + 3
  !define /math AD_BI_Y ${y} + 3
  !define /math AD_BI_W ${w} - 6
  !define /math AD_BI_H ${h} - 6
  !insertmacro AdButton ${var} ${AD_BI_X} ${AD_BI_Y} ${AD_BI_W} ${AD_BI_H} \
    ${ink} ${AD_PAPER} ${onclick} "${text}"
  !undef AD_BI_X
  !undef AD_BI_Y
  !undef AD_BI_W
  !undef AD_BI_H
!macroend
!define AdButtonOutlined "!insertmacro AdButtonOutlined"

/**
 * The app's volume readout: discrete ticks rather than a smooth themed bar.
 * Used for the device meters on the welcome screen and for install progress, so
 * the installer measures things the way the app does.
 *
 * `lit` of `count` ticks take the ink colour; the rest take the ground.
 */
!macro AdMeter x y w h count lit ink
  ; The tick pitch is compile-time arithmetic, but the loop itself has to run at
  ; install time: NSIS has no repeat directive, so there is no way to unroll
  ; this while compiling. AdPx takes variables as happily as literals, which is
  ; what makes a runtime position work at all.
  !define /math AD_MT_STEP ${w} / ${count}
  !define /math AD_MT_TICK ${AD_MT_STEP} - 2
  StrCpy $R5 0
  ${Do}
    IntOp $R6 $R5 * ${AD_MT_STEP}
    IntOp $R6 $R6 + ${x}
    ${If} $R5 < ${lit}
      ${AdRect} $R6 ${y} ${AD_MT_TICK} ${h} ${ink}
    ${Else}
      ${AdRect} $R6 ${y} ${AD_MT_TICK} ${h} ${AD_DEAD}
    ${EndIf}
    IntOp $R5 $R5 + 1
  ${LoopUntil} $R5 >= ${count}
  !undef AD_MT_STEP
  !undef AD_MT_TICK
!macroend
!define AdMeter "!insertmacro AdMeter"

/**
 * The black spine: brand at the top, step list at the bottom. Identical on
 * every screen, which is what makes the flow read as one object being turned
 * rather than five dialogs in a row.
 *
 * `step` is 1 to 4; anything before it is done, anything after is still to come.
 */
!macro AdSpine step
  ${AdRect} 0 0 ${AD_SPINE_W} ${AD_H} ${AD_INK}
  ${AdRect} ${AD_SPINE_W} 0 ${AD_RULE} ${AD_H} ${AD_MARKER}

  ; The mark is drawn rather than shipped as a bitmap: three rectangles cost
  ; nothing and cannot be the wrong size on a scaled display.
  ${AdRect} 20 24 44 44 ${AD_PAPER}
  ${AdRect} 24 28 36 36 ${AD_INK}
  ${AdRect} 29 34 6 24 ${AD_MARKER}
  ${AdRect} 40 38 6 24 ${AD_PAPER}
  ${AdRect} 45 47 6 17 ${AD_MARKER}

  ; SS_CENTERIMAGE on a single line makes GDI centre it in the control and
  ; ignore the font's internal leading. Anton has a lot of it, so a plain
  ; top-aligned static drops the glyphs to the bottom of the box and clips them
  ; there however tall the box is made.
  ${AdText} 20 78 180 54 $AdFontWord ${AD_PAPER} ${AD_INK} ${SS_CENTERIMAGE} "AUDIO"
  Pop $0
  ${AdText} 20 126 180 54 $AdFontWord ${AD_MARKER} ${AD_INK} ${SS_CENTERIMAGE} "DECK"
  Pop $0

  !insertmacro AdStep 1 296 "01" "WELCOME" ${step}
  !insertmacro AdStep 2 330 "02" "FOLDER" ${step}
  !insertmacro AdStep 3 364 "03" "EFFECTS" ${step}
  !insertmacro AdStep 4 398 "04" "INSTALL" ${step}
!macroend

; The step index is a literal at every call site, so which of the three inks a
; row takes is decided by the preprocessor. ${If} would not do: it runs at
; install time, while !define resolves while compiling, so every row would end
; up whichever colour the last branch defined.
!macro AdStep index y numeral text current
  !if ${index} == ${current}
    !define /redef AD_STEP_INK ${AD_MARKER}
  !else if ${index} < ${current}
    !define /redef AD_STEP_INK ${AD_PAPER}
  !else
    !define /redef AD_STEP_INK ${AD_DIM}
  !endif
  ; numeral in the display face, label in the UI face, as the app sets them
  ${AdText} 20 ${y} 30 26 $AdFontStepN ${AD_STEP_INK} ${AD_INK} ${SS_CENTERIMAGE} "${numeral}"
  Pop $0
  ${AdText} 54 ${y} 150 26 $AdFontStep ${AD_STEP_INK} ${AD_INK} ${SS_CENTERIMAGE} "${text}"
  Pop $0
!macroend

/** The action strip: a heavy rule, then the buttons hard right. */
!macro AdStrip note
  ${AdRect} ${AD_SPINE_W} 438 502 ${AD_RULE} ${AD_INK}
  ${AdText} 246 462 260 40 $AdFontFine ${AD_DEADINK} ${AD_PAPER} ${SS_CENTERIMAGE} "${note}"
  Pop $0
!macroend

!endif ; AUDIODECK_KIT_INCLUDED
