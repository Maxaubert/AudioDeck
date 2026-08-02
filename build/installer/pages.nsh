; AudioDeck installer: the pages.
;
; Drawn with the kit next door; every position here is a mockup pixel from
; design/mockups/inst-a-sleeve.html, so the two can be read side by side.
;
; The flow is welcome, folder, effects, installing, ready. The install-mode
; chooser electron-builder would otherwise show is dropped in installer.nsh:
; AudioDeck installs per user and needs no administrator, so asking is noise.

!ifndef AUDIODECK_PAGES_INCLUDED
!define AUDIODECK_PAGES_INCLUDED

!include "FileFunc.nsh"
; electron-builder only includes this alongside its own directory page, which
; this file replaces, so ${StrContains} has to be pulled in here or the folder
; page's sanitising will not compile.
!include "StrContains.nsh"

!ifndef ES_AUTOHSCROLL
  !define ES_AUTOHSCROLL 0x00000080
!endif
!ifndef ES_READONLY
  !define ES_READONLY 0x00000800
!endif
!ifndef PBM_SETRANGE32
  !define PBM_SETRANGE32 0x0406
!endif
!ifndef PBM_SETBARCOLOR
  !define PBM_SETBARCOLOR 0x0409
!endif
!ifndef PBM_SETBKCOLOR
  !define PBM_SETBKCOLOR 0x2001
!endif

Var AdDirEdit
Var AdEffectsWanted
Var AdEffectsBox
Var AdRunWanted
Var AdRunBox

; ---------------------------------------------------------------- welcome

Function AudioDeckWelcomeCreate
  !insertmacro AdSizeWindow
  !insertmacro AdBeginPage
  !insertmacro AdSpine 1

  ; One static per line. Anton's line box in GDI is close to 1.8em, so a
  ; three-line static loses the last line however tall the control is made.
  ; Stacking single lines also restores the design's tight leading.
  ${AdText} 246 24 450 46 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "YOUR AUDIO"
  Pop $0
  ${AdText} 246 66 450 46 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "DEVICES,"
  Pop $0
  ${AdText} 246 108 450 46 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "RANKED."
  Pop $0
  ${AdText} 246 166 440 54 $AdFontBody ${AD_INK} ${AD_PAPER} ${AD_S_TOP} \
    "It picks the best one that is plugged in, and takes it back the moment it returns."
  Pop $0

  ; The ranked list in miniature, built from the app's own row parts. An
  ; installer for a ranking tool may as well show one rather than describe it.
  ${AdRect} 246 244 440 134 ${AD_INK}
  ${AdRect} 249 247 434 128 ${AD_SHEET}

  ${AdRect} 253 251 426 40 ${AD_INK}
  ${AdText} 253 251 40 40 $AdFontNum ${AD_MARKER} ${AD_INK} ${AD_S_CENTER} "1"
  Pop $0
  ${AdText} 301 255 220 20 $AdFontLabel ${AD_MARKER} ${AD_INK} ${AD_S_TOP} "STEELSERIES"
  Pop $0
  ${AdText} 301 274 220 16 $AdFontFine ${AD_MARKER} ${AD_INK} ${AD_S_TOP} "ARCTIS NOVA PRO"
  Pop $0
  ${AdMeter} 540 264 130 16 8 8 ${AD_MARKER}

  ${AdRect} 253 295 40 40 ${AD_INK}
  ${AdText} 253 295 40 40 $AdFontNum ${AD_PAPER} ${AD_INK} ${AD_S_CENTER} "2"
  Pop $0
  ${AdText} 301 299 230 20 $AdFontLabel ${AD_INK} ${AD_SHEET} ${AD_S_TOP} "LG"
  Pop $0
  ${AdText} 301 318 230 16 $AdFontFine ${AD_DEADINK} ${AD_SHEET} ${AD_S_TOP} "NVIDIA HIGH DEFINITION"
  Pop $0
  ${AdMeter} 540 308 130 16 8 8 ${AD_INK}

  ${AdRect} 253 339 426 32 ${AD_DEAD}
  ${AdRect} 253 339 40 32 ${AD_DIM}
  ${AdText} 253 339 40 32 $AdFontNum ${AD_PAPER} ${AD_DIM} ${AD_S_CENTER} "3"
  Pop $0
  ${AdText} 301 341 200 18 $AdFontLabel ${AD_DEADINK} ${AD_DEAD} ${AD_S_TOP} "META"
  Pop $0
  ${AdText} 301 356 200 14 $AdFontFine ${AD_DEADINK} ${AD_DEAD} ${AD_S_TOP} "QUEST"
  Pop $0
  ${AdText} 500 339 172 32 $AdFontFine ${AD_DEADINK} ${AD_DEAD} \
    ${AD_S_RIGHT} "NOT PLUGGED IN"
  Pop $0

  !insertmacro AdStrip "${VERSION}  .  NO ADMINISTRATOR"
  ${AdButtonOutlined} $AdBtnCancel 462 458 108 44 ${AD_DEADINK} AdOnCancel "CANCEL"
  ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} AdOnNext "CONTINUE"

  nsDialogs::Show
