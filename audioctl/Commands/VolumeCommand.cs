using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// set-volume <id> <0-100>, mute <id>, unmute <id>: IAudioEndpointVolume on one endpoint.
internal static class VolumeCommand
{
    public static int RunSetVolume(string id, string levelArg)
    {
        if (!int.TryParse(levelArg, out int level) || level is < 0 or > 100)
            return JsonOut.Error("volume must be an integer between 0 and 100");

        Endpoints.WithDevice(id, device =>
        {
            using var volume = AudioEndpointVolume.From(device);
            volume.SetMasterVolumeScalar(level / 100f);
            return 0;
        });
        return JsonOut.Success("set-volume", id);
    }

    public static int RunSetMute(string id, bool mute)
    {
        Endpoints.WithDevice(id, device =>
        {
            using var volume = AudioEndpointVolume.From(device);
            volume.SetMute(mute);
            return 0;
        });
        return JsonOut.Success(mute ? "mute" : "unmute", id);
    }
}
