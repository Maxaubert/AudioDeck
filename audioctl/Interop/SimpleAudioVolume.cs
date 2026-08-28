namespace AudioCtl.Interop;

// ISimpleAudioVolume wrapper (IID 87CE5498-68D6-44E5-9215-6DA47EF883D8): the
// per-session volume the Windows volume mixer itself reads and writes, which is
// why AudioDeck's mixer and the Windows one can never disagree.
internal readonly unsafe struct SimpleAudioVolume : IDisposable
{
    private readonly IntPtr _ptr;

    public SimpleAudioVolume(IntPtr ptr) => _ptr = ptr;

    // Slot 3: SetMasterVolume(float level, Guid* eventContext)
    public void SetMasterVolume(float level)
    {
        int hr = ((delegate* unmanaged<IntPtr, float, Guid*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, level, null);
        ComRuntime.Check(hr, "ISimpleAudioVolume.SetMasterVolume");
    }

    // Slot 4: GetMasterVolume(out float)
    public float GetMasterVolume()
    {
        float level;
        int hr = ((delegate* unmanaged<IntPtr, float*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, &level);
        ComRuntime.Check(hr, "ISimpleAudioVolume.GetMasterVolume");
        return level;
    }

    // Slot 5: SetMute(BOOL, Guid* eventContext)
    public void SetMute(bool mute)
    {
        int hr = ((delegate* unmanaged<IntPtr, int, Guid*, int>)ComRuntime.Slot(_ptr, 5))(_ptr, mute ? 1 : 0, null);
        ComRuntime.Check(hr, "ISimpleAudioVolume.SetMute");
    }

    // Slot 6: GetMute(out BOOL)
    public bool GetMute()
    {
        int mute;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 6))(_ptr, &mute);
        ComRuntime.Check(hr, "ISimpleAudioVolume.GetMute");
        return mute != 0;
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
