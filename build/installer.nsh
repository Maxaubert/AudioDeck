# AudioDeck's NSIS additions: offer to set up audio effects during our own
# wizard, so the user never opens a second installer.
#
# Three rules here, all deliberate:
#   - it is a checkbox, ticked by default. Most people want the device
#     switching; not all of them want a component registered in their system
#     audio path, and that should stay refusable.
#   - only this step elevates. AudioDeck installs per user and needs no
#     administrator; Equalizer APO does, so it goes through ShellExecute with
#     the runas verb and raises the prompt for that child alone.
#   - its failure is never AudioDeck's failure. A cancelled prompt or a failed
#     setup leaves AudioDeck installed and working, offering setup again from
#     the Studio tab.
#
# customPageAfterChangeDir is expanded where page declarations go, between
# MUI_PAGE_DIRECTORY and MUI_PAGE_INSTFILES, so it declares a page rather than
# containing dialog code. Putting the nsDialogs calls directly in the macro
# builds, but the callbacks are never referenced and makensis zeroes them out.

# This file is compiled into the uninstaller as well, where the MUI page
# machinery does not exist. Everything the installer needs is guarded; the
# uninstaller gets nothing from here.
!ifndef BUILD_UNINSTALLER

!include nsDialogs.nsh
!include LogicLib.nsh

Var EffectsCheckbox
Var EffectsWanted

Function AudioDeckEffectsPageCreate
  ; Already installed: nothing to offer, and asking would only invite a
  ; pointless reinstall.
  ReadRegStr $0 HKLM "SOFTWARE\EqualizerAPO" "InstallPath"
  ${If} $0 != ""
    StrCpy $EffectsWanted ${BST_UNCHECKED}
    Abort
  ${EndIf}

  ; No MUI_HEADER_TEXT here: electron-builder includes this file before the MUI
  ; headers exist, so the macro is undefined at parse time. The page's own text
  ; carries the explanation instead.
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 46u "AudioDeck can equalise each of your audio devices. The processing is done by Equalizer APO, a free open source component included with AudioDeck, so there is nothing to download.$\r$\n$\r$\nIt asks for administrator approval, and may need a restart to finish."
  Pop $0

  ${NSD_CreateCheckbox} 0 54u 100% 12u "Set up audio effects"
  Pop $EffectsCheckbox
  ${NSD_Check} $EffectsCheckbox

  ${NSD_CreateLabel} 0 72u 100% 24u "Equalizer APO by Jonas Thedering, licensed GPL-3. You can set this up later from AudioDeck's Studio tab instead."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function AudioDeckEffectsPageLeave
  ${NSD_GetState} $EffectsCheckbox $EffectsWanted
FunctionEnd

!macro customPageAfterChangeDir
  Page custom AudioDeckEffectsPageCreate AudioDeckEffectsPageLeave
!macroend

!macro customInstall
  ${If} $EffectsWanted == ${BST_CHECKED}
    DetailPrint "Setting up audio effects (Equalizer APO)..."
    ; runas raises the elevation prompt for this child only; AudioDeck itself
    ; stays unelevated. Errors are cleared rather than propagated: the user
    ; declining the prompt must not fail AudioDeck's installation.
    ClearErrors
    ExecShellWait "runas" "$INSTDIR\resources\vendor\equalizerapo-setup.exe" "" SW_SHOWNORMAL
    ${If} ${Errors}
      DetailPrint "Audio effects were not set up. You can do it later from the Studio tab."
      ClearErrors
    ${EndIf}
  ${EndIf}
!macroend

!endif
