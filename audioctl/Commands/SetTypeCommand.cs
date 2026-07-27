using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// set-type <id> <formfactor> <iconpath>: change what kind of device Windows
// shows this endpoint as. The form factor picks the glyph in the modern
// flyout; the icon path (e.g. "%windir%\system32\mmres.dll,-3010") covers the
// classic surfaces. No elevation required.
internal static class SetTypeCommand
{
    public static int Run(string id, string formFactorArg, string iconPath)
    {
        if (!uint.TryParse(formFactorArg, out uint formFactor) || formFactor > 10)
            return JsonOut.Error("set-type: formfactor must be an integer 0-10");
        if (iconPath.Trim().Length == 0)
            return JsonOut.Error("set-type: iconpath must not be empty");

        Endpoints.WithDevice(id, device =>
        {
            using PropertyStore store = device.OpenPropertyStoreWritable();
            store.SetType(formFactor, iconPath.Trim());
            return 0;
        });
        return JsonOut.Success("set-type", id);
    }
}