FunctionEnd

; ---------------------------------------------------------------- folder

Function AudioDeckFolderCreate
  !insertmacro AdBeginPage
  !insertmacro AdSpine 2

  ${AdText} 246 26 450 56 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "WHERE IT GOES"
  Pop $0
  ${AdText} 246 92 440 54 $AdFontBody ${AD_INK} ${AD_PAPER} ${AD_S_TOP} \
    "It installs under your own account, so nothing here needs an administrator."
  Pop $0

  ; An EDIT honours WM_CTLCOLOREDIT, unlike a button, so the field can be
  ; painted. The rule around it is a plate behind, since an edit has no border
  ; of its own worth keeping.
  ${AdRect} 246 158 440 46 ${AD_INK}
  ; A single-line EDIT paints its text at the top of its client area rather
  ; than centring it, so a 40px-tall field looks misaligned however the plate
  ; around it is placed. The field is sized to the type and centred in the
  ; plate instead.
  ${AdPx} $1 252
  ${AdPx} $2 169
  ${AdPx} $3 314
  ${AdPx} $4 24
  nsDialogs::CreateControl EDIT \
    "${WS_VISIBLE}|${WS_CHILD}|${WS_TABSTOP}|${ES_AUTOHSCROLL}|${ES_READONLY}" \
    0 $1 $2 $3 $4 "$INSTDIR"
  Pop $AdDirEdit
  SendMessage $AdDirEdit ${WM_SETFONT} $AdFontBody 1
  SetCtlColors $AdDirEdit ${AD_INK} ${AD_SHEET}

  ${AdButton} $0 572 158 114 46 ${AD_PAPER} ${AD_INK} AdOnBrowse "BROWSE"

  ${AdText} 246 220 200 30 $AdFontFine ${AD_DEADINK} ${AD_PAPER} ${AD_S_MID} \
    "184 MB NEEDED"
  Pop $0

  !insertmacro AdStrip "${VERSION}"
  ${AdButtonOutlined} $AdBtnBack 462 458 108 44 ${AD_DEADINK} AdOnBack "BACK"

  ; The effects page skips itself when Equalizer APO is already installed, which
  ; makes this the last screen before anything is written. Promising CONTINUE
  ; and then installing would be a lie, so the label is decided by the same
  ; registry key the effects page checks.
  ReadRegStr $0 HKLM "SOFTWARE\EqualizerAPO" "InstallPath"
  ${If} $0 == ""
    ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} AdOnNext "CONTINUE"
  ${Else}
    ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} AdOnNext "INSTALL"
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function AdOnBrowse
  Pop $0
  nsDialogs::SelectFolderDialog "Where should AudioDeck go?" "$INSTDIR"
  Pop $1
  ${If} $1 != error
    StrCpy $INSTDIR $1
    ${NSD_SetText} $AdDirEdit "$INSTDIR"
  ${EndIf}
FunctionEnd

/**
 * Keep the app's own folder on the end of whatever was chosen, so picking
 * "Documents" does not scatter the app across it. This is the same sanitising
 * electron-builder's own directory page does in instFilesPre, kept because
 * that page is replaced rather than restyled.
 */
Function AudioDeckFolderLeave
  ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
  ${If} $0 == ""
    StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------- effects

/**
 * Offer to set up Equalizer APO from inside our own wizard, so the user never
 * opens a second installer. Three rules, all deliberate and all unchanged from
 * the first version of this page:
 *
 *   - it is a checkbox, ticked by default. Most people want the device
 *     switching; not all of them want a component registered in their system
 *     audio path, and that must stay refusable.
 *   - only this step elevates. AudioDeck installs per user; Equalizer APO does
 *     not, so it goes through ShellExecute with the runas verb and raises the
 *     prompt for that child alone.
 *   - its failure is never AudioDeck's failure.
 */
