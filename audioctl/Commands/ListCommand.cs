using System.Text.Json;
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// list: prints every render and capture endpoint in every state as a JSON array of
// {id, name, flow, state, isDefault, isDefaultComms, formFactor, association, volume, mute}.
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
        var props = ReadProps(device);
        w.WriteStartObject();
        w.WriteString("id", id);
        w.WriteString("name", props.Name);
        w.WriteString("flow", flow == DataFlow.Render ? "render" : "capture");
        w.WriteString("state", state);
        w.WriteBoolean("isDefault", id == defaultId);
        w.WriteBoolean("isDefaultComms", id == defaultCommsId);
        if (props.FormFactor is uint ff) w.WriteNumber("formFactor", ff); else w.WriteNull("formFactor");
        if (props.Association is string assoc) w.WriteString("association", assoc); else w.WriteNull("association");

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

    private readonly record struct DeviceProps(string Name, string? Association, uint? FormFactor);

    // One property store per device, not one per property. Opening the store is
    // the expensive part of listing (a COM call into the audio service), and a
    // machine that has seen a lot of hardware enumerates 50+ endpoints on every
    // poll, so three opens each was three times the work for the same answer.
    // Each read still fails independently: an endpoint that cannot answer for
    // one property must not lose the others.
    private static DeviceProps ReadProps(Device device)
    {
        try
        {
            using var store = device.OpenPropertyStore();
            return new DeviceProps(Read(store.GetFriendlyName) ?? "(unknown)",
                                   Read(store.GetAssociation),
                                   ReadValue(store.GetFormFactor));
        }
        catch
        {
            return new DeviceProps("(unknown)", null, null);
        }
    }

    private static T? Read<T>(Func<T?> get) where T : class
    {
        try { return get(); } catch { return null; }
    }

    private static T? ReadValue<T>(Func<T?> get) where T : struct
    {
        try { return get(); } catch { return null; }
    }
}
