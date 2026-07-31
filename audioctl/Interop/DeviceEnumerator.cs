namespace AudioCtl.Interop;

// IMMDeviceEnumerator wrapper. GUIDs and method order verbatim from
// docs/reference/com-interop-notes.md. Absolute vtable slots include IUnknown (0-2).
internal readonly unsafe struct DeviceEnumerator : IDisposable
{
    private static readonly Guid Clsid = new("BCDE0395-E52F-467C-8E3D-C4579291692E"); // CLSID MMDeviceEnumerator
    private static readonly Guid Iid = new("A95664D2-9614-4F35-A746-DE8DB63617E6"); // IID IMMDeviceEnumerator

    private const int HrNotFound = unchecked((int)0x80070490); // E_NOTFOUND: no default endpoint exists

    private readonly IntPtr _ptr;

    private DeviceEnumerator(IntPtr ptr) => _ptr = ptr;

    public static DeviceEnumerator Create() => new(ComRuntime.Create(Clsid, Iid));

    // Slot 3: EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection)
    public DeviceCollection EnumAudioEndpoints(DataFlow flow, int stateMask)
    {
        IntPtr collection;
        int hr = ((delegate* unmanaged<IntPtr, int, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 3))(
            _ptr, (int)flow, stateMask, &collection);
        ComRuntime.Check(hr, "IMMDeviceEnumerator.EnumAudioEndpoints");
        return new DeviceCollection(collection);
    }

    // Slot 4: GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice)
    // Returns null when no default exists for the flow/role.
    public string? GetDefaultEndpointId(DataFlow flow, int role)
    {
        IntPtr devicePtr;
        int hr = ((delegate* unmanaged<IntPtr, int, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(
            _ptr, (int)flow, role, &devicePtr);
        if (hr == HrNotFound) return null;
        ComRuntime.Check(hr, "IMMDeviceEnumerator.GetDefaultAudioEndpoint");
        using var device = new Device(devicePtr);
        return device.GetId();
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
