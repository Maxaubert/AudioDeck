; PROBE 6 - does the drawn checkbox read as checked?
;
; The first version was a plain amber square, which nobody read as a tick.
; NSIS has no unicode escape, and makensis reads an included file as the ANSI
; code page, so a pasted glyph arrives as mojibake. Marlett ships with every
; Windows and is the face the OS draws its own checkbox ticks from: the letter
; "a" is the check mark, which keeps this source pure ASCII.
;
; Pass: the left box shows a black tick on amber, the right one shows an empty
; white box, and they are obviously different at a glance.

Unicode true
Name "Probe6"
RequestExecutionLevel user
ManifestDPIAware true

!define AD_BUILD_DIR "${__FILEDIR__}\..\..\build"

!include "MUI2.nsh"
!include "${__FILEDIR__}\..\..\build\installer\kit.nsh"

Var BoxOn
Var BoxOff

Page custom PageCheck
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  !insertmacro AdLoadFonts
FunctionEnd

Function Nothing
  Pop $0
FunctionEnd

Function PageCheck
  !insertmacro AdSizeWindow
  !insertmacro AdBeginPage

  ${AdText} 40 40 600 46 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "CHECKBOX"
  Pop $0

  ${AdCheck} $BoxOn 40 120 Nothing
  ${AdText} 90 120 300 34 $AdFontLabel ${AD_INK} ${AD_PAPER} ${AD_S_MID} "TICKED"
  Pop $0

  ${AdCheck} $BoxOff 40 180 Nothing
  ; the unticked state as the pages set it: white stock, tick painted white so
  ; it disappears rather than being swapped out
  SetCtlColors $BoxOff ${AD_SHEET} ${AD_SHEET}
  ${AdText} 90 180 300 34 $AdFontLabel ${AD_INK} ${AD_PAPER} ${AD_S_MID} "NOT TICKED"
  Pop $0

  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
