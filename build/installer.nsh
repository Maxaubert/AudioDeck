# AudioDeck's NSIS additions.
#
# electron-builder includes this file in the common script header, before
# installer.nsi pulls in MUI2 and the page macros. That ordering is why MUI
# macros cannot be used here, and equally why the MUI_* defines set below are
# still in place when the page macros later read them.
#
# The design, and the measurements it rests on, are in:
#   docs/specs/2026-08-02-installer-design.md
#   docs/reference/nsis-findings.md
#
# The short version: SetCtlColors will not paint a themed button face, so the
# native Back/Next/Cancel strip cannot be restyled. It is hidden and replaced
# with drawn statics that forward WM_COMMAND to the parent with the native ids,
# which leaves NSIS running its own page machinery underneath.
#
# This file is compiled into the uninstaller as well, where the MUI page
# machinery does not exist, so everything installer-only is guarded.

!ifndef BUILD_UNINSTALLER

# electron-builder does not set this, so its installer renders DPI-unaware and
# Windows bitmap-scales the whole window. Measured on a 225% display: 1132x878
# at 96 dpi scaled up, against 1082x862 rendered natively at 216. Same apparent
# size, far better rendering. The kit reads the window's DPI and scales every
# coordinate itself, which is what makes turning this on safe.
ManifestDPIAware true

!define AD_BUILD_DIR "${BUILD_RESOURCES_DIR}"
!include "installer\kit.nsh"
!include "installer\pages.nsh"

# AudioDeck installs per user and needs no administrator, so the install-mode
# chooser is a question with one sensible answer. Forcing it here makes
# electron-builder's own page abort before it draws.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

# Inserted before the licence and install-mode pages, which is where the flow
# starts. The folder page rides along here because electron-builder's
# MUI_PAGE_DIRECTORY cannot be restyled this far and is switched off in
# electron-builder.yml.
!macro customWelcomePage
  Page custom AudioDeckWelcomeCreate
  Page custom AudioDeckFolderCreate AudioDeckFolderLeave
!macroend

!macro customPageAfterChangeDir
  Page custom AudioDeckEffectsCreate

  # The progress page belongs to MUI, so it is restyled on show rather than
  # rebuilt. The define has to land immediately before MUI_PAGE_INSTFILES is
  # inserted, and this macro is expanded exactly there. Setting it at file scope
  # instead does not survive: the install-mode page inserts MUI_PAGE_INIT first,
  # which clears the page hooks, and the progress screen came out bare grey with
  # a stray native Back button on it.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AudioDeckInstallShow
!macroend

!macro customFinishPage
  Page custom AudioDeckFinishCreate AudioDeckFinishLeave
!macroend

!macro customInit
  !insertmacro AdLoadFonts
!macroend

!macro customInstall
  ${If} $AdEffectsWanted == 1
    DetailPrint "Setting up audio effects (Equalizer APO)..."
    # runas raises the elevation prompt for this child only; AudioDeck itself
    # stays unelevated. Errors are cleared rather than propagated: the user
    # declining the prompt must not fail AudioDeck's installation.
    ClearErrors
    ExecShellWait "runas" "$INSTDIR\resources\vendor\equalizerapo-setup.exe" "" SW_SHOWNORMAL
    ${If} ${Errors}
      DetailPrint "Audio effects were not set up. You can do it later from the Studio tab."
      ClearErrors
    ${EndIf}
  ${EndIf}
!macroend

!else

# The uninstaller gets the same stock. It has no fonts loaded and no kit, and
# giving it one would mean compiling the whole thing twice for two screens, so
# it keeps MUI's own pages. Recorded here so the omission is a decision rather
# than an oversight.

!endif
