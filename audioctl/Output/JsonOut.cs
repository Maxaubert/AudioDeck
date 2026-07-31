using System.Text.Json;

namespace AudioCtl.Output;

// Single place that shapes every JSON payload audioctl prints to stdout.
internal static class JsonOut
{
    public static void Write(Action<Utf8JsonWriter> body)
    {
        using var stdout = Console.OpenStandardOutput();
        using (var writer = new Utf8JsonWriter(stdout))
        {
            body(writer);
        }
        stdout.WriteByte((byte)'\n');
    }

    public static int Success(string command, string id)
    {
        Write(w =>
        {
            w.WriteStartObject();
            w.WriteBoolean("ok", true);
            w.WriteString("command", command);
            w.WriteString("id", id);
            w.WriteEndObject();
        });
        return 0;
    }

    public static int Error(string message)
    {
        Write(w =>
        {
            w.WriteStartObject();
            w.WriteBoolean("ok", false);
            w.WriteString("error", message);
            w.WriteEndObject();
        });
        return 1;
    }
}
