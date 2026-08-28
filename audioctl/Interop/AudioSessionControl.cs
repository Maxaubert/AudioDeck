namespace AudioCtl.Interop;

// IAudioSessionControl wrapper (IID F4B1A599-7266-4319-A8CA-E70ACB11E8CD) plus QI
// accessors for IAudioSessionControl2 and ISimpleAudioVolume, which the session
// commands always use together. IAudioSessionControl slots 3-11; control2 continues
// at 12.
internal readonly unsafe struct AudioSessionControl : IDisposable
{
    private static readonly Guid IidControl2 = new("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D");
    private static readonly Guid IidSimpleVolume = new("87CE5498-68D6-44E5-9215-6DA47EF883D8");

    public const int StateInactive = 0;
    public const int StateActive = 1;
    public const int StateExpired = 2;

    private readonly IntPtr _ptr;

    public AudioSessionControl(IntPtr ptr) => _ptr = ptr;

    // Slot 3: GetState(out AudioSessionState)
    public int GetState()
    {
        int state;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, &state);
        ComRuntime.Check(hr, "IAudioSessionControl.GetState");
        return state;
    }

    // Slot 4: GetDisplayName(out LPWSTR). Usually empty; apps rarely set it.
    public string GetDisplayName()
    {
        IntPtr raw;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, &raw);
        ComRuntime.Check(hr, "IAudioSessionControl.GetDisplayName");
        return ComRuntime.ReadTaskMemString(raw);
    }

    public bool TryGetControl2(out AudioSessionControl2 control2)
    {
        bool ok = ComRuntime.TryQuery(_ptr, IidControl2, out IntPtr ptr);
        control2 = new AudioSessionControl2(ptr);
        return ok;
    }

    public bool TryGetSimpleVolume(out SimpleAudioVolume volume)
    {
        bool ok = ComRuntime.TryQuery(_ptr, IidSimpleVolume, out IntPtr ptr);
        volume = new SimpleAudioVolume(ptr);
        return ok;
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}

// IAudioSessionControl2 view over its own QI'd pointer. Slots: 12
// GetSessionIdentifier, 13 GetSessionInstanceIdentifier, 14 GetProcessId,
// 15 IsSystemSoundsSession, 16 SetDuckingPreference.
internal readonly unsafe struct AudioSessionControl2 : IDisposable
{
    private readonly IntPtr _ptr;

    public AudioSessionControl2(IntPtr ptr) => _ptr = ptr;

    // Slot 13: GetSessionInstanceIdentifier(out LPWSTR) - unique per live session,
    // the handle set commands match on.
    public string GetSessionInstanceIdentifier()
    {
        IntPtr raw;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 13))(_ptr, &raw);
        ComRuntime.Check(hr, "IAudioSessionControl2.GetSessionInstanceIdentifier");
        return ComRuntime.ReadTaskMemString(raw);
    }

    // Slot 14: GetProcessId(out uint). AUDCLNT_S_NO_SINGLE_PROCESS is a success
    // code (cross-process session); the pid is still the best available answer.
    public uint GetProcessId()
    {
        uint pid;
        int hr = ((delegate* unmanaged<IntPtr, uint*, int>)ComRuntime.Slot(_ptr, 14))(_ptr, &pid);
        ComRuntime.Check(hr, "IAudioSessionControl2.GetProcessId");
        return pid;
    }

    // Slot 15: IsSystemSoundsSession() - S_OK (0) yes, S_FALSE (1) no.
    public bool IsSystemSoundsSession()
        => ((delegate* unmanaged<IntPtr, int>)ComRuntime.Slot(_ptr, 15))(_ptr) == 0;

    public void Dispose() => ComRuntime.Release(_ptr);
}
