using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// COM bootstrap plus the low-level helpers every raw vtable wrapper uses.
// Raw function-pointer calls keep the binary NativeAOT-compatible, since NativeAOT
// has no built-in COM marshalling.
internal static unsafe class ComRuntime
{
    private const int ClsCtxInprocServer = 1;
    private const int CoinitApartmentThreaded = 2;

    [DllImport("ole32")]
    private static extern int CoInitializeEx(IntPtr reserved, int coinit);

    [DllImport("ole32")]
    private static extern int CoCreateInstance(in Guid clsid, IntPtr outer, int clsCtx, in Guid iid, out IntPtr ppv);

    [DllImport("ole32")]
    internal static extern int PropVariantClear(void* pvar);

    public static void Initialize()
    {
        // RPC_E_CHANGED_MODE means the runtime already initialized COM on this thread
        // (NativeAOT initializes the main thread as MTA); any apartment works for us.
        const int RpcEChangedMode = unchecked((int)0x80010106);
        int hr = CoInitializeEx(IntPtr.Zero, CoinitApartmentThreaded);
        if (hr == RpcEChangedMode) return;
        Check(hr, "CoInitializeEx");
    }

    public static IntPtr Create(in Guid clsid, in Guid iid)
    {
        Check(CoCreateInstance(clsid, IntPtr.Zero, ClsCtxInprocServer, iid, out IntPtr ptr), "CoCreateInstance");
        return ptr;
    }

    // Function pointer at an absolute vtable slot; IUnknown occupies slots 0-2.
    public static void* Slot(IntPtr unknown, int slot) => (*(void***)unknown)[slot];

    public static void Release(IntPtr unknown)
    {
        if (unknown == IntPtr.Zero) return;
        ((delegate* unmanaged<IntPtr, uint>)Slot(unknown, 2))(unknown);
    }

    public static void Check(int hr, string what)
    {
        if (hr < 0) throw new InvalidOperationException($"{what} failed with HRESULT 0x{hr:X8}");
    }

    // QueryInterface (slot 0). False on E_NOINTERFACE; itf is zero then.
    public static bool TryQuery(IntPtr unknown, in Guid iid, out IntPtr itf)
    {
        fixed (Guid* piid = &iid)
        {
            IntPtr result;
            int hr = ((delegate* unmanaged<IntPtr, Guid*, IntPtr*, int>)Slot(unknown, 0))(unknown, piid, &result);
            itf = hr < 0 ? IntPtr.Zero : result;
            return hr >= 0;
        }
    }

    // Read-and-free for the CoTaskMem LPWSTRs COM getters hand back.
    public static string ReadTaskMemString(IntPtr raw)
    {
        try
        {
            return Marshal.PtrToStringUni(raw) ?? string.Empty;
        }
        finally
        {
            Marshal.FreeCoTaskMem(raw);
        }
    }
}
