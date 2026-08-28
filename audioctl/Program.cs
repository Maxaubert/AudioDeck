using AudioCtl.Commands;
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl;

// Entry point: parses the command line and dispatches to one command per verb.
internal static class Program
{
    private const string Usage =
        "usage: audioctl <command>\n" +
        "  list                     all render and capture endpoints, JSON\n" +
        "  sessions                 audio sessions on the default output, JSON\n" +
        "  set-app-volume <0-100> <sessionId...>  set app session volume(s)\n" +
        "  mute-app <sessionId...> | unmute-app <sessionId...>  set app session mute\n" +
        "  set-default <id>         make endpoint the default for all roles\n" +
        "  set-volume <id> <0-100>  set endpoint master volume\n" +
        "  mute <id> | unmute <id>  set endpoint mute state\n" +
        "  enable <id> | disable <id>  set endpoint visibility\n" +
        "  rename <id> <name> [suffix]  rename endpoint system-wide (suffix = text in parentheses)\n" +
        "  set-type <id> <formfactor> <iconpath>  set device kind (flyout glyph + classic icon)";

    private static int Main(string[] args)
    {
        try
        {
            ComRuntime.Initialize();
            return args switch
            {
                ["list"] => ListCommand.Run(),
                ["sessions"] => SessionsCommand.Run(),
                ["set-app-volume", var level, .. var appIds] when appIds.Length > 0 => AppVolumeCommand.RunSetVolume(level, appIds),
                ["mute-app", .. var muteIds] when muteIds.Length > 0 => AppVolumeCommand.RunSetMute(true, muteIds),
                ["unmute-app", .. var unmuteIds] when unmuteIds.Length > 0 => AppVolumeCommand.RunSetMute(false, unmuteIds),
                ["set-default", var id] => SetDefaultCommand.Run(id),
                ["set-volume", var id, var level] => VolumeCommand.RunSetVolume(id, level),
                ["mute", var id] => VolumeCommand.RunSetMute(id, mute: true),
                ["unmute", var id] => VolumeCommand.RunSetMute(id, mute: false),
                ["enable", var id] => VisibilityCommand.Run(id, visible: true),
                ["disable", var id] => VisibilityCommand.Run(id, visible: false),
                ["rename", var id, var name] => RenameCommand.Run(id, name),
                ["rename", var id, var name, var suffix] => RenameCommand.Run(id, name, suffix),
                ["set-type", var id, var ff, var icon] => SetTypeCommand.Run(id, ff, icon),
                _ => JsonOut.Error(Usage),
            };
        }
        catch (Exception ex)
        {
            return JsonOut.Error(ex.Message);
        }
    }
}
