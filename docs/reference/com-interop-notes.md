# Windows Core Audio COM interop - proven definitions

These interop signatures were verified working on this machine (Windows 11, 2026-07-27) during
the session that produced the v1 design. audioctl MUST use these exact GUIDs and vtable layouts.

## IMMDeviceEnumerator / IMMDevice / IPropertyStore

- CLSID MMDeviceEnumerator: `BCDE0395-E52F-467C-8E3D-C4579291692E`
- IID IMMDeviceEnumerator: `A95664D2-9614-4F35-A746-DE8DB63617E6`
  - `EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection)` (dataFlow: 0=render, 1=capture; stateMask: 1=ACTIVE, 2=DISABLED, 4=NOTPRESENT, 8=UNPLUGGED, 0xF=ALL)
  - `GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice)`
- IID IMMDeviceCollection: `0BD7A1BE-7A1A-44DB-8397-CC5392387B5E` (`GetCount`, `Item`)
- IID IMMDevice: `D666063F-1587-4E43-81F1-B948E807363F`
  - `Activate(ref Guid iid, int clsCtx, IntPtr, out interface)` - clsCtx 1 (INPROC) works
  - `OpenPropertyStore(int access, out IPropertyStore)` - access 0 = STGM_READ
  - `GetId(out string id)` - IDs look like `{0.0.0.00000000}.{guid}`
- IID IPropertyStore: `886d8eeb-8cf2-4446-8d02-cdba1dbdcf99`
- PKEY_Device_FriendlyName: fmtid `a45c254e-df1c-4efd-8020-67d146a850e0`, pid 14
  (PROPVARIANT: vt at offset 0, pointer union at offset 8; friendly name is LPWSTR)

## IAudioEndpointVolume

- IID: `5CDF2C82-841E-4546-9722-0CF74078229A`, obtained via `IMMDevice.Activate`
- Vtable order: RegisterControlChangeNotify, UnregisterControlChangeNotify, GetChannelCount,
  SetMasterVolumeLevel, SetMasterVolumeLevelScalar, GetMasterVolumeLevel,
  GetMasterVolumeLevelScalar, ... (mute methods follow further down the standard vtable)

## IPolicyConfig (undocumented but stable; same API the Sound control panel uses)

