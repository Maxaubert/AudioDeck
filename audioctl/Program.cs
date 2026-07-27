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
        "  set-default <id>         make endpoint the default for all roles\n" +
        "  set-volume <id> <0-100>  set endpoint master volume\n" +
        "  mute <id> | unmute <id>  set endpoint mute state\n" +
        "  enable <id> | disable <id>  set endpoint visibility\n" +
        "  rename <id> <name> [suffix]  rename endpoint system-wide (suffix = text in parentheses)";

    private static int Main(string[] args)
    {
        try
        {
            ComRuntime.Initialize();
            return args switch
            {
                ["list"] => ListCommand.Run(),
                ["set-default", var id] => SetDefaultCommand.Run(id),
                ["set-volume", var id, var level] => VolumeCommand.RunSetVolume(id, level),
                ["mute", var id] => VolumeCommand.RunSetMute(id, mute: true),
                ["unmute", var id] => VolumeCommand.RunSetMute(id, mute: false),
                ["enable", var id] => VisibilityCommand.Run(id, visible: true),
                ["disable", var id] => VisibilityCommand.Run(id, visible: false),
                ["rename", var id, var name] => RenameCommand.Run(id, name),
                ["rename", var id, var name, var suffix] => RenameCommand.Run(id, name, suffix),
                _ => JsonOut.Error(Usage),
            };
        }
        catch (Exception ex)
        {
            return JsonOut.Error(ex.Message);
        }
    }
}
