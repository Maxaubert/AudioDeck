using AudioCtl.Interop;

namespace AudioCtl;

// Shared endpoint lookup used by every command that targets one endpoint id.
internal static class Endpoints
{
    public static readonly DataFlow[] Flows = [DataFlow.Render, DataFlow.Capture];

    // Runs an action on the IMMDevice with the given endpoint id, searching both
    // flows and all states so disabled endpoints can be targeted too.
    public static T WithDevice<T>(string id, Func<Device, T> action)
    {
        using var enumerator = DeviceEnumerator.Create();
        foreach (DataFlow flow in Flows)
        {
            using var collection = enumerator.EnumAudioEndpoints(flow, DeviceState.All);
            uint count = collection.Count;
            for (uint i = 0; i < count; i++)
            {
                using var device = collection.Item(i);
                if (device.GetId() == id) return action(device);
            }
        }
        throw new InvalidOperationException($"no endpoint with id {id}");
    }
}
