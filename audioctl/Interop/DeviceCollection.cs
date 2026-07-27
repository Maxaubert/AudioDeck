namespace AudioCtl.Interop;

// IMMDeviceCollection wrapper (IID 0BD7A1BE-7A1A-44DB-8397-CC5392387B5E in the
// reference notes; obtained from EnumAudioEndpoints, never created directly).
internal readonly unsafe struct DeviceCollection : IDisposable
{
    private readonly IntPtr _ptr;

    public DeviceCollection(IntPtr ptr) => _ptr = ptr;

    // Slot 3: GetCount(out uint)
    public uint Count
    {
        get
        {
            uint count;
            int hr = ((delegate* unmanaged<IntPtr, uint*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, &count);
            ComRuntime.Check(hr, "IMMDeviceCollection.GetCount");
            return count;
        }
    }

    // Slot 4: Item(uint index, out IMMDevice)
    public Device Item(uint index)
    {
        IntPtr devicePtr;
        int hr = ((delegate* unmanaged<IntPtr, uint, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, index, &devicePtr);
        ComRuntime.Check(hr, "IMMDeviceCollection.Item");
        return new Device(devicePtr);
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
