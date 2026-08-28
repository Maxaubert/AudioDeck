using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// app-icon <exePath> <outPng> <size>: the shell icon of a file, written as a PNG.
internal static class AppIconCommand
{
    public static int Run(string exePath, string outPng, string sizeArg)
    {
        if (!int.TryParse(sizeArg, out int size) || size is < 16 or > 1024)
            return JsonOut.Error("size must be an integer between 16 and 1024");
        if (!File.Exists(exePath)) return JsonOut.Error($"no file at {exePath}");
        if (ShellIcon.Extract(exePath, size) is not { } icon)
            return JsonOut.Error("the shell produced no icon for this file");
        File.WriteAllBytes(outPng, PngWriter.Write(icon.Width, icon.Height, icon.Rgba));
        return JsonOut.Success("app-icon", exePath);
    }
}
