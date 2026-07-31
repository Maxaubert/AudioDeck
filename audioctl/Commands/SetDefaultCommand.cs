using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// set-default <id>: IPolicyConfig.SetDefaultEndpoint for all three roles
// (0 console, 1 multimedia, 2 communications), per the design spec.
internal static class SetDefaultCommand
{
    private static readonly int[] Roles = [0, 1, 2];

    public static int Run(string id)
    {
        Endpoints.WithDevice(id, _ => 0); // fail fast if the id does not exist
        using var policy = PolicyConfig.Create();
        foreach (int role in Roles)
        {
            policy.SetDefaultEndpoint(id, role);
        }
        return JsonOut.Success("set-default", id);
    }
}
