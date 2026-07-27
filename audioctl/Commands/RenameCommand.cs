using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// rename <id> <name> [suffix]: set the device description (and optionally the
// interface-name suffix shown in parentheses) so the new name shows up
// system-wide (Windows audio picker, Settings, every app). No elevation
// required. Windows always composes "name (suffix)"; the parentheses cannot
// be removed, but both texts are user-controlled.
internal static class RenameCommand
{
    public static int Run(string id, string name, string? suffix = null)
    {
        string trimmed = name.Trim();
        if (trimmed.Length == 0) return JsonOut.Error("rename: name must not be empty");
        if (suffix is not null && suffix.Trim().Length == 0)
            return JsonOut.Error("rename: suffix must not be empty (omit it to keep the current one)");

        Endpoints.WithDevice(id, device =>
        {
            using PropertyStore store = device.OpenPropertyStoreWritable();
            store.SetName(trimmed, suffix);
            return 0;
        });
        return JsonOut.Success("rename", id);
    }
}