Function AudioDeckEffectsCreate
  ; Already installed: nothing to offer, and asking would invite a pointless
  ; reinstall.
  ReadRegStr $0 HKLM "SOFTWARE\EqualizerAPO" "InstallPath"
  ${If} $0 != ""
    StrCpy $AdEffectsWanted 0
    Abort
  ${EndIf}

  !insertmacro AdBeginPage
  !insertmacro AdSpine 3

  ${AdText} 246 26 450 56 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "AUDIO EFFECTS"
  Pop $0
  ${AdText} 246 92 440 80 $AdFontBody ${AD_INK} ${AD_PAPER} ${AD_S_TOP} \
    "AudioDeck can equalise each device separately. The processing is done by \
Equalizer APO, bundled here, so there is nothing to download."

  Pop $0

  StrCpy $AdEffectsWanted 1
  ${AdCheck} $AdEffectsBox 246 186 AdOnToggleEffects
  ${AdText} 294 186 390 34 $AdFontLabel ${AD_INK} ${AD_PAPER} ${AD_S_MID} \
    "SET UP AUDIO EFFECTS"
  Pop $0
  ${AdText} 294 224 390 26 $AdFontFine ${AD_DEADINK} ${AD_PAPER} ${AD_S_MID} \
    "ASKS FOR ADMINISTRATOR ONCE  .  MAY NEED A RESTART"
  Pop $0

  !insertmacro AdStrip "GPL-3  .  JONAS THEDERING"
  ${AdButtonOutlined} $AdBtnBack 462 458 108 44 ${AD_DEADINK} AdOnBack "BACK"
  ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} AdOnNext "INSTALL"

  nsDialogs::Show
FunctionEnd

/**
 * A drawn checkbox. SetCtlColors can be re-run on a live handle, so ticking is
 * a repaint rather than a rebuild; the control has to be invalidated by hand
 * afterwards or the old colours stay on screen.
 */
Function AdOnToggleEffects
  Pop $0
  ${If} $AdEffectsWanted == 1
    StrCpy $AdEffectsWanted 0
    SetCtlColors $AdEffectsBox ${AD_SHEET} ${AD_SHEET}
  ${Else}
    StrCpy $AdEffectsWanted 1
    SetCtlColors $AdEffectsBox ${AD_MARKER} ${AD_MARKER}
  ${EndIf}
  System::Call "user32::InvalidateRect(p $AdEffectsBox, p 0, i 1)"
FunctionEnd

; ---------------------------------------------------------------- installing

/**
 * The progress page. MUI owns this one, so it is restyled on show rather than
 * created from scratch: the log listbox goes, the native progress bar is
 * de-themed and recoloured, and the rest of the page is drawn over the top.
 *
 * The tick meter the mockup shows is not used here. NSIS drives a real
 * PBM progress bar and there is no hook to repaint it tick by tick, so the
 * honest choice is the native bar in the design's colours rather than a
 * decorative meter that does not track the install.
 */
Function AudioDeckInstallShow
  ; AdStripChrome uses $0 and $1, so the dialog handle is fetched after it, not
  ; before. Doing it the other way round left every call below working on a
  ; clobbered handle and painted the whole page black.
  !insertmacro AdStripChrome
  FindWindow $R0 "#32770" "" $HWNDPARENT
  SetCtlColors $R0 ${AD_INK} ${AD_PAPER}

  ; This page is MUI's, not ours: there is no nsDialogs::Create behind it, so
  ; nothing here may call nsDialogs::CreateControl. That rules out the spine and
  ; the headline, and leaves repainting what MUI already put on the page. The
  ; result is honest rather than complete, and is the one screen in the flow
  ; that still differs from the mockup.
  System::Alloc 16
  Pop $R3
  System::Call "user32::GetClientRect(p $HWNDPARENT, p R3)"
  System::Call "*$R3(i .r4, i .r5, i .r6, i .r7)"
  System::Free $R3
  System::Call "user32::SetWindowPos(p $R0, p 0, i 0, i 0, i r6, i r7, i ${AD_SWP_NOZORDER})"

  ; the log listbox, painted as stock rather than hidden: it is the only thing
  ; on this page telling the user what is happening
  GetDlgItem $R1 $R0 1016
  SetCtlColors $R1 ${AD_DEADINK} ${AD_PAPER}
  ${AdPx} $4 40
  ${AdPx} $5 300
  ${AdPx} $6 640
  ${AdPx} $7 160
  System::Call "user32::SetWindowPos(p $R1, p 0, i r4, i r5, i r6, i r7, i ${AD_SWP_NOZORDER})"

  ; the progress bar, de-themed so the colours take
  GetDlgItem $R2 $R0 1004
  System::Call "uxtheme::SetWindowTheme(p $R2, w ' ', w ' ')"
  SendMessage $R2 ${PBM_SETBARCOLOR} 0 0x54B4FF   ; BGR of the amber marker
  SendMessage $R2 ${PBM_SETBKCOLOR} 0 0xD8E0E3    ; BGR of the dead stock
  ${AdPx} $4 246
  ${AdPx} $5 250
  ${AdPx} $6 440
  ${AdPx} $7 30
  System::Call "user32::SetWindowPos(p $R2, p 0, i r4, i r5, i r6, i r7, i ${AD_SWP_NOZORDER})"

  ; The rest of the page can be drawn now that the kit builds controls with
  ; CreateWindowExW: it no longer needs an nsDialogs dialog behind it, which is
  ; what previously left this screen as bare stock and one bar.
  StrCpy $AdDlg $R0
  !insertmacro AdSpine 4
  ${AdText} 246 26 450 56 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "INSTALLING"
  Pop $0
  ${AdText} 246 92 440 54 $AdFontBody ${AD_INK} ${AD_PAPER} ${AD_S_TOP}     "Copying AudioDeck and its helpers into place."
  Pop $0
  !insertmacro AdStrip "DO NOT CLOSE THIS WINDOW"
