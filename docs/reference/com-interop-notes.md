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
(verified live 2026-07-27), so an exact suffix-free name in the Windows picker is not
achievable; strip the "(interface)" part client-side for clean display instead.
PROPVARIANT must be marshalled as 24 bytes on x64 (vt at 0, data union at 8); a 16-byte
struct crashes on the SetValue path.

## HeadsetControl

`vendor/headsetcontrol.exe -o json` (v4.0.0): `devices[].battery.status` is
`BATTERY_AVAILABLE` when the headset is on, `BATTERY_UNAVAILABLE` when off. Transition
latency observed: ~2-4 s with 2 s polling. Exit is fast; safe to call each poll tick.
Device seen in test: SteelSeries Arctis Nova Pro Wireless (0x1038:0x12e0).
