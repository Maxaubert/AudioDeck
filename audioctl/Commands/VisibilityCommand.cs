using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// enable <id>, disable <id>: IPolicyConfig.SetEndpointVisibility. This is the only
// working path; Disable-PnpDevice on the endpoint does not remove it from the audio
// engine (see docs/reference/com-interop-notes.md).
internal static class VisibilityCommand
{
    public static int Run(string id, bool visible)
    {
        Endpoints.WithDevice(id, _ => 0); // fail fast if the id does not exist
        using var policy = PolicyConfig.Create();
        policy.SetEndpointVisibility(id, visible);
        return JsonOut.Success(visible ? "enable" : "disable", id);
    }
}
