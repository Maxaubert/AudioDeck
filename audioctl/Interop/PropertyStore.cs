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
    // The suffix source: the endpoint's interface name, shown as the "(...)" part of
    // the composed picker name. Writable (proven live 2026-07-27). NEVER delete it
    // (VT_EMPTY) and never write it empty: deletion collapses the composed name to
    // "(unknown)" and an empty string renders as "name ()".
    private static readonly Guid EndpointInterfaceFmtid = new("b3f8fa53-0004-438e-9003-51a46e139bfc");
    private const uint EndpointInterfacePid = 6;
    // PKEY_AudioEndpoint_FormFactor: drives which glyph the modern flyout shows.
    // PKEY_DeviceClass_IconPath: the classic icon ("%windir%\system32\mmres.dll,-3010").
    // Both writable without elevation (proven live 2026-07-27).
    private static readonly Guid FormFactorFmtid = new("1da5d803-d492-4edd-8c23-e0c0ffee7f0e");
    private const uint FormFactorPid = 0;
    private static readonly Guid IconPathFmtid = new("259abffc-50a7-47ce-af08-68c9a7d73366");
    private const uint IconPathPid = 12;
    private const ushort VtLpwstr = 31;
    private const ushort VtUi4 = 19;

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
        [FieldOffset(8)] public uint Ui4;
    }

    private readonly IntPtr _ptr;

    public PropertyStore(IntPtr ptr) => _ptr = ptr;

    // Slot 6: SetValue(ref PROPERTYKEY, ref PROPVARIANT), slot 7: Commit(). Needs a
    // store opened with STGM_READWRITE; works without elevation (audiosrv mediates).
    // The composed friendly name (pid 14) is protected (E_ACCESSDENIED, verified
    // live) and always renders as "desc (interface)"; both ingredients are
    // writable, so a rename can control everything except the parentheses.
    public void SetName(string name, string? suffix)
    {
        SetString(new PropertyKey { Fmtid = DeviceKeyFmtid, Pid = DeviceDescPid }, name);
        if (!string.IsNullOrWhiteSpace(suffix))
        {
            SetString(
                new PropertyKey { Fmtid = EndpointInterfaceFmtid, Pid = EndpointInterfacePid },
                suffix.Trim());
        }
        int hr = ((delegate* unmanaged<IntPtr, int>)ComRuntime.Slot(_ptr, 7))(_ptr);
        ComRuntime.Check(hr, "IPropertyStore.Commit");
    }

    // Set the endpoint's type: flyout glyph (form factor) plus classic icon.
    public void SetType(uint formFactor, string iconPath)
    {
        var ffKey = new PropertyKey { Fmtid = FormFactorFmtid, Pid = FormFactorPid };
        var ffValue = new PropVariant { Vt = VtUi4, Ui4 = formFactor };
        int hr = ((delegate* unmanaged<IntPtr, PropertyKey*, PropVariant*, int>)ComRuntime.Slot(_ptr, 6))(
            _ptr, &ffKey, &ffValue);
        ComRuntime.Check(hr, "IPropertyStore.SetValue(FormFactor)");
        SetString(new PropertyKey { Fmtid = IconPathFmtid, Pid = IconPathPid }, iconPath);
        hr = ((delegate* unmanaged<IntPtr, int>)ComRuntime.Slot(_ptr, 7))(_ptr);
        ComRuntime.Check(hr, "IPropertyStore.Commit");
    }

    public uint? GetFormFactor()
    {
        var key = new PropertyKey { Fmtid = FormFactorFmtid, Pid = FormFactorPid };
        var value = default(PropVariant);
        int hr = ((delegate* unmanaged<IntPtr, PropertyKey*, PropVariant*, int>)ComRuntime.Slot(_ptr, 5))(
            _ptr, &key, &value);
        if (hr < 0 || value.Vt != VtUi4) return null;
        return value.Ui4;
    }

    private void SetString(PropertyKey key, string text)
    {
        var value = new PropVariant { Vt = VtLpwstr, Ptr = Marshal.StringToCoTaskMemUni(text) };
        try
        {
            int hr = ((delegate* unmanaged<IntPtr, PropertyKey*, PropVariant*, int>)ComRuntime.Slot(_ptr, 6))(
                _ptr, &key, &value);
            ComRuntime.Check(hr, "IPropertyStore.SetValue");
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

