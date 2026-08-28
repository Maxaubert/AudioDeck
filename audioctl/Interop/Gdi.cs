using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// GDI plumbing for ShellIcon: pull the pixels out of an HBITMAP as straight RGBA.
internal static class Gdi
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Bitmap
    {
        public int Type, Width, Height, WidthBytes;
        public ushort Planes, BitsPixel;
        public IntPtr Bits;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BitmapInfoHeader
    {
        public int Size, Width, Height;
        public ushort Planes, BitCount;
        public int Compression, SizeImage, XPels, YPels, ClrUsed, ClrImportant;
    }

    // BITMAPINFO with room for the color table GetDIBits may write for BI_RGB.
    [StructLayout(LayoutKind.Sequential)]
    private struct FullBitmapInfo
    {
        public BitmapInfoHeader Header;
        public uint Color0, Color1, Color2;
    }

    [DllImport("gdi32", CharSet = CharSet.Unicode)]
    private static extern int GetObjectW(IntPtr handle, int size, out Bitmap bitmap);

    [DllImport("gdi32")]
    private static extern int GetDIBits(IntPtr dc, IntPtr bitmap, uint start, uint lines, byte[] bits,
        ref FullBitmapInfo info, uint usage);

    [DllImport("gdi32")]
    public static extern bool DeleteObject(IntPtr handle);

    [DllImport("user32")]
    private static extern IntPtr GetDC(IntPtr window);

    [DllImport("user32")]
    private static extern int ReleaseDC(IntPtr window, IntPtr dc);

    public static (int Width, int Height, byte[] Rgba)? ReadRgba(IntPtr hbitmap)
    {
        if (GetObjectW(hbitmap, Marshal.SizeOf<Bitmap>(), out Bitmap bm) == 0) return null;
        int width = bm.Width;
        int height = Math.Abs(bm.Height);
        if (width <= 0 || height <= 0) return null;

        var info = new FullBitmapInfo
        {
            Header = new BitmapInfoHeader
            {
                Size = Marshal.SizeOf<BitmapInfoHeader>(),
                Width = width,
                Height = -height, // negative height requests top-down rows
                Planes = 1,
                BitCount = 32,
                Compression = 0, // BI_RGB
            },
        };
        var bgra = new byte[width * height * 4];
        IntPtr dc = GetDC(IntPtr.Zero);
        try
        {
            if (GetDIBits(dc, hbitmap, 0, (uint)height, bgra, ref info, 0) == 0) return null;
        }
        finally
        {
            ReleaseDC(IntPtr.Zero, dc);
        }

        // A 32bpp bitmap whose alpha channel is entirely zero is an opaque image
        // in a format that never wrote alpha; honoring the zeros would make the
        // whole icon invisible.
        bool anyAlpha = false;
        for (int i = 3; i < bgra.Length; i += 4)
        {
            if (bgra[i] != 0)
            {
                anyAlpha = true;
                break;
            }
        }

        // The shell hands back premultiplied BGRA (made for AlphaBlend); PNG
        // stores straight RGBA.
        var rgba = new byte[bgra.Length];
        for (int i = 0; i < bgra.Length; i += 4)
        {
            byte b = bgra[i], g = bgra[i + 1], r = bgra[i + 2];
            byte a = anyAlpha ? bgra[i + 3] : (byte)255;
            if (a != 0 && a != 255)
            {
                r = (byte)Math.Min(255, r * 255 / a);
                g = (byte)Math.Min(255, g * 255 / a);
                b = (byte)Math.Min(255, b * 255 / a);
            }
            rgba[i] = r;
            rgba[i + 1] = g;
            rgba[i + 2] = b;
            rgba[i + 3] = a;
        }
        return (width, height, rgba);
    }
}
