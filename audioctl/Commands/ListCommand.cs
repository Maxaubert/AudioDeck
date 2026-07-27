using System.Text.Json;
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// list: prints every render and capture endpoint in every state as a JSON array of
// {id, name, flow, state, isDefault, isDefaultComms, volume, mute}.
internal static class ListCommand
{
    private const int RoleConsole = 0;
    private const int RoleCommunications = 2;

    private static readonly (int Mask, string Name)[] States =
    [
        (DeviceState.Active, "active"),
        (DeviceState.Disabled, "disabled"),
        (DeviceState.NotPresent, "notpresent"),
        (DeviceState.Unplugged, "unplugged"),
    ];

    public static int Run()
    {
        using var enumerator = DeviceEnumerator.Create();
        JsonOut.Write(w =>
        {
            w.WriteStartArray();
            foreach (DataFlow flow in Endpoints.Flows)
            {
                string? defaultId = enumerator.GetDefaultEndpointId(flow, RoleConsole);
                string? defaultCommsId = enumerator.GetDefaultEndpointId(flow, RoleCommunications);
                foreach ((int mask, string stateName) in States)
                {
                    using var collection = enumerator.EnumAudioEndpoints(flow, mask);
                    uint count = collection.Count;
                    for (uint i = 0; i < count; i++)
                    {
                        using var device = collection.Item(i);
                        WriteDevice(w, device, flow, stateName, mask == DeviceState.Active, defaultId, defaultCommsId);
                    }
                }
            }
            w.WriteEndArray();
        });
        return 0;
    }

    private static void WriteDevice(
        Utf8JsonWriter w, Device device, DataFlow flow, string state, bool active,
        string? defaultId, string? defaultCommsId)
    {
        string id = device.GetId();
        w.WriteStartObject();
        w.WriteString("id", id);
        w.WriteString("name", ReadName(device));
        w.WriteString("flow", flow == DataFlow.Render ? "render" : "capture");
        w.WriteString("state", state);
        w.WriteBoolean("isDefault", id == defaultId);
        w.WriteBoolean("isDefaultComms", id == defaultCommsId);
        uint? formFactor = ReadFormFactor(device);
        if (formFactor is uint ff) w.WriteNumber("formFactor", ff); else w.WriteNull("formFactor");

        int? volume = null;
        bool? mute = null;
        if (active && AudioEndpointVolume.TryFrom(device, out var endpointVolume))
        {
            using (endpointVolume)
            {
                volume = (int)MathF.Round(endpointVolume.GetMasterVolumeScalar() * 100f);
                mute = endpointVolume.GetMute();
            }
        }
        if (volume is int v) w.WriteNumber("volume", v); else w.WriteNull("volume");
        if (mute is bool m) w.WriteBoolean("mute", m); else w.WriteNull("mute");
        w.WriteEndObject();
    }

    private static string ReadName(Device device)
    {
        try
        {
            using var store = device.OpenPropertyStore();
            return store.GetFriendlyName() ?? "(unknown)";
        }
        catch
        {
            return "(unknown)";
        }
    }

    private static uint? ReadFormFactor(Device device)
    {
        try
        {
            using var store = device.OpenPropertyStore();
            return store.GetFormFactor();
        }
        catch
        {
            return null;
        }
    }
}
