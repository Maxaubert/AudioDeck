; PROBE 3 - does DPI awareness buy crispness without costing layout?
;
; NSIS is DPI-unaware by default, so on this machine's 225% display Windows
; bitmap-scales the whole window and everything softens. ManifestDPIAware makes
; it render at native resolution, but then nothing scales automatically except
; what is expressed in dialog units, which grow with the dialog font.
;
; This is the same page as probe 2 with awareness turned on. Compare the two
; captures: if this one comes back much larger in pixels and the layout still
; holds, awareness is worth taking. If the text collides or spills, it is not.
;
; The bar under the labels is deliberately sized in pixels rather than dialog
; units, to show what does NOT scale.

Unicode true
Name "Probe3"
RequestExecutionLevel user
ManifestDPIAware true

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define FR_PRIVATE 0x10

Var Dlg
Var FontDisplay
Var FontUi

Page custom PageDpi
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\anton.ttf "${__FILEDIR__}\..\..\build\fonts\anton-400.ttf"
  File /oname=$PLUGINSDIR\archivo.ttf "${__FILEDIR__}\..\..\build\fonts\archivo-800.ttf"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\anton.ttf', i ${FR_PRIVATE}, p 0) i .r0"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\archivo.ttf', i ${FR_PRIVATE}, p 0) i .r1"
FunctionEnd

Function PageDpi
  CreateFont $FontDisplay "Anton" 30 400
  CreateFont $FontUi "Archivo" 11 800

  nsDialogs::Create 1018
  Pop $Dlg
  ${If} $Dlg == error
    Abort
  ${EndIf}
  SetCtlColors $Dlg 000000 F2F0EA

  ${NSD_CreateLabel} 6u 4u 95% 26u "AUDIODECK"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontDisplay 1
  SetCtlColors $0 000000 F2F0EA

  ${NSD_CreateLabel} 6u 32u 95% 14u "ARCHIVO 800 - BODY AT THE SHIPPING SIZE"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontUi 1
  SetCtlColors $0 000000 F2F0EA

  ; sized in dialog units: should track the font
  ${NSD_CreateLabel} 6u 50u 60u 4u ""
  Pop $0
  SetCtlColors $0 000000 000000

  ; sized in raw pixels: should NOT track the font, and that is the point
  ${NSD_CreateLabel} 6 100 120 8 ""
  Pop $0
  SetCtlColors $0 FFB454 FFB454

  ${NSD_CreateLabel} 6u 62u 95% 12u "Black bar is dialog units, amber bar is pixels"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontUi 1
  SetCtlColors $0 46463F F2F0EA

  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
