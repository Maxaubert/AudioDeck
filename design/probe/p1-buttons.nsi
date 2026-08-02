; PROBE 1 - can a drawn control drive the page flow?
;
; SetCtlColors will not paint a themed button face, so the plan is to hide the
; native Back/Next/Cancel strip and draw our own controls, forwarding
; WM_COMMAND to $HWNDPARENT with the native IDs (1 Next, 2 Cancel, 3 Back).
; Everything in stages 3 to 5 rests on that working, so it is proved first.
;
; A STATIC with SS_NOTIFY is the drawn control: unlike a BUTTON, a static
; honours WM_CTLCOLORSTATIC, so SetCtlColors paints it.
;
; Pass: clicking the amber "Install" reaches page two.

; OutFile is supplied by probe.mjs via /X, so it must not be set here: script
; lines run after /X commands and would override it.
Unicode true
Name "Probe1"
RequestExecutionLevel user

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; WinCore, pulled in by nsDialogs, already defines the SS_* styles.
!ifndef SS_NOTIFY
  !define SS_NOTIFY 0x00000100
!endif
!ifndef SS_CENTER
  !define SS_CENTER 0x00000001
!endif
!ifndef SS_CENTERIMAGE
  !define SS_CENTERIMAGE 0x00000200
!endif
!define DRAWN "${WS_VISIBLE}|${WS_CHILD}|${SS_NOTIFY}|${SS_CENTER}|${SS_CENTERIMAGE}"

Var Dlg
Var BtnNext
Var BtnCancel
Var Say

Page custom PageOne
Page custom PageTwo
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; Take the MUI furniture off the parent: header statics, branding, separator,
; and the three native buttons we are replacing.
!macro StripChrome
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

Function PageOne
  nsDialogs::Create 1018
  Pop $Dlg
  ${If} $Dlg == error
    Abort
  ${EndIf}
  SetCtlColors $Dlg 000000 F2F0EA
  !insertmacro StripChrome

  ; This label is the instrument: if the click reaches the static it changes,
  ; which separates "the control never fired" from "the forwarded command was
  ; ignored".
  ${NSD_CreateLabel} 8u 8u 90% 24u "PAGE ONE - click the amber control"
  Pop $Say
  SetCtlColors $Say 000000 F2F0EA

  ; the drawn Next: amber plate, black ink
  nsDialogs::CreateControl STATIC ${DRAWN} 0 150u 120u 60u 20u "Install"
  Pop $BtnNext
  SetCtlColors $BtnNext 6B3C00 FFB454
  ${NSD_OnClick} $BtnNext OnNext

  ; the drawn Cancel: black plate, paper ink
  nsDialogs::CreateControl STATIC ${DRAWN} 0 80u 120u 60u 20u "Cancel"
  Pop $BtnCancel
  SetCtlColors $BtnCancel F2F0EA 000000
  ${NSD_OnClick} $BtnCancel OnCancel

  nsDialogs::Show
FunctionEnd

Function OnNext
  Pop $0
  ${NSD_SetText} $Say "CLICK REACHED THE STATIC - now forwarding id 1"
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function OnCancel
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
FunctionEnd

Function PageTwo
  nsDialogs::Create 1018
  Pop $Dlg
  ${If} $Dlg == error
    Abort
  ${EndIf}
  SetCtlColors $Dlg 000000 FFB454
  !insertmacro StripChrome

  ${NSD_CreateLabel} 8u 40u 90% 40u "PAGE TWO - the drawn control drove the flow"
  Pop $0
  SetCtlColors $0 000000 FFB454

  nsDialogs::Show
FunctionEnd

Section "install"
  DetailPrint "probe"
SectionEnd
