; PROBE 5 - the shared kit, on its own.
;
; build/installer/kit.nsh is the real file the installer ships; this only
; supplies the two things electron-builder would have provided (a build
; directory to read the fonts from, and a page to draw on) so the kit can be
; iterated in about a second instead of through a full npm run dist.
;
; Pass: a welcome screen indistinguishable from the first frame of
; design/shots/inst-a-sleeve.png.

Unicode true
Name "Probe5"
RequestExecutionLevel user
ManifestDPIAware true

!define AD_BUILD_DIR "${__FILEDIR__}\..\..\build"

!include "MUI2.nsh"
!include "${__FILEDIR__}\..\..\build\installer\kit.nsh"

Page custom PageWelcome
Page custom PageTwo
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  !insertmacro AdLoadFonts
FunctionEnd

Function PageWelcome
  !insertmacro AdSizeWindow
  !insertmacro AdBeginPage
  !insertmacro AdSpine 1

  ; GDI gives Anton about 1.15em of line box, so three lines at 40px need ~148,
  ; not the 110 the stylesheet gets with line-height 0.92. The box is sized to
  ; what the renderer actually needs rather than to what CSS could tighten to.
  ${AdText} 246 26 450 148 $AdFontH1 ${AD_INK} ${AD_PAPER} 0 "YOUR AUDIO$\r$\nDEVICES,$\r$\nRANKED."
  Pop $0
  ${AdText} 246 182 440 54 $AdFontBody ${AD_INK} ${AD_PAPER} 0 \
    "It picks the best one that is plugged in, and takes it back the moment it returns."
  Pop $0

  ; the ranked-list miniature, drawn from the app's own row parts
  ${AdRect} 246 244 440 134 ${AD_INK}
  ${AdRect} 249 247 434 128 ${AD_SHEET}

  ${AdRect} 253 251 426 40 ${AD_INK}
  ${AdText} 253 251 40 40 $AdFontNum ${AD_MARKER} ${AD_INK} "${SS_CENTER}|${SS_CENTERIMAGE}" "1"
  Pop $0
  ${AdText} 301 255 220 20 $AdFontLabel ${AD_MARKER} ${AD_INK} 0 "STEELSERIES"
  Pop $0
  ${AdText} 301 274 220 16 $AdFontFine ${AD_MARKER} ${AD_INK} 0 "ARCTIS NOVA PRO"
  Pop $0
  !insertmacro AdMeter 540 264 130 16 8 8 ${AD_MARKER}

  ${AdRect} 253 295 40 40 ${AD_INK}
  ${AdText} 253 295 40 40 $AdFontNum ${AD_PAPER} ${AD_INK} "${SS_CENTER}|${SS_CENTERIMAGE}" "2"
  Pop $0
  ${AdText} 301 299 230 20 $AdFontLabel ${AD_INK} ${AD_SHEET} 0 "LG"
  Pop $0
  ${AdText} 301 318 230 16 $AdFontFine ${AD_DEADINK} ${AD_SHEET} 0 "NVIDIA HIGH DEFINITION AUDIO"
  Pop $0
  !insertmacro AdMeter 540 308 130 16 8 8 ${AD_INK}

  ${AdRect} 253 339 426 32 ${AD_DEAD}
  ${AdRect} 253 339 40 32 ${AD_DIM}
  ${AdText} 253 339 40 32 $AdFontNum ${AD_PAPER} ${AD_DIM} "${SS_CENTER}|${SS_CENTERIMAGE}" "3"
  Pop $0
  ${AdText} 301 341 200 18 $AdFontLabel ${AD_DEADINK} ${AD_DEAD} 0 "META"
  Pop $0
  ${AdText} 301 356 200 14 $AdFontFine ${AD_DEADINK} ${AD_DEAD} 0 "QUEST"
  Pop $0
  ${AdText} 500 339 172 32 $AdFontFine ${AD_DEADINK} ${AD_DEAD} "${SS_RIGHT}|${SS_CENTERIMAGE}" "NOT PLUGGED IN"
  Pop $0

  !insertmacro AdStrip "0.1.0  .  NO ADMINISTRATOR"
  ${AdButtonOutlined} $AdBtnCancel 462 458 108 44 ${AD_DEADINK} OnCancel "CANCEL"
  ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} OnNext "INSTALL"

  nsDialogs::Show
FunctionEnd

Function OnNext
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function OnCancel
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
FunctionEnd

Function PageTwo
  !insertmacro AdBeginPage
  !insertmacro AdSpine 2
  ${AdText} 246 26 450 56 $AdFontH1 ${AD_INK} ${AD_PAPER} 0 "WHERE IT GOES"
  Pop $0
  !insertmacro AdStrip "0.1.0"
  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
