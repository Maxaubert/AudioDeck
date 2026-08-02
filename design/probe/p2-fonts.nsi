; PROBE 2 - will the installer render Anton on a machine that does not have it?
;
; The app's faces ship as woff2, which GDI cannot read, so build/fonts holds
; TrueType copies pulled from the same Google Fonts source by
; scripts/fetch-fonts.mjs. They are extracted to $PLUGINSDIR at run time and
; registered privately to the process, which needs no administrator and leaves
; nothing behind.
;
; Neither Anton nor Archivo is installed on this machine, so if the wordmark
; renders condensed rather than in a fallback grotesque, the private load is
; what did it.
;
; Pass: line 1 is visibly Anton, line 2 is visibly Archivo, line 3 (the
; control, asking for a face nobody has) falls back and looks nothing like
; line 1.

Unicode true
Name "Probe2"
RequestExecutionLevel user

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define FR_PRIVATE 0x10

Var Dlg
Var FontDisplay
Var FontUi
Var Loaded

Page custom PageFonts
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\anton.ttf "${__FILEDIR__}\..\..\build\fonts\anton-400.ttf"
  File /oname=$PLUGINSDIR\archivo.ttf "${__FILEDIR__}\..\..\build\fonts\archivo-800.ttf"

  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\anton.ttf', i ${FR_PRIVATE}, p 0) i .r0"
  System::Call "gdi32::AddFontResourceExW(w '$PLUGINSDIR\archivo.ttf', i ${FR_PRIVATE}, p 0) i .r1"
  StrCpy $Loaded "AddFontResourceEx returned $0 and $1 (0 means it failed)"
FunctionEnd

; Private registrations die with the process, but unregistering is cheap and
; keeps the probe honest about what a real installer would do.
Function .onGUIEnd
  System::Call "gdi32::RemoveFontResourceExW(w '$PLUGINSDIR\anton.ttf', i ${FR_PRIVATE}, p 0)"
  System::Call "gdi32::RemoveFontResourceExW(w '$PLUGINSDIR\archivo.ttf', i ${FR_PRIVATE}, p 0)"
FunctionEnd

Function PageFonts
  CreateFont $FontDisplay "Anton" 30 400
  CreateFont $FontUi "Archivo" 11 800

  nsDialogs::Create 1018
  Pop $Dlg
  ${If} $Dlg == error
    Abort
  ${EndIf}
  SetCtlColors $Dlg 000000 F2F0EA

  ${NSD_CreateLabel} 6u 4u 95% 20u "AUDIODECK"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontDisplay 1
  SetCtlColors $0 000000 F2F0EA

  ${NSD_CreateLabel} 6u 26u 95% 12u "ARCHIVO 800 - THE UI FACE"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $FontUi 1
  SetCtlColors $0 000000 F2F0EA

  ; control: a family nobody has, so its fallback shows what failure looks like
  CreateFont $2 "Nonexistent Face XYZ" 30 400
  ${NSD_CreateLabel} 6u 44u 95% 20u "AUDIODECK"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $2 1
  SetCtlColors $0 B3000C F2F0EA

  ${NSD_CreateLabel} 6u 68u 95% 20u "$Loaded"
  Pop $0
  SetCtlColors $0 46463F F2F0EA

  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
