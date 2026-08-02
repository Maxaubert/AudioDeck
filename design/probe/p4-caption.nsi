; PROBE 4 - can the window lose its Windows title bar and keep our own?
;
; The mockups draw a black caption strip like the app's frameless window. That
; needs WS_CAPTION stripped from $HWNDPARENT. Removing it is easy; the question
; is what it costs, because a window that cannot be moved or closed is worse
; than a plain one.
;
; Two things to judge from the capture:
;   1. does the window still render correctly with no caption and no border
;   2. is there anywhere left to close it from, other than our own drawn X
;
; Dragging is the part NSIS makes genuinely awkward: a static gives a click,
; not a button-down, so the usual ReleaseCapture + WM_NCLBUTTONDOWN trick has
; nowhere to hang without subclassing the dialog. This probe does not pretend
; to solve that; it establishes whether the look is even available before
; anyone spends a day on the drag.

Unicode true
Name "Probe4"
RequestExecutionLevel user
ManifestDPIAware true

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; GWL_STYLE comes from WinCore; the window styles do not, and NSIS silently
; treats an unknown ${...} as empty, so these need defining or the mask ends up
; zero and nothing is stripped.
!ifndef WS_CAPTION
  !define WS_CAPTION 0x00C00000
!endif
!ifndef WS_SYSMENU
  !define WS_SYSMENU 0x00080000
!endif
!define SWP_FRAMECHANGED 0x0020
!define SWP_NOMOVE 0x0002
!define SWP_NOSIZE 0x0001
!define SWP_NOZORDER 0x0004
!define FR_PRIVATE 0x10

Var Dlg
Var FontUi
Var FontDisplay

Page custom PageCaption
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\anton.ttf "${__FILEDIR__}\..\..\build\fonts\anton-400.ttf"
  File /oname=$PLUGINSDIR\archivo.ttf "${__FILEDIR__}\..\..\build\fonts\archivo-800.ttf"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\anton.ttf', i ${FR_PRIVATE}, p 0)"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\archivo.ttf', i ${FR_PRIVATE}, p 0)"
FunctionEnd

Function PageCaption
  CreateFont $FontDisplay "Anton" 22 400
  CreateFont $FontUi "Archivo" 9 800

  ; Take the title bar off the parent and tell it the frame changed, or it
  ; keeps painting the old non-client area until something forces a redraw.
  System::Call "user32::GetWindowLongW(p $HWNDPARENT, i ${GWL_STYLE}) i .r0"
  IntOp $1 ${WS_CAPTION} | ${WS_SYSMENU}
  IntOp $1 $1 ~
  IntOp $0 $0 & $1
  System::Call "user32::SetWindowLongW(p $HWNDPARENT, i ${GWL_STYLE}, i r0)"
  IntOp $2 ${SWP_FRAMECHANGED} | ${SWP_NOMOVE}
  IntOp $2 $2 | ${SWP_NOSIZE}
  IntOp $2 $2 | ${SWP_NOZORDER}
  System::Call "user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i 0, i 0, i r2)"

  nsDialogs::Create 1018
  Pop $Dlg
  ${If} $Dlg == error
    Abort
  ${EndIf}
  SetCtlColors $Dlg 000000 F2F0EA

  ; The page normally sits in a well between the MUI header and the button
  ; strip, so paper only covers the middle band and the parent's grey shows
  ; above and below. Stretching it over the parent's whole client area is what
  ; makes a full-bleed design possible at all, so it is proved here.
  System::Alloc 16
  Pop $3
  System::Call "user32::GetClientRect(p $HWNDPARENT, p r3)"
  System::Call "*$3(i .r4, i .r5, i .r6, i .r7)"
  System::Free $3
  System::Call "user32::SetWindowPos(p $Dlg, p 0, i 0, i 0, i r6, i r7, i ${SWP_NOZORDER})"

  ${NSD_CreateLabel} 0 0u 100% 14u "  AUDIODECK SETUP"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontUi 1
  SetCtlColors $0 9D9A8F 000000

  ${NSD_CreateLabel} 6u 24u 95% 22u "NO TITLE BAR"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontDisplay 1
  SetCtlColors $0 000000 F2F0EA

  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
