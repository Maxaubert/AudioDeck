using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// set-app-volume <0-100> <sessionId...>, mute-app/unmute-app <sessionId...>:
// ISimpleAudioVolume on every named session of the default render endpoint. One
// spawn covers a whole app group, so a grouped fader write is atomic.
internal static class AppVolumeCommand
{
    private const int RoleConsole = 0;

    public static int RunSetVolume(string levelArg, string[] ids)
    {
        if (!int.TryParse(levelArg, out int level) || level is < 0 or > 100)
            return JsonOut.Error("volume must be an integer between 0 and 100");
        return Apply(ids, volume => volume.SetMasterVolume(level / 100f), "set-app-volume");
    }

    public static int RunSetMute(bool mute, string[] ids)
        => Apply(ids, volume => volume.SetMute(mute), mute ? "mute-app" : "unmute-app");

    private static int Apply(string[] ids, Action<SimpleAudioVolume> action, string command)
    {
        var wanted = new HashSet<string>(ids, StringComparer.Ordinal);
        int matched = 0;
        using var enumerator = DeviceEnumerator.Create();
        if (enumerator.TryGetDefaultEndpoint(DataFlow.Render, RoleConsole, out Device device))
        {
            using (device)
            {
                using var manager = AudioSessionManager.From(device);
                using var sessions = manager.GetSessionEnumerator();
                int count = sessions.GetCount();
                for (int i = 0; i < count; i++)
                {
                    using var control = sessions.GetSession(i);
                    if (!control.TryGetControl2(out var control2)) continue;
                    string id;
                    using (control2) id = control2.GetSessionInstanceIdentifier();
                    if (!wanted.Contains(id)) continue;
                    if (!control.TryGetSimpleVolume(out var volume)) continue;
                    using (volume) action(volume);
                    matched++;
                }
            }
        }
        // Sessions can die between the UI's poll and the click. Touching any of
        // the named ones is success; reaching none means the target is gone.
        return matched > 0 ? JsonOut.Success(command, ids[0]) : JsonOut.Error("no matching audio session");
    }
}
