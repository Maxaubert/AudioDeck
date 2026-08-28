namespace AudioCtl.Interop;

// IAudioSessionEnumerator wrapper (IID E2F5BB11-0570-40CA-ACDD-3AA01277DEE8).
internal readonly unsafe struct AudioSessionEnumerator : IDisposable
{
    private readonly IntPtr _ptr;

    public AudioSessionEnumerator(IntPtr ptr) => _ptr = ptr;

    // Slot 3: GetCount(out int)
    public int GetCount()
    {
        int count;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, &count);
        ComRuntime.Check(hr, "IAudioSessionEnumerator.GetCount");
        return count;
    }

    // Slot 4: GetSession(int index, out IAudioSessionControl)
    public AudioSessionControl GetSession(int index)
    {
        IntPtr control;
        int hr = ((delegate* unmanaged<IntPtr, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, index, &control);
        ComRuntime.Check(hr, "IAudioSessionEnumerator.GetSession");
        return new AudioSessionControl(control);
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
