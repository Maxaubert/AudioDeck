namespace AudioCtl.Interop;

// IPolicyConfig wrapper (undocumented but stable; the same API the Sound control panel
// uses). GUIDs and method order verbatim from docs/reference/com-interop-notes.md:
//   CLSID CPolicyConfigClient 870af99c-171d-4f9e-af0d-e63df40c2bc9
//   IID IPolicyConfig f8679f50-850a-41cf-9c72-430f290290c8
// Method order after IUnknown: GetMixFormat, GetDeviceFormat, ResetDeviceFormat,
// SetDeviceFormat, GetProcessingPeriod, SetProcessingPeriod, GetShareMode, SetShareMode,
// GetPropertyValue, SetPropertyValue (placeholders, absolute slots 3-12), then the two
// methods we call: SetDefaultEndpoint, the notes' slot 11 (absolute slot 13), and
// SetEndpointVisibility, the notes' slot 12 (absolute slot 14).
internal readonly unsafe struct PolicyConfig : IDisposable
{
    private static readonly Guid Clsid = new("870af99c-171d-4f9e-af0d-e63df40c2bc9");
    private static readonly Guid Iid = new("f8679f50-850a-41cf-9c72-430f290290c8");

    private readonly IntPtr _ptr;

    private PolicyConfig(IntPtr ptr) => _ptr = ptr;

    public static PolicyConfig Create() => new(ComRuntime.Create(Clsid, Iid));

    // SetDefaultEndpoint(LPCWSTR deviceId, ERole role); callers set roles 0, 1 and 2.
    public void SetDefaultEndpoint(string deviceId, int role)
    {
        fixed (char* id = deviceId)
        {
            int hr = ((delegate* unmanaged<IntPtr, char*, int, int>)ComRuntime.Slot(_ptr, 13))(_ptr, id, role);
            ComRuntime.Check(hr, "IPolicyConfig.SetDefaultEndpoint");
        }
    }

    // SetEndpointVisibility(LPCWSTR deviceId, int visible); 0 disables, 1 enables.
    public void SetEndpointVisibility(string deviceId, bool visible)
    {
        fixed (char* id = deviceId)
        {
            int hr = ((delegate* unmanaged<IntPtr, char*, int, int>)ComRuntime.Slot(_ptr, 14))(_ptr, id, visible ? 1 : 0);
            ComRuntime.Check(hr, "IPolicyConfig.SetEndpointVisibility");
        }
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
