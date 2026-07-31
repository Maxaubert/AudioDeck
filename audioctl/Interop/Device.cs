using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// IMMDevice wrapper (IID D666063F-1587-4E43-81F1-B948E807363F in the reference notes).
internal readonly unsafe struct Device : IDisposable
{
    private const int ClsCtxInproc = 1; // "clsCtx 1 (INPROC) works" per the reference notes
    private const int StgmRead = 0;
    private const int StgmReadWrite = 2;

    private readonly IntPtr _ptr;

    public Device(IntPtr ptr) => _ptr = ptr;

    // Slot 3: Activate(ref Guid iid, int clsCtx, IntPtr activationParams, out interface)
    public bool TryActivate(Guid iid, out IntPtr itf)
    {
        IntPtr result;
        int hr = ((delegate* unmanaged<IntPtr, Guid*, int, IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 3))(
            _ptr, &iid, ClsCtxInproc, IntPtr.Zero, &result);
        itf = hr < 0 ? IntPtr.Zero : result;
        return hr >= 0;
    }

    public IntPtr Activate(Guid iid)
    {
        if (!TryActivate(iid, out IntPtr itf))
            throw new InvalidOperationException("IMMDevice.Activate failed, endpoint may not be active");
        return itf;
    }

    // Slot 4: OpenPropertyStore(int access, out IPropertyStore), access 0 = STGM_READ
    public PropertyStore OpenPropertyStore() => OpenPropertyStore(StgmRead);

    // STGM_READWRITE succeeds without elevation; the audio service mediates the
    // write (proven live 2026-07-27, see docs/reference/com-interop-notes.md).
    public PropertyStore OpenPropertyStoreWritable() => OpenPropertyStore(StgmReadWrite);

    private PropertyStore OpenPropertyStore(int access)
    {
        IntPtr storePtr;
        int hr = ((delegate* unmanaged<IntPtr, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, access, &storePtr);
        ComRuntime.Check(hr, "IMMDevice.OpenPropertyStore");
        return new PropertyStore(storePtr);
    }

    // Slot 5: GetId(out string id), returns a CoTaskMem LPWSTR like {0.0.0.00000000}.{guid}
    public string GetId()
    {
        IntPtr raw;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 5))(_ptr, &raw);
        ComRuntime.Check(hr, "IMMDevice.GetId");
        try
        {
            return Marshal.PtrToStringUni(raw) ?? string.Empty;
        }
        finally
        {
            Marshal.FreeCoTaskMem(raw);
        }
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
