using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// IPropertyStore wrapper (IID 886d8eeb-8cf2-4446-8d02-cdba1dbdcf99 in the reference
// notes; obtained from IMMDevice.OpenPropertyStore). Reads the friendly name and,
// on a writable store, renames the endpoint globally via the device description.
internal readonly unsafe struct PropertyStore : IDisposable
{
    // PKEY_Device_FriendlyName: fmtid a45c254e-df1c-4efd-8020-67d146a850e0, pid 14
    private static readonly Guid DeviceKeyFmtid = new("a45c254e-df1c-4efd-8020-67d146a850e0");
    private const uint FriendlyNamePid = 14;
    // PKEY_Device_DeviceDesc (same fmtid, pid 2): the user-visible first part of the
    // name ("Headphones" in "Headphones (Arctis Nova Pro Wireless)"). Writing it is
    // what the classic Sound control panel's rename does; Windows recomposes the
    // full picker name from it.
    private const uint DeviceDescPid = 2;
    private const ushort VtLpwstr = 31;

    [StructLayout(LayoutKind.Sequential)]
    private struct PropertyKey
    {
        public Guid Fmtid;
        public uint Pid;
    }

    // PROPVARIANT per the reference notes: vt at offset 0, pointer union at offset 8.
    // 24 bytes covers the largest union member on x64.
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropVariant
    {
        [FieldOffset(0)] public ushort Vt;
        [FieldOffset(8)] public IntPtr Ptr;
    }

    private readonly IntPtr _ptr;

    public PropertyStore(IntPtr ptr) => _ptr = ptr;

    // Slot 6: SetValue(ref PROPERTYKEY, ref PROPVARIANT), slot 7: Commit(). Needs a
    // store opened with STGM_READWRITE; works without elevation (audiosrv mediates).
    public void SetDeviceDescription(string name)
    {
        var key = new PropertyKey { Fmtid = DeviceKeyFmtid, Pid = DeviceDescPid };
        var value = new PropVariant { Vt = VtLpwstr, Ptr = Marshal.StringToCoTaskMemUni(name) };
        try
        {
            int hr = ((delegate* unmanaged<IntPtr, PropertyKey*, PropVariant*, int>)ComRuntime.Slot(_ptr, 6))(
                _ptr, &key, &value);
            ComRuntime.Check(hr, "IPropertyStore.SetValue");
            hr = ((delegate* unmanaged<IntPtr, int>)ComRuntime.Slot(_ptr, 7))(_ptr);
            ComRuntime.Check(hr, "IPropertyStore.Commit");
        }
        finally
        {
            ComRuntime.PropVariantClear(&value);
        }
    }

    // Slot 5: GetValue(ref PROPERTYKEY, out PROPVARIANT); GetCount and GetAt precede it.
    public string? GetFriendlyName()
    {
        var key = new PropertyKey { Fmtid = DeviceKeyFmtid, Pid = FriendlyNamePid };
        var value = default(PropVariant);
        int hr = ((delegate* unmanaged<IntPtr, PropertyKey*, PropVariant*, int>)ComRuntime.Slot(_ptr, 5))(
            _ptr, &key, &value);
        if (hr < 0) return null;
        try
        {
            return value.Vt == VtLpwstr ? Marshal.PtrToStringUni(value.Ptr) : null;
        }
        finally
        {
            ComRuntime.PropVariantClear(&value);
        }
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
