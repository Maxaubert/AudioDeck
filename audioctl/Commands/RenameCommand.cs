using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// rename <id> <name>: set PKEY_Device_DeviceDesc so the new name shows up
// system-wide (Windows audio picker, Settings, every app). Same write the
// classic Sound control panel performs; no elevation required.
internal static class RenameCommand
{
    public static int Run(string id, string name)
    {
        string trimmed = name.Trim();
        if (trimmed.Length == 0) return JsonOut.Error("rename: name must not be empty");

        Endpoints.WithDevice(id, device =>
        {
            using PropertyStore store = device.OpenPropertyStoreWritable();
            store.SetName(trimmed);
            return 0;
        });
        return JsonOut.Success("rename", id);
    }
}
