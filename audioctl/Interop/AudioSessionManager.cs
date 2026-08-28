namespace AudioCtl.Interop;

// IAudioSessionManager2 wrapper (IID 77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F),
// activated from an IMMDevice. Absolute slots: IUnknown 0-2, IAudioSessionManager
// 3-4 (GetAudioSessionControl, GetSimpleAudioVolume), IAudioSessionManager2 from 5.
internal readonly unsafe struct AudioSessionManager : IDisposable
{
    private static readonly Guid Iid = new("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");

    private readonly IntPtr _ptr;

    private AudioSessionManager(IntPtr ptr) => _ptr = ptr;

    public static AudioSessionManager From(Device device) => new(device.Activate(Iid));

    // Slot 5: GetSessionEnumerator(out IAudioSessionEnumerator)
    public AudioSessionEnumerator GetSessionEnumerator()
    {
        IntPtr enumPtr;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 5))(_ptr, &enumPtr);
        ComRuntime.Check(hr, "IAudioSessionManager2.GetSessionEnumerator");
        return new AudioSessionEnumerator(enumPtr);
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
