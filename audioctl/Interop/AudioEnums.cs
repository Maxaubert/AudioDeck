namespace AudioCtl.Interop;

// Data flow and endpoint state values from docs/reference/com-interop-notes.md.

internal enum DataFlow
{
    Render = 0,
    Capture = 1,
}

internal static class DeviceState
{
    public const int Active = 1;
    public const int Disabled = 2;
    public const int NotPresent = 4;
    public const int Unplugged = 8;
    public const int All = 0xF;
}