- CLSID CPolicyConfigClient: `870af99c-171d-4f9e-af0d-e63df40c2bc9`
- IID IPolicyConfig: `f8679f50-850a-41cf-9c72-430f290290c8`
- Vtable: 10 placeholder methods precede the ones we use (GetMixFormat, GetDeviceFormat,
  ResetDeviceFormat, SetDeviceFormat, GetProcessingPeriod, SetProcessingPeriod, GetShareMode,
  SetShareMode, GetPropertyValue, SetPropertyValue), then:
  - 11th method (absolute vtable slot 13 counting IUnknown's 3): `SetDefaultEndpoint([MarshalAs(LPWStr)] string deviceId, int role)` - call for roles 0,1,2
  - 12th method (absolute slot 14): `SetEndpointVisibility([MarshalAs(LPWStr)] string deviceId, int visible)` - 0 disables, 1 enables. Returned S_OK and took effect immediately when tested.
  (An earlier revision of these notes labeled the methods "slot 11/12 (0-based)" while also
  listing SetDefaultEndpoint among the placeholders; that was 1-based counting. Re-proven live
  on 2026-07-27: set-default and visibility both work at absolute slots 13/14.)

Caution: `Disable-PnpDevice` on the SWD\MMDEVAPI endpoint device does NOT remove the endpoint
from the audio engine (verified: endpoint stayed ACTIVE). Endpoint enable/disable must go
through SetEndpointVisibility. The MMDevices registry keys are not writable even elevated.

## Global endpoint rename (proven live 2026-07-27)

`IMMDevice.OpenPropertyStore(STGM_READWRITE = 2)` succeeds WITHOUT elevation (audiosrv
mediates the write; direct registry writes to the same keys fail even elevated). Write
PKEY_Device_DeviceDesc (fmtid `a45c254e-df1c-4efd-8020-67d146a850e0`, pid 2) as VT_LPWSTR
(31) via IPropertyStore::SetValue (method 4 after GetCount/GetAt/GetValue, absolute slot 6)
then Commit (slot 7). Windows recomposes the picker name as "desc (interface)".
PKEY_Device_FriendlyName (pid 14) is WRITE-PROTECTED: SetValue returns E_ACCESSDENIED
(verified live 2026-07-27), so a suffix-free picker name is not achievable.

The SUFFIX SOURCE is writable though: `{b3f8fa53-0004-438e-9003-51a46e139bfc},6`
(the endpoint's interface name) accepts SetValue+Commit without elevation, and the
composed name follows as "desc (newsuffix)". Rules learned live: NEVER write it empty
(renders "desc ()") and NEVER delete it with VT_EMPTY (the composed name collapses to
"(unknown)"). DEVPKEY_DeviceInterface_FriendlyName `{026e516e-...},2` is denied.

The quick-settings flyout (ShellHost.exe) caches endpoint names for its process
lifetime; kill ShellHost after a rename (it respawns on demand) or the flyout keeps
showing the old name indefinitely.

## Endpoint identity: which adapter an endpoint belongs to (proven live 2026-07-31)

PKEY_AudioEndpoint_Association `{b3f8fa53-0004-438e-9003-51a46e139bfc},2` (VT_LPWSTR)
reads back the device interface path of the KS filter behind the endpoint, e.g.
`{1}.HDAUDIO\FUNC_01&VEN_10DE&DEV_00AA&SUBSYS_10DE0000&REV_1001\5&2A12AD2E&0&0001`.
It names the ADAPTER, not the jack or HDMI pin: 14 endpoints on this machine share the
one above, and six live ones share the Realtek USB adapter's. So it can rule two
endpoints out as the same device, never in on its own; the composed name separates
pins on one adapter.

Endpoint ids are NOT stable. When a driver re-enumerates (HDMI display after a reboot,
driver update, virtual audio service) the endpoint reappears under a fresh GUID and
Windows keeps the old GUID forever in the notpresent state, wearing the same name.
Worse for name-based matching: the recreated endpoint INHERITS the user's written
PKEY_Device_DeviceDesc, so it does not come back under the driver's original name.
Both registry keys under `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\
Audio\Render\{guid}\Properties` were observed holding `DeviceDesc = LG` at once.

## Device kind: form factor + icon (proven live 2026-07-27)

Both writable via the endpoint property store without elevation:
- PKEY_AudioEndpoint_FormFactor `{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},0` (VT_UI4=19):
  drives the glyph in the modern flyout/Settings. Values seen: 1 Speakers, 2 LineLevel,
  3 Headphones, 4 Microphone, 5 Headset, 8 SPDIF, 9 DigitalAudioDisplayDevice (HDMI),
  10 UnknownFormFactor.
- PKEY_DeviceClass_IconPath `{259abffc-50a7-47ce-af08-68c9a7d73366},12` (VT_LPWSTR):
  classic icon, format `%windir%\system32\mmres.dll,-3010`. Harvested pairs:
  speakers -3010, headphones -3011, line -3012, SPDIF -3013, mic -3014, headset -3015,
  HDMI/TV -3017, stereo mix -3018, alt speakers -3030, alt headphones -3031, AirPods -3051.
The flyout caches glyphs like names: bounce ShellHost after writing. PROPVARIANT for
VT_UI4 carries the value in the union at offset 8.
PROPVARIANT must be marshalled as 24 bytes on x64 (vt at 0, data union at 8); a 16-byte
struct crashes on the SetValue path.

## HeadsetControl

`vendor/headsetcontrol.exe -o json` (v4.0.0): `devices[].battery.status` is
`BATTERY_AVAILABLE` when the headset is on, `BATTERY_UNAVAILABLE` when off. Transition
latency observed: ~2-4 s with 2 s polling. Exit is fast; safe to call each poll tick.
Device seen in test: SteelSeries Arctis Nova Pro Wireless (0x1038:0x12e0).
