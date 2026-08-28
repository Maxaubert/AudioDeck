using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// Shell icon extraction: SHCreateItemFromParsingName straight to
// IShellItemImageFactory (IID BCC18B79-BA16-442F-80C4-8A59C30C463B), GetImage with
// SIIGBF_ICONONLY. 256 px source keeps icons crisp on high-DPI displays.
internal static unsafe class ShellIcon
{
    private static readonly Guid IidImageFactory = new("BCC18B79-BA16-442F-80C4-8A59C30C463B");

    private const int SiigbfBiggerSizeOk = 0x1;
    private const int SiigbfIconOnly = 0x4;

    [DllImport("shell32", CharSet = CharSet.Unicode)]
    private static extern int SHCreateItemFromParsingName(string path, IntPtr bindCtx, in Guid iid, out IntPtr item);

    [StructLayout(LayoutKind.Sequential)]
    private struct Size
    {
        public int Cx, Cy;
    }

    public static (int Width, int Height, byte[] Rgba)? Extract(string exePath, int size)
    {
        if (SHCreateItemFromParsingName(exePath, IntPtr.Zero, IidImageFactory, out IntPtr factory) < 0)
            return null;
        try
        {
            IntPtr hbitmap;
            var wanted = new Size { Cx = size, Cy = size };
            // Slot 3: GetImage(SIZE, int flags, out HBITMAP)
            int hr = ((delegate* unmanaged<IntPtr, Size, int, IntPtr*, int>)ComRuntime.Slot(factory, 3))(
                factory, wanted, SiigbfIconOnly | SiigbfBiggerSizeOk, &hbitmap);
            if (hr < 0) return null;
            try
            {
                return Gdi.ReadRgba(hbitmap);
            }
            finally
            {
                Gdi.DeleteObject(hbitmap);
            }
        }
        finally
        {
            ComRuntime.Release(factory);
        }
    }
}
