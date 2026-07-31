namespace AudioCtl.Interop;

// IAudioEndpointVolume wrapper (IID 5CDF2C82-841E-4546-9722-0CF74078229A, obtained via
// IMMDevice.Activate). Vtable order per the reference notes (the standard layout), with
// IUnknown at absolute slots 0-2:
//  3 RegisterControlChangeNotify, 4 UnregisterControlChangeNotify, 5 GetChannelCount,
//  6 SetMasterVolumeLevel, 7 SetMasterVolumeLevelScalar, 8 GetMasterVolumeLevel,
//  9 GetMasterVolumeLevelScalar, 10 SetChannelVolumeLevel, 11 SetChannelVolumeLevelScalar,
// 12 GetChannelVolumeLevel, 13 GetChannelVolumeLevelScalar, 14 SetMute, 15 GetMute.
internal readonly unsafe struct AudioEndpointVolume : IDisposable
{
    private static readonly Guid Iid = new("5CDF2C82-841E-4546-9722-0CF74078229A");

    private readonly IntPtr _ptr;

    private AudioEndpointVolume(IntPtr ptr) => _ptr = ptr;

    public static AudioEndpointVolume From(Device device) => new(device.Activate(Iid));

    public static bool TryFrom(Device device, out AudioEndpointVolume volume)
    {
        bool ok = device.TryActivate(Iid, out IntPtr ptr);
        volume = new AudioEndpointVolume(ptr);
        return ok;
    }

    // Slot 7: SetMasterVolumeLevelScalar(float level, LPCGUID eventContext)
    public void SetMasterVolumeScalar(float level)
    {
        int hr = ((delegate* unmanaged<IntPtr, float, Guid*, int>)ComRuntime.Slot(_ptr, 7))(_ptr, level, null);
        ComRuntime.Check(hr, "IAudioEndpointVolume.SetMasterVolumeLevelScalar");
    }

    // Slot 9: GetMasterVolumeLevelScalar(out float level)
    public float GetMasterVolumeScalar()
    {
        float level;
        int hr = ((delegate* unmanaged<IntPtr, float*, int>)ComRuntime.Slot(_ptr, 9))(_ptr, &level);
        ComRuntime.Check(hr, "IAudioEndpointVolume.GetMasterVolumeLevelScalar");
        return level;
    }

    // Slot 14: SetMute(BOOL mute, LPCGUID eventContext)
    public void SetMute(bool mute)
    {
        int hr = ((delegate* unmanaged<IntPtr, int, Guid*, int>)ComRuntime.Slot(_ptr, 14))(_ptr, mute ? 1 : 0, null);
        ComRuntime.Check(hr, "IAudioEndpointVolume.SetMute");
    }

    // Slot 15: GetMute(out BOOL mute)
    public bool GetMute()
    {
        int mute;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 15))(_ptr, &mute);
        ComRuntime.Check(hr, "IAudioEndpointVolume.GetMute");
        return mute != 0;
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
