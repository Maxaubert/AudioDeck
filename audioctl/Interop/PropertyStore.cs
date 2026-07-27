using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// IPropertyStore wrapper (IID 886d8eeb-8cf2-4446-8d02-cdba1dbdcf99 in the reference
// notes; obtained from IMMDevice.OpenPropertyStore). Only used to read the friendly name.
internal readonly unsafe struct PropertyStore : IDisposable
{
    // PKEY_Device_FriendlyName: fmtid a45c254e-df1c-4efd-8020-67d146a850e0, pid 14
    private static readonly Guid FriendlyNameFmtid = new("a45c254e-df1c-4efd-8020-67d146a850e0");
    private const uint FriendlyNamePid = 14;
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

    // Slot 5: GetValue(ref PROPERTYKEY, out PROPVARIANT); GetCount and GetAt precede it.
    public string? GetFriendlyName()
    {
        var key = new PropertyKey { Fmtid = FriendlyNameFmtid, Pid = FriendlyNamePid };
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