FunctionEnd

; ---------------------------------------------------------------- ready

Function AudioDeckFinishCreate
  !insertmacro AdBeginPage
  !insertmacro AdSpine 4

  ${AdText} 246 26 450 56 $AdFontH1 ${AD_INK} ${AD_PAPER} ${AD_S_MID} "READY."
  Pop $0
  ${AdText} 246 92 440 80 $AdFontBody ${AD_INK} ${AD_PAPER} ${AD_S_TOP} \
    "AudioDeck sits in the tray, next to the clock. Windows hides new tray icons \
at first, so click the arrow there and drag it out."
  Pop $0

  ; a scrap of taskbar, because the tray is exactly where people fail to look
  ${AdRect} 246 196 440 48 ${AD_INK}
  ${AdRect} 258 206 28 28 ${AD_MARKER}
  ${AdRect} 262 210 6 20 ${AD_INK}
  ${AdRect} 272 214 6 16 ${AD_INK}
  ${AdText} 300 196 200 48 $AdFontLabel ${AD_MARKER} ${AD_INK} ${AD_S_MID} "LOOK HERE"
  Pop $0
  ${AdText} 560 196 114 48 $AdFontFine ${AD_CAPTXT} ${AD_INK} \
    ${AD_S_RIGHT} "03:46"
  Pop $0

  StrCpy $AdRunWanted 1
  ${AdCheck} $AdRunBox 246 268 AdOnToggleRun
  ${AdText} 294 268 390 34 $AdFontLabel ${AD_INK} ${AD_PAPER} ${AD_S_MID} \
    "OPEN AUDIODECK NOW"
  Pop $0

  !insertmacro AdStrip "${VERSION}"
  ${AdButton} $AdBtnNext 582 458 110 44 ${AD_ONMARKER} ${AD_MARKER} AdOnNext "FINISH"

  nsDialogs::Show
FunctionEnd

Function AdOnToggleRun
  Pop $0
  ${If} $AdRunWanted == 1
    StrCpy $AdRunWanted 0
    SetCtlColors $AdRunBox ${AD_SHEET} ${AD_SHEET}
  ${Else}
    StrCpy $AdRunWanted 1
    SetCtlColors $AdRunBox ${AD_MARKER} ${AD_MARKER}
  ${EndIf}
  System::Call "user32::InvalidateRect(p $AdRunBox, p 0, i 1)"
FunctionEnd

Function AudioDeckFinishLeave
  ${If} $AdRunWanted == 1
    ; Neither $launchLink nor StdUtils is usable from here. Both belong to
    ; electron-builder's own script, which is parsed after this file: the
    ; variable is unknown (and warningsAsErrors makes that fatal), and the
    ; StdUtils plugin directory is not registered yet.
    ;
    ; Exec is the right call regardless. StdUtils.ExecShellAsUser exists to drop
    ; privileges when an elevated installer launches an app; AudioDeck installs
    ; per user and this installer never elevates, so there is nothing to drop.
    Exec '"$INSTDIR\${PRODUCT_FILENAME}.exe"'
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------- shared

Function AdOnNext
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function AdOnBack
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 3 0
FunctionEnd

Function AdOnCancel
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
FunctionEnd

!endif ; AUDIODECK_PAGES_INCLUDED
