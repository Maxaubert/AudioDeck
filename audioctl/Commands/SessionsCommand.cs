using System.Text.Json;
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// sessions: every non-expired audio session on the default render endpoint, as a
// JSON array of {id, pid, exePath, name, state, isSystemSounds, volume, mute}.
internal static class SessionsCommand
{
    private const int RoleConsole = 0;

    public static int Run()
    {
        using var enumerator = DeviceEnumerator.Create();
        // No default output means no sessions to show, not an error: the Mixer
        // tab draws its empty state from an empty array.
        if (!enumerator.TryGetDefaultEndpoint(DataFlow.Render, RoleConsole, out Device device))
        {
            JsonOut.Write(w =>
            {
                w.WriteStartArray();
                w.WriteEndArray();
            });
            return 0;
        }
        using (device)
        {
            using var manager = AudioSessionManager.From(device);
            using var sessions = manager.GetSessionEnumerator();
            int count = sessions.GetCount();
            JsonOut.Write(w =>
            {
                w.WriteStartArray();
                for (int i = 0; i < count; i++)
                {
                    using var control = sessions.GetSession(i);
                    WriteSession(w, control);
                }
                w.WriteEndArray();
            });
        }
        return 0;
    }

    private static void WriteSession(Utf8JsonWriter w, AudioSessionControl control)
    {
        int state = control.GetState();
        // Expired sessions belong to processes that already exited; the Windows
        // mixer does not show them either.
        if (state == AudioSessionControl.StateExpired) return;
        if (!control.TryGetControl2(out var control2)) return;
        using (control2)
        {
            string id = control2.GetSessionInstanceIdentifier();
            uint pid = control2.GetProcessId();
            bool systemSounds = control2.IsSystemSoundsSession();
            string? exePath = systemSounds ? null : ProcessInfo.ExePath(pid);
            string name = ResolveName(control, systemSounds, exePath, pid);
            if (!control.TryGetSimpleVolume(out var volume)) return;
            using (volume)
            {
                w.WriteStartObject();
                w.WriteString("id", id);
                w.WriteNumber("pid", pid);
                if (exePath is string p) w.WriteString("exePath", p); else w.WriteNull("exePath");
                w.WriteString("name", name);
                w.WriteString("state", state == AudioSessionControl.StateActive ? "active" : "inactive");
                w.WriteBoolean("isSystemSounds", systemSounds);
                w.WriteNumber("volume", (int)MathF.Round(volume.GetMasterVolume() * 100f));
                w.WriteBoolean("mute", volume.GetMute());
                w.WriteEndObject();
            }
        }
    }

    private static string ResolveName(AudioSessionControl control, bool systemSounds, string? exePath, uint pid)
    {
        if (systemSounds) return "System sounds";
        // "@%SystemRoot%\..." display names are unresolved resource references,
        // worse than falling through to the version string.
        string display = control.GetDisplayName();
        if (display.Length > 0 && !display.StartsWith('@')) return display;
        if (exePath is not null)
        {
            string? description = null;
            try
            {
                description = ProcessInfo.FileDescription(exePath);
            }
            catch
            {
                // Version info is decoration; a name is still owed.
            }
            if (!string.IsNullOrWhiteSpace(description)) return description;
            return Path.GetFileNameWithoutExtension(exePath);
        }
        return $"App {pid}";
    }
}
