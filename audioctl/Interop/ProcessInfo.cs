using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// Executable path and version FileDescription for a pid; the mixer's app names
// and icons both start here.
internal static unsafe class ProcessInfo
{
    private const int ProcessQueryLimitedInformation = 0x1000;

    [DllImport("kernel32", SetLastError = true)]
    private static extern IntPtr OpenProcess(int access, bool inherit, uint pid);

    [DllImport("kernel32")]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32", CharSet = CharSet.Unicode)]
    private static extern bool QueryFullProcessImageNameW(IntPtr process, int flags, char[] buffer, ref int size);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern int GetFileVersionInfoSizeW(string file, out int handle);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern bool GetFileVersionInfoW(string file, int handle, int len, byte* data);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern bool VerQueryValueW(byte* block, string subBlock, out IntPtr buffer, out uint len);

    public static string? ExePath(uint pid)
    {
        if (pid == 0) return null;
        IntPtr handle = OpenProcess(ProcessQueryLimitedInformation, false, pid);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var buffer = new char[1024];
            int size = buffer.Length;
            return QueryFullProcessImageNameW(handle, 0, buffer, ref size) ? new string(buffer, 0, size) : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    // The FileDescription version string is the name Windows shows for an app
    // ("Google Chrome" for chrome.exe). Null when the exe carries no version info.
    // The block stays pinned for the whole read: VerQueryValueW returns pointers
    // into it, which the GC must not move underneath us.
    public static string? FileDescription(string exePath)
    {
        int size = GetFileVersionInfoSizeW(exePath, out _);
        if (size <= 0) return null;
        var data = new byte[size];
        fixed (byte* block = data)
        {
            if (!GetFileVersionInfoW(exePath, 0, size, block)) return null;
            if (!VerQueryValueW(block, @"\VarFileInfo\Translation", out IntPtr trans, out uint transLen) || transLen < 4)
                return null;
            ushort lang = (ushort)Marshal.ReadInt16(trans);
            ushort codepage = (ushort)Marshal.ReadInt16(trans, 2);
            string key = $@"\StringFileInfo\{lang:X4}{codepage:X4}\FileDescription";
            if (!VerQueryValueW(block, key, out IntPtr value, out uint valueLen) || valueLen == 0) return null;
            return Marshal.PtrToStringUni(value)?.TrimEnd('\0');
        }
    }
}
