# Mixer Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Mixer" tab with per-app volume/mute for the default output device, live-synced with the Windows volume mixer, with per-app icons.

**Architecture:** audioctl.exe gains a WASAPI session layer (`sessions`, `set-app-volume`, `mute-app`/`unmute-app`) and shell icon extraction (`app-icon`); Electron main gains grouping, an icon cache, and four IPC handlers; the renderer gains a MixerView that polls its own `getMixer` call every 1 s while mounted. No config changes; Windows itself persists per-app levels.

**Tech Stack:** C# net8.0 NativeAOT raw-vtable COM (existing style), Electron + TypeScript, React 19, vitest, Playwright.

**Spec:** `docs/specs/2026-08-28-mixer-tab-design.md`

## Global Constraints

- Branch: create GitHub issue first (`gh issue create --title "Mixer tab: per-app volume and mute" ...`), then branch `feat/<issue#>-mixer-tab`. The main working tree currently carries uncommitted unrelated work (ledger/identity files) - create the branch in an isolated worktree from `main` (superpowers:using-git-worktrees).
- Commits: `type(scope): subject` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (plus the Claude-Session trailer the harness appends).
- C# interop: raw function-pointer vtable calls only (NativeAOT has no COM marshalling); follow `audioctl/Interop/Device.cs` style; absolute vtable slots include IUnknown 0-2. New GUIDs/slots get appended to `docs/reference/com-interop-notes.md`.
- TypeScript: ESM with `.js` import suffixes; comments follow the repo's "constraints the code can't show" voice.
- No em-dashes in any text or copy.
- Version bump: `package.json` 0.1.0 -> 0.2.0 (minor, feature) inside this branch.
- Gates before PR: `npm run typecheck`, `npm test`, `npm run e2e` (UI change, so e2e is required).
- UI work applies the standing design skills (impeccable + ui-ux-pro-max) and must match the existing print-language row grammar in `src/renderer/src/styles.css`.
- C# has no test infra: every audioctl change is smoke-verified by running the built exe with real audio playing; expected JSON shapes are given per task.
- Rebuild audioctl for TS-side work with: `dotnet publish -c Release` in `audioctl/` from a VS x64 dev environment per the note in `audioctl/audioctl.csproj` (AOT needs `-p:PublishAot=true -p:IlcUseEnvironmentalTools=true` via vcvars64; the trimmed fallback publish is fine for local testing). Output must land at `audioctl/bin/x64/Release/net8.0/win-x64/publish/audioctl.exe` (what `defaultAudioctlPath()` resolves).

---

### Task 1: Session-layer COM interop (C#)

**Files:**
- Modify: `audioctl/Interop/ComRuntime.cs` (add TryQuery + ReadTaskMemString)
- Modify: `audioctl/Interop/DeviceEnumerator.cs` (add TryGetDefaultEndpoint)
- Create: `audioctl/Interop/AudioSessionManager.cs`
- Create: `audioctl/Interop/AudioSessionEnumerator.cs`
- Create: `audioctl/Interop/AudioSessionControl.cs`
- Create: `audioctl/Interop/SimpleAudioVolume.cs`
- Modify: `docs/reference/com-interop-notes.md` (append the session GUIDs and slot tables below)

**Interfaces:**
- Consumes: existing `ComRuntime`, `Device`, `DeviceEnumerator`, `DataFlow`.
- Produces: `DeviceEnumerator.TryGetDefaultEndpoint(DataFlow, int role, out Device)`, `AudioSessionManager.From(Device)`, `.GetSessionEnumerator()`, `AudioSessionEnumerator.GetCount()/GetSession(int)`, `AudioSessionControl.GetState()/GetDisplayName()/TryGetControl2(out AudioSessionControl2)/TryGetSimpleVolume(out SimpleAudioVolume)`, `AudioSessionControl2.GetSessionInstanceIdentifier()/GetProcessId()/IsSystemSoundsSession()`, `SimpleAudioVolume.Get/SetMasterVolume, Get/SetMute` - used by Tasks 2 and 3.

- [ ] **Step 1: Add the shared helpers to ComRuntime.cs**

Append inside `ComRuntime`:

```csharp
    // QueryInterface (slot 0). False on E_NOINTERFACE; itf is zero then.
    public static bool TryQuery(IntPtr unknown, in Guid iid, out IntPtr itf)
    {
        fixed (Guid* piid = &iid)
        {
            IntPtr result;
            int hr = ((delegate* unmanaged<IntPtr, Guid*, IntPtr*, int>)Slot(unknown, 0))(unknown, piid, &result);
            itf = hr < 0 ? IntPtr.Zero : result;
            return hr >= 0;
        }
    }

    // Read-and-free for the CoTaskMem LPWSTRs COM getters hand back.
    public static string ReadTaskMemString(IntPtr raw)
    {
        try
        {
            return Marshal.PtrToStringUni(raw) ?? string.Empty;
        }
        finally
        {
            Marshal.FreeCoTaskMem(raw);
        }
    }
```

- [ ] **Step 2: Add TryGetDefaultEndpoint to DeviceEnumerator.cs**

After `GetDefaultEndpointId`:

```csharp
    // Slot 4 again, but keeping the IMMDevice: audio sessions are activated on
    // the device itself, not looked up by id.
    public bool TryGetDefaultEndpoint(DataFlow flow, int role, out Device device)
    {
        IntPtr devicePtr;
        int hr = ((delegate* unmanaged<IntPtr, int, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(
            _ptr, (int)flow, role, &devicePtr);
        if (hr == HrNotFound)
        {
            device = default;
            return false;
        }
        ComRuntime.Check(hr, "IMMDeviceEnumerator.GetDefaultAudioEndpoint");
        device = new Device(devicePtr);
        return true;
    }
```

- [ ] **Step 3: Create AudioSessionManager.cs**

```csharp
namespace AudioCtl.Interop;

// IAudioSessionManager2 wrapper (IID 77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F),
// activated from an IMMDevice. Absolute slots: IUnknown 0-2, IAudioSessionManager
// 3-4 (GetAudioSessionControl, GetSimpleAudioVolume), IAudioSessionManager2 from 5.
internal readonly unsafe struct AudioSessionManager : IDisposable
{
    private static readonly Guid Iid = new("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");

    private readonly IntPtr _ptr;

    private AudioSessionManager(IntPtr ptr) => _ptr = ptr;

    public static AudioSessionManager From(Device device) => new(device.Activate(Iid));

    // Slot 5: GetSessionEnumerator(out IAudioSessionEnumerator)
    public AudioSessionEnumerator GetSessionEnumerator()
    {
        IntPtr enumPtr;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 5))(_ptr, &enumPtr);
        ComRuntime.Check(hr, "IAudioSessionManager2.GetSessionEnumerator");
        return new AudioSessionEnumerator(enumPtr);
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
```

- [ ] **Step 4: Create AudioSessionEnumerator.cs**

```csharp
namespace AudioCtl.Interop;

// IAudioSessionEnumerator wrapper (IID E2F5BB11-0570-40CA-ACDD-3AA01277DEE8).
internal readonly unsafe struct AudioSessionEnumerator : IDisposable
{
    private readonly IntPtr _ptr;

    public AudioSessionEnumerator(IntPtr ptr) => _ptr = ptr;

    // Slot 3: GetCount(out int)
    public int GetCount()
    {
        int count;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, &count);
        ComRuntime.Check(hr, "IAudioSessionEnumerator.GetCount");
        return count;
    }

    // Slot 4: GetSession(int index, out IAudioSessionControl)
    public AudioSessionControl GetSession(int index)
    {
        IntPtr control;
        int hr = ((delegate* unmanaged<IntPtr, int, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, index, &control);
        ComRuntime.Check(hr, "IAudioSessionEnumerator.GetSession");
        return new AudioSessionControl(control);
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
```

- [ ] **Step 5: Create AudioSessionControl.cs**

```csharp
namespace AudioCtl.Interop;

// IAudioSessionControl wrapper (IID F4B1A599-7266-4319-A8CA-E70ACB11E8CD) plus QI
// accessors for IAudioSessionControl2 and ISimpleAudioVolume, which the session
// commands always use together. IAudioSessionControl slots 3-11; control2 continues
// at 12.
internal readonly unsafe struct AudioSessionControl : IDisposable
{
    private static readonly Guid IidControl2 = new("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D");
    private static readonly Guid IidSimpleVolume = new("87CE5498-68D6-44E5-9215-6DA47EF883D8");

    public const int StateInactive = 0;
    public const int StateActive = 1;
    public const int StateExpired = 2;

    private readonly IntPtr _ptr;

    public AudioSessionControl(IntPtr ptr) => _ptr = ptr;

    // Slot 3: GetState(out AudioSessionState)
    public int GetState()
    {
        int state;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, &state);
        ComRuntime.Check(hr, "IAudioSessionControl.GetState");
        return state;
    }

    // Slot 4: GetDisplayName(out LPWSTR). Usually empty; apps rarely set it.
    public string GetDisplayName()
    {
        IntPtr raw;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, &raw);
        ComRuntime.Check(hr, "IAudioSessionControl.GetDisplayName");
        return ComRuntime.ReadTaskMemString(raw);
    }

    public bool TryGetControl2(out AudioSessionControl2 control2)
    {
        bool ok = ComRuntime.TryQuery(_ptr, IidControl2, out IntPtr ptr);
        control2 = new AudioSessionControl2(ptr);
        return ok;
    }

    public bool TryGetSimpleVolume(out SimpleAudioVolume volume)
    {
        bool ok = ComRuntime.TryQuery(_ptr, IidSimpleVolume, out IntPtr ptr);
        volume = new SimpleAudioVolume(ptr);
        return ok;
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}

// IAudioSessionControl2 view over its own QI'd pointer. Slots: 12
// GetSessionIdentifier, 13 GetSessionInstanceIdentifier, 14 GetProcessId,
// 15 IsSystemSoundsSession, 16 SetDuckingPreference.
internal readonly unsafe struct AudioSessionControl2 : IDisposable
{
    private readonly IntPtr _ptr;

    public AudioSessionControl2(IntPtr ptr) => _ptr = ptr;

    // Slot 13: GetSessionInstanceIdentifier(out LPWSTR) - unique per live session,
    // the handle set commands match on.
    public string GetSessionInstanceIdentifier()
    {
        IntPtr raw;
        int hr = ((delegate* unmanaged<IntPtr, IntPtr*, int>)ComRuntime.Slot(_ptr, 13))(_ptr, &raw);
        ComRuntime.Check(hr, "IAudioSessionControl2.GetSessionInstanceIdentifier");
        return ComRuntime.ReadTaskMemString(raw);
    }

    // Slot 14: GetProcessId(out uint). AUDCLNT_S_NO_SINGLE_PROCESS is a success
    // code (cross-process session); the pid is still the best available answer.
    public uint GetProcessId()
    {
        uint pid;
        int hr = ((delegate* unmanaged<IntPtr, uint*, int>)ComRuntime.Slot(_ptr, 14))(_ptr, &pid);
        ComRuntime.Check(hr, "IAudioSessionControl2.GetProcessId");
        return pid;
    }

    // Slot 15: IsSystemSoundsSession() - S_OK (0) yes, S_FALSE (1) no.
    public bool IsSystemSoundsSession()
        => ((delegate* unmanaged<IntPtr, int>)ComRuntime.Slot(_ptr, 15))(_ptr) == 0;

    public void Dispose() => ComRuntime.Release(_ptr);
}
```

- [ ] **Step 6: Create SimpleAudioVolume.cs**

```csharp
namespace AudioCtl.Interop;

// ISimpleAudioVolume wrapper (IID 87CE5498-68D6-44E5-9215-6DA47EF883D8): the
// per-session volume the Windows volume mixer itself reads and writes, which is
// why AudioDeck's mixer and the Windows one can never disagree.
internal readonly unsafe struct SimpleAudioVolume : IDisposable
{
    private readonly IntPtr _ptr;

    public SimpleAudioVolume(IntPtr ptr) => _ptr = ptr;

    // Slot 3: SetMasterVolume(float level, Guid* eventContext)
    public void SetMasterVolume(float level)
    {
        int hr = ((delegate* unmanaged<IntPtr, float, Guid*, int>)ComRuntime.Slot(_ptr, 3))(_ptr, level, null);
        ComRuntime.Check(hr, "ISimpleAudioVolume.SetMasterVolume");
    }

    // Slot 4: GetMasterVolume(out float)
    public float GetMasterVolume()
    {
        float level;
        int hr = ((delegate* unmanaged<IntPtr, float*, int>)ComRuntime.Slot(_ptr, 4))(_ptr, &level);
        ComRuntime.Check(hr, "ISimpleAudioVolume.GetMasterVolume");
        return level;
    }

    // Slot 5: SetMute(BOOL, Guid* eventContext)
    public void SetMute(bool mute)
    {
        int hr = ((delegate* unmanaged<IntPtr, int, Guid*, int>)ComRuntime.Slot(_ptr, 5))(_ptr, mute ? 1 : 0, null);
        ComRuntime.Check(hr, "ISimpleAudioVolume.SetMute");
    }

    // Slot 6: GetMute(out BOOL)
    public bool GetMute()
    {
        int mute;
        int hr = ((delegate* unmanaged<IntPtr, int*, int>)ComRuntime.Slot(_ptr, 6))(_ptr, &mute);
        ComRuntime.Check(hr, "ISimpleAudioVolume.GetMute");
        return mute != 0;
    }

    public void Dispose() => ComRuntime.Release(_ptr);
}
```

Note: `ComRuntime.Release` already tolerates `IntPtr.Zero`, so disposing the `out` structs from a failed `TryGet*` is safe.

- [ ] **Step 7: Append to docs/reference/com-interop-notes.md**

Add a "Session layer (Mixer tab)" section recording: the four IIDs above, the absolute slot tables exactly as commented in the code, `AudioSessionState` 0/1/2, that `IsSystemSoundsSession` returns S_OK/S_FALSE rather than an out param, and that ISimpleAudioVolume/IAudioSessionControl2 are QI'd off IAudioSessionControl.

- [ ] **Step 8: Verify it compiles**

Run: `dotnet build -c Release` in `audioctl/`
Expected: build succeeds, no warnings about unsafe slots.

- [ ] **Step 9: Commit**

```bash
git add audioctl/Interop docs/reference/com-interop-notes.md
git commit -m "feat(audioctl): add WASAPI session-layer COM interop"
```

---

### Task 2: `sessions` command (C#)

**Files:**
- Create: `audioctl/Interop/ProcessInfo.cs`
- Create: `audioctl/Commands/SessionsCommand.cs`
- Modify: `audioctl/Program.cs` (dispatch + usage)

**Interfaces:**
- Consumes: Task 1's wrappers.
- Produces: CLI verb `sessions` printing a JSON array of `{id: string, pid: number, exePath: string|null, name: string, state: "active"|"inactive", isSystemSounds: bool, volume: 0-100, mute: bool}` - consumed by Task 5's `Audioctl.sessions()`. `ProcessInfo.ExePath(uint): string?` and `ProcessInfo.FileDescription(string): string?` are also used nowhere else.

- [ ] **Step 1: Create ProcessInfo.cs**

```csharp
using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// Executable path and version FileDescription for a pid; the mixer's app names
// and icons both start here.
internal static unsafe class ProcessInfo
{
    private const int ProcessQueryLimitedInformation = 0x1000;

    [DllImport("kernel32", SetLastError = true)]
    private static extern IntPtr OpenProcess(int access, bool inherit, uint pid);

    [DllImport("kernel32")]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32", CharSet = CharSet.Unicode)]
    private static extern bool QueryFullProcessImageNameW(IntPtr process, int flags, char[] buffer, ref int size);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern int GetFileVersionInfoSizeW(string file, out int handle);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern bool GetFileVersionInfoW(string file, int handle, int len, byte* data);

    [DllImport("version", CharSet = CharSet.Unicode)]
    private static extern bool VerQueryValueW(byte* block, string subBlock, out IntPtr buffer, out uint len);

    public static string? ExePath(uint pid)
    {
        if (pid == 0) return null;
        IntPtr handle = OpenProcess(ProcessQueryLimitedInformation, false, pid);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var buffer = new char[1024];
            int size = buffer.Length;
            return QueryFullProcessImageNameW(handle, 0, buffer, ref size) ? new string(buffer, 0, size) : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    // The FileDescription version string is the name Windows shows for an app
    // ("Google Chrome" for chrome.exe). Null when the exe carries no version info.
    // The block stays pinned for the whole read: VerQueryValueW returns pointers
    // into it, which the GC must not move underneath us.
    public static string? FileDescription(string exePath)
    {
        int size = GetFileVersionInfoSizeW(exePath, out _);
        if (size <= 0) return null;
        var data = new byte[size];
        fixed (byte* block = data)
        {
            if (!GetFileVersionInfoW(exePath, 0, size, block)) return null;
            if (!VerQueryValueW(block, @"\VarFileInfo\Translation", out IntPtr trans, out uint transLen) || transLen < 4)
                return null;
            ushort lang = (ushort)Marshal.ReadInt16(trans);
            ushort codepage = (ushort)Marshal.ReadInt16(trans, 2);
            string key = $@"\StringFileInfo\{lang:X4}{codepage:X4}\FileDescription";
            if (!VerQueryValueW(block, key, out IntPtr value, out uint valueLen) || valueLen == 0) return null;
            return Marshal.PtrToStringUni(value)?.TrimEnd('\0');
        }
    }
}
```

- [ ] **Step 2: Create SessionsCommand.cs**

```csharp
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
```

- [ ] **Step 3: Wire the verb into Program.cs**

Add to the switch (above the catch-all) and to `Usage`:

```csharp
["sessions"] => SessionsCommand.Run(),
```

Usage line: `  sessions                 audio sessions on the default output, JSON`

- [ ] **Step 4: Build and smoke-verify**

Run: `dotnet build -c Release` in `audioctl/`, then play audio in any app (e.g. a YouTube tab) and run the built `audioctl.exe sessions`.
Expected: a JSON array; one row per playing app with a real `exePath`, `name` like "Google Chrome", `state: "active"`, plausible `volume`, plus a `System sounds` row with `exePath: null`. Mute the app in the Windows mixer, re-run, expect `"mute": true`.

- [ ] **Step 5: Commit**

```bash
git add audioctl/Commands/SessionsCommand.cs audioctl/Interop/ProcessInfo.cs audioctl/Program.cs
git commit -m "feat(audioctl): add sessions command listing per-app audio sessions"
```

---

### Task 3: `set-app-volume` / `mute-app` / `unmute-app` (C#)

**Files:**
- Create: `audioctl/Commands/AppVolumeCommand.cs`
- Modify: `audioctl/Program.cs`

**Interfaces:**
- Consumes: Task 1's wrappers.
- Produces: CLI verbs `set-app-volume <0-100> <sessionId...>`, `mute-app <sessionId...>`, `unmute-app <sessionId...>` - consumed by Task 5's `Audioctl.setAppVolume/setAppMute`. Success payload `{ok: true, command, id}`; zero matched sessions is `{ok: false, error: "no matching audio session"}`.

- [ ] **Step 1: Create AppVolumeCommand.cs**

```csharp
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// set-app-volume <0-100> <sessionId...>, mute-app/unmute-app <sessionId...>:
// ISimpleAudioVolume on every named session of the default render endpoint. One
// spawn covers a whole app group, so a grouped fader write is atomic.
internal static class AppVolumeCommand
{
    private const int RoleConsole = 0;

    public static int RunSetVolume(string levelArg, string[] ids)
    {
        if (!int.TryParse(levelArg, out int level) || level is < 0 or > 100)
            return JsonOut.Error("volume must be an integer between 0 and 100");
        return Apply(ids, volume => volume.SetMasterVolume(level / 100f), "set-app-volume");
    }

    public static int RunSetMute(bool mute, string[] ids)
        => Apply(ids, volume => volume.SetMute(mute), mute ? "mute-app" : "unmute-app");

    private static int Apply(string[] ids, Action<SimpleAudioVolume> action, string command)
    {
        var wanted = new HashSet<string>(ids, StringComparer.Ordinal);
        int matched = 0;
        using var enumerator = DeviceEnumerator.Create();
        if (enumerator.TryGetDefaultEndpoint(DataFlow.Render, RoleConsole, out Device device))
        {
            using (device)
            {
                using var manager = AudioSessionManager.From(device);
                using var sessions = manager.GetSessionEnumerator();
                int count = sessions.GetCount();
                for (int i = 0; i < count; i++)
                {
                    using var control = sessions.GetSession(i);
                    if (!control.TryGetControl2(out var control2)) continue;
                    string id;
                    using (control2) id = control2.GetSessionInstanceIdentifier();
                    if (!wanted.Contains(id)) continue;
                    if (!control.TryGetSimpleVolume(out var volume)) continue;
                    using (volume) action(volume);
                    matched++;
                }
            }
        }
        // Sessions can die between the UI's poll and the click. Touching any of
        // the named ones is success; reaching none means the target is gone.
        return matched > 0 ? JsonOut.Success(command, ids[0]) : JsonOut.Error("no matching audio session");
    }
}
```

- [ ] **Step 2: Wire the verbs into Program.cs**

```csharp
["set-app-volume", var level, .. var appIds] when appIds.Length > 0 => AppVolumeCommand.RunSetVolume(level, appIds),
["mute-app", .. var muteIds] when muteIds.Length > 0 => AppVolumeCommand.RunSetMute(true, muteIds),
["unmute-app", .. var unmuteIds] when unmuteIds.Length > 0 => AppVolumeCommand.RunSetMute(false, unmuteIds),
```

Usage lines:
```
  set-app-volume <0-100> <sessionId...>  set app session volume(s)
  mute-app <sessionId...> | unmute-app <sessionId...>  set app session mute
```

- [ ] **Step 3: Build and smoke-verify the sync both ways**

Run `dotnet build -c Release`; with audio playing, take a session `id` from `audioctl.exe sessions`, then:
- `audioctl.exe set-app-volume 30 "<id>"` -> `{ok: true...}`; open the Windows Settings volume mixer and confirm the app's slider reads 30.
- `audioctl.exe mute-app "<id>"` -> the app goes silent and shows muted in the Windows mixer.
- `audioctl.exe unmute-app "<id>" "not-a-real-id"` -> `{ok: true...}` (partial match is success).
- `audioctl.exe mute-app "not-a-real-id"` -> `{ok: false, error: "no matching audio session"}` with exit code 1.

- [ ] **Step 4: Commit**

```bash
git add audioctl/Commands/AppVolumeCommand.cs audioctl/Program.cs
git commit -m "feat(audioctl): add per-app volume and mute commands"
```

---

### Task 4: `app-icon` command (C#)

**Files:**
- Create: `audioctl/Interop/ShellIcon.cs`
- Create: `audioctl/Interop/Gdi.cs`
- Create: `audioctl/Output/PngWriter.cs`
- Create: `audioctl/Commands/AppIconCommand.cs`
- Modify: `audioctl/Program.cs`

**Interfaces:**
- Consumes: `ComRuntime.Slot/Release`.
- Produces: CLI verb `app-icon <exePath> <outPng> <size>` writing a straight-alpha RGBA PNG - consumed by Task 7's `AppIconCache` via Task 5's `Audioctl.appIcon`.

- [ ] **Step 1: Create Gdi.cs**

```csharp
using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// GDI plumbing for ShellIcon: pull the pixels out of an HBITMAP as straight RGBA.
internal static class Gdi
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Bitmap
    {
        public int Type, Width, Height, WidthBytes;
        public ushort Planes, BitsPixel;
        public IntPtr Bits;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BitmapInfoHeader
    {
        public int Size, Width, Height;
        public ushort Planes, BitCount;
        public int Compression, SizeImage, XPels, YPels, ClrUsed, ClrImportant;
    }

    // BITMAPINFO with room for the color table GetDIBits may write for BI_RGB.
    [StructLayout(LayoutKind.Sequential)]
    private struct FullBitmapInfo
    {
        public BitmapInfoHeader Header;
        public uint Color0, Color1, Color2;
    }

    [DllImport("gdi32", CharSet = CharSet.Unicode)]
    private static extern int GetObjectW(IntPtr handle, int size, out Bitmap bitmap);

    [DllImport("gdi32")]
    private static extern int GetDIBits(IntPtr dc, IntPtr bitmap, uint start, uint lines, byte[] bits,
        ref FullBitmapInfo info, uint usage);

    [DllImport("gdi32")]
    public static extern bool DeleteObject(IntPtr handle);

    [DllImport("user32")]
    private static extern IntPtr GetDC(IntPtr window);

    [DllImport("user32")]
    private static extern int ReleaseDC(IntPtr window, IntPtr dc);

    public static (int Width, int Height, byte[] Rgba)? ReadRgba(IntPtr hbitmap)
    {
        if (GetObjectW(hbitmap, Marshal.SizeOf<Bitmap>(), out Bitmap bm) == 0) return null;
        int width = bm.Width;
        int height = Math.Abs(bm.Height);
        if (width <= 0 || height <= 0) return null;

        var info = new FullBitmapInfo
        {
            Header = new BitmapInfoHeader
            {
                Size = Marshal.SizeOf<BitmapInfoHeader>(),
                Width = width,
                Height = -height, // negative height requests top-down rows
                Planes = 1,
                BitCount = 32,
                Compression = 0, // BI_RGB
            },
        };
        var bgra = new byte[width * height * 4];
        IntPtr dc = GetDC(IntPtr.Zero);
        try
        {
            if (GetDIBits(dc, hbitmap, 0, (uint)height, bgra, ref info, 0) == 0) return null;
        }
        finally
        {
            ReleaseDC(IntPtr.Zero, dc);
        }

        // A 32bpp bitmap whose alpha channel is entirely zero is an opaque image
        // in a format that never wrote alpha; honoring the zeros would make the
        // whole icon invisible.
        bool anyAlpha = false;
        for (int i = 3; i < bgra.Length; i += 4)
        {
            if (bgra[i] != 0)
            {
                anyAlpha = true;
                break;
            }
        }

        // The shell hands back premultiplied BGRA (made for AlphaBlend); PNG
        // stores straight RGBA.
        var rgba = new byte[bgra.Length];
        for (int i = 0; i < bgra.Length; i += 4)
        {
            byte b = bgra[i], g = bgra[i + 1], r = bgra[i + 2];
            byte a = anyAlpha ? bgra[i + 3] : (byte)255;
            if (a != 0 && a != 255)
            {
                r = (byte)Math.Min(255, r * 255 / a);
                g = (byte)Math.Min(255, g * 255 / a);
                b = (byte)Math.Min(255, b * 255 / a);
            }
            rgba[i] = r;
            rgba[i + 1] = g;
            rgba[i + 2] = b;
            rgba[i + 3] = a;
        }
        return (width, height, rgba);
    }
}
```

- [ ] **Step 2: Create ShellIcon.cs**

```csharp
using System.Runtime.InteropServices;

namespace AudioCtl.Interop;

// Shell icon extraction: SHCreateItemFromParsingName straight to
// IShellItemImageFactory (IID BCC18B79-BA16-442F-80C4-8A59C30C463B), GetImage with
// SIIGBF_ICONONLY. 256 px source keeps icons crisp on high-DPI displays.
internal static unsafe class ShellIcon
{
    private static readonly Guid IidImageFactory = new("BCC18B79-BA16-442F-80C4-8A59C30C463B");

    private const int SiigbfBiggerSizeOk = 0x1;
    private const int SiigbfIconOnly = 0x4;

    [DllImport("shell32", CharSet = CharSet.Unicode)]
    private static extern int SHCreateItemFromParsingName(string path, IntPtr bindCtx, in Guid iid, out IntPtr item);

    [StructLayout(LayoutKind.Sequential)]
    private struct Size
    {
        public int Cx, Cy;
    }

    public static (int Width, int Height, byte[] Rgba)? Extract(string exePath, int size)
    {
        if (SHCreateItemFromParsingName(exePath, IntPtr.Zero, IidImageFactory, out IntPtr factory) < 0)
            return null;
        try
        {
            IntPtr hbitmap;
            var wanted = new Size { Cx = size, Cy = size };
            // Slot 3: GetImage(SIZE, int flags, out HBITMAP)
            int hr = ((delegate* unmanaged<IntPtr, Size, int, IntPtr*, int>)ComRuntime.Slot(factory, 3))(
                factory, wanted, SiigbfIconOnly | SiigbfBiggerSizeOk, &hbitmap);
            if (hr < 0) return null;
            try
            {
                return Gdi.ReadRgba(hbitmap);
            }
            finally
            {
                Gdi.DeleteObject(hbitmap);
            }
        }
        finally
        {
            ComRuntime.Release(factory);
        }
    }
}
```

- [ ] **Step 3: Create PngWriter.cs**

```csharp
using System.Buffers.Binary;
using System.IO.Compression;

namespace AudioCtl.Output;

// Minimal PNG encoder (8-bit RGBA, filter None, no interlace): NativeAOT ships no
// imaging library, and one fixed format is all app-icon needs.
internal static class PngWriter
{
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly uint[] CrcTable = BuildCrcTable();

    public static byte[] Write(int width, int height, byte[] rgba)
    {
        if (rgba.Length != width * height * 4)
            throw new ArgumentException("pixel buffer does not match dimensions");

        using var output = new MemoryStream();
        output.Write(Signature);

        Span<byte> ihdr = stackalloc byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr, width);
        BinaryPrimitives.WriteInt32BigEndian(ihdr[4..], height);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 6; // color type RGBA
        WriteChunk(output, "IHDR", ihdr);

        // Raw stream: each scanline prefixed with filter byte 0 (None).
        int stride = width * 4;
        var raw = new byte[height * (1 + stride)];
        for (int y = 0; y < height; y++)
            rgba.AsSpan(y * stride, stride).CopyTo(raw.AsSpan(y * (1 + stride) + 1));
        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
        {
            zlib.Write(raw);
        }
        WriteChunk(output, "IDAT", compressed.ToArray());

        WriteChunk(output, "IEND", ReadOnlySpan<byte>.Empty);
        return output.ToArray();
    }

    private static void WriteChunk(Stream output, string type, ReadOnlySpan<byte> data)
    {
        Span<byte> header = stackalloc byte[8];
        BinaryPrimitives.WriteInt32BigEndian(header, data.Length);
        for (int i = 0; i < 4; i++) header[4 + i] = (byte)type[i];
        output.Write(header);
        output.Write(data);
        uint crc = 0xFFFFFFFFu;
        foreach (byte b in header[4..]) crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        foreach (byte b in data) crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc ^ 0xFFFFFFFFu);
        output.Write(crcBytes);
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            uint c = n;
            for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[n] = c;
        }
        return table;
    }
}
```

- [ ] **Step 4: Create AppIconCommand.cs and wire it in**

```csharp
using AudioCtl.Interop;
using AudioCtl.Output;

namespace AudioCtl.Commands;

// app-icon <exePath> <outPng> <size>: the shell icon of a file, written as a PNG.
internal static class AppIconCommand
{
    public static int Run(string exePath, string outPng, string sizeArg)
    {
        if (!int.TryParse(sizeArg, out int size) || size is < 16 or > 1024)
            return JsonOut.Error("size must be an integer between 16 and 1024");
        if (!File.Exists(exePath)) return JsonOut.Error($"no file at {exePath}");
        if (ShellIcon.Extract(exePath, size) is not { } icon)
            return JsonOut.Error("the shell produced no icon for this file");
        File.WriteAllBytes(outPng, PngWriter.Write(icon.Width, icon.Height, icon.Rgba));
        return JsonOut.Success("app-icon", exePath);
    }
}
```

Program.cs: `["app-icon", var exe, var png, var iconSize] => AppIconCommand.Run(exe, png, iconSize),` plus usage line `  app-icon <exePath> <outPng> <size>  extract a file's shell icon as PNG`.

- [ ] **Step 5: Build and smoke-verify**

Run `dotnet build -c Release`, then:
`audioctl.exe app-icon "C:\Program Files\Google\Chrome\Application\chrome.exe" "%TEMP%\chrome-icon.png" 256`
Expected: `{ok: true...}`; open the PNG - correct colors (not washed out or double-darkened: that is the premultiply direction, flip the un-premultiply if wrong), transparent corners, sharp at 256 px. Also verify an exe with no custom icon still produces the generic-exe icon.

- [ ] **Step 6: Publish the helper for the TS-side tasks**

Run the publish per Global Constraints so `audioctl/bin/x64/Release/net8.0/win-x64/publish/audioctl.exe` carries all new verbs. Verify: `audioctl.exe` (no args) usage text lists `sessions`, `set-app-volume`, `mute-app`, `unmute-app`, `app-icon`.

- [ ] **Step 7: Commit**

```bash
git add audioctl/Commands/AppIconCommand.cs audioctl/Interop/ShellIcon.cs audioctl/Interop/Gdi.cs audioctl/Output/PngWriter.cs audioctl/Program.cs
git commit -m "feat(audioctl): add app-icon shell icon extraction"
```

---

### Task 5: AudioControl surface + mock backend (TS)

**Files:**
- Modify: `electron/audioctl.ts`
- Modify: `electron/mock-backend.ts`

**Interfaces:**
- Consumes: Task 2-4's CLI verbs.
- Produces (used by Tasks 6-8):

```ts
export type AppSessionState = "active" | "inactive";
export interface AppSession {
  id: string;
  pid: number;
  exePath: string | null;
  name: string;
  state: AppSessionState;
  isSystemSounds: boolean;
  volume: number; // 0-100
  mute: boolean;
}
// added to AudioControl:
sessions(): Promise<AppSession[]>;
setAppVolume(sessionIds: string[], level: number): Promise<void>;
setAppMute(sessionIds: string[], mute: boolean): Promise<void>;
appIcon(exePath: string, outPath: string, size: number): Promise<void>;
```

- [ ] **Step 1: Extend audioctl.ts**

Add the `AppSession` types (doc comment: one WASAPI session on the default output; `id` is the session instance identifier the set commands match on). Extend the `AudioControl` interface with the four methods above. Implement in `Audioctl`:

```ts
  async sessions(): Promise<AppSession[]> {
    const result = await this.run(["sessions"]);
    if (!Array.isArray(result)) {
      throw new AudioctlError("audioctl sessions did not return a JSON array", ["sessions"], 0, "");
    }
    return result as AppSession[];
  }

  async setAppVolume(sessionIds: string[], level: number): Promise<void> {
    if (!Number.isInteger(level) || level < 0 || level > 100) {
      throw new RangeError(`volume must be an integer 0-100, got ${level}`);
    }
    if (sessionIds.length === 0) throw new RangeError("at least one session id is required");
    await this.run(["set-app-volume", String(level), ...sessionIds]);
  }

  async setAppMute(sessionIds: string[], mute: boolean): Promise<void> {
    if (sessionIds.length === 0) throw new RangeError("at least one session id is required");
    await this.run([mute ? "mute-app" : "unmute-app", ...sessionIds]);
  }

  async appIcon(exePath: string, outPath: string, size: number): Promise<void> {
    await this.run(["app-icon", exePath, outPath, String(size)]);
  }
```

- [ ] **Step 2: Add fixture sessions to MockAudioctl**

In `mock-backend.ts`, import `AppSession` and add:

```ts
// Two Chrome sessions on one exe prove the Mixer's grouping; the mock has no
// icons on purpose, so e2e exercises the fallback glyphs.
function fixtureSessions(): AppSession[] {
  return [
    {
      id: "mock-sess-system",
      pid: 0,
      exePath: null,
      name: "System sounds",
      state: "inactive",
      isSystemSounds: true,
      volume: 60,
      mute: false,
    },
    {
      id: "mock-sess-chrome-1",
      pid: 4242,
      exePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      name: "Google Chrome",
      state: "active",
      isSystemSounds: false,
      volume: 80,
      mute: false,
    },
    {
      id: "mock-sess-chrome-2",
      pid: 4243,
      exePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      name: "Google Chrome",
      state: "inactive",
      isSystemSounds: false,
      volume: 80,
      mute: false,
    },
    {
      id: "mock-sess-spotify",
      pid: 5150,
      exePath: "C:\\Users\\Mock\\AppData\\Roaming\\Spotify\\Spotify.exe",
      name: "Spotify",
      state: "active",
      isSystemSounds: false,
      volume: 45,
      mute: false,
    },
  ];
}
```

And in the `MockAudioctl` class:

```ts
  private appSessions: AppSession[] = fixtureSessions();

  async sessions(): Promise<AppSession[]> {
    return this.appSessions.map((s) => ({ ...s }));
  }

  async setAppVolume(sessionIds: string[], level: number): Promise<void> {
    let matched = 0;
    for (const s of this.appSessions) {
      if (!sessionIds.includes(s.id)) continue;
      s.volume = level;
      matched++;
    }
    if (matched === 0) throw new Error("no matching audio session");
  }

  async setAppMute(sessionIds: string[], mute: boolean): Promise<void> {
    let matched = 0;
    for (const s of this.appSessions) {
      if (!sessionIds.includes(s.id)) continue;
      s.mute = mute;
      matched++;
    }
    if (matched === 0) throw new Error("no matching audio session");
  }

  async appIcon(): Promise<void> {
    throw new Error("mock backend has no icons");
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (both implementers satisfy the extended interface).

- [ ] **Step 4: Commit**

```bash
git add electron/audioctl.ts electron/mock-backend.ts
git commit -m "feat(electron): extend AudioControl with app sessions and icons"
```

---

### Task 6: Session grouping (TS, TDD)

**Files:**
- Create: `electron/mixer.ts`
- Test: `electron/mixer.test.ts`

**Interfaces:**
- Consumes: `AppSession` from Task 5; `MixerAppView` type is defined here-adjacent in Task 8's shared/ipc.ts - for this task, define `MixerAppView` in `shared/ipc.ts` NOW (Task 8 only adds the API/channel entries):

```ts
/** One Mixer row: an app's grouped sessions on the default output. */
export interface MixerAppView {
  /** Stable row key: "system", the exe path lowercased, or "pid:<pid>". */
  key: string;
  name: string;
  /** For icon lookup; null for system sounds and unreadable processes. */
  exePath: string | null;
  isSystemSounds: boolean;
  /** 0-100; the loudest member session (they normally agree). */
  volume: number;
  /** True only when every member session is muted. */
  mute: boolean;
  /** True while any member session is actively playing. */
  active: boolean;
  /** Session instance ids a write fans out to. */
  sessionIds: string[];
}
```

- Produces: `groupSessions(sessions: readonly AppSession[]): MixerAppView[]` - used by Task 8's `getMixer` handler.

- [ ] **Step 1: Write the failing tests** (`electron/mixer.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { groupSessions } from "./mixer.js";
import type { AppSession } from "./audioctl.js";

function session(over: Partial<AppSession>): AppSession {
  return {
    id: "s1",
    pid: 100,
    exePath: "C:\\Apps\\one.exe",
    name: "One",
    state: "active",
    isSystemSounds: false,
    volume: 50,
    mute: false,
    ...over,
  };
}

describe("groupSessions", () => {
  it("groups sessions of the same exe case-insensitively", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: "C:\\Apps\\chrome.exe" }),
      session({ id: "b", exePath: "c:\\apps\\CHROME.EXE" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionIds).toEqual(["a", "b"]);
  });

  it("pins system sounds first, then sorts by name", () => {
    const rows = groupSessions([
      session({ id: "z", name: "Zebra", exePath: "C:\\z.exe" }),
      session({ id: "a", name: "Alpha", exePath: "C:\\a.exe" }),
      session({ id: "sys", name: "System sounds", exePath: null, isSystemSounds: true, pid: 0 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["System sounds", "Alpha", "Zebra"]);
    expect(rows[0].key).toBe("system");
  });

  it("aggregates volume as max, mute as every, active as some", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: "C:\\x.exe", volume: 30, mute: true, state: "inactive" }),
      session({ id: "b", exePath: "C:\\x.exe", volume: 70, mute: false, state: "active" }),
    ]);
    expect(rows[0].volume).toBe(70);
    expect(rows[0].mute).toBe(false);
    expect(rows[0].active).toBe(true);
  });

  it("keeps sessions without an exe path as separate pid-keyed rows", () => {
    const rows = groupSessions([
      session({ id: "a", exePath: null, pid: 11, name: "App 11" }),
      session({ id: "b", exePath: null, pid: 22, name: "App 22" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key).sort()).toEqual(["pid:11", "pid:22"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run electron/mixer.test.ts`
Expected: FAIL (cannot resolve `./mixer.js`).

- [ ] **Step 3: Implement electron/mixer.ts**

```ts
// Pure grouping of raw audio sessions into Mixer rows, the way the Windows
// volume mixer presents them: one row per app, System sounds pinned first.

import type { AppSession } from "./audioctl.js";
import type { MixerAppView } from "../shared/ipc.js";

export function groupSessions(sessions: readonly AppSession[]): MixerAppView[] {
  const groups = new Map<string, AppSession[]>();
  for (const session of sessions) {
    const key = session.isSystemSounds
      ? "system"
      : (session.exePath?.toLowerCase() ?? `pid:${session.pid}`);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [session]);
    else list.push(session);
  }

  const rows: MixerAppView[] = [];
  for (const [key, members] of groups) {
    rows.push({
      key,
      name: members.find((m) => m.name !== "")?.name ?? `App ${members[0].pid}`,
      exePath: members.find((m) => m.exePath !== null)?.exePath ?? null,
      isSystemSounds: key === "system",
      volume: Math.max(...members.map((m) => m.volume)),
      mute: members.every((m) => m.mute),
      active: members.some((m) => m.state === "active"),
      sessionIds: members.map((m) => m.id),
    });
  }
  rows.sort((a, b) => {
    if (a.isSystemSounds !== b.isSystemSounds) return a.isSystemSounds ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return rows;
}
```

Also add the `MixerAppView` interface (from this task's Interfaces block) to `shared/ipc.ts` next to `DeviceView`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/mixer.test.ts` - Expected: PASS. Then `npm run typecheck` - PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/mixer.ts electron/mixer.test.ts shared/ipc.ts
git commit -m "feat(electron): group audio sessions into mixer rows"
```

---

### Task 7: App icon cache (TS, TDD)

**Files:**
- Create: `electron/icons.ts`
- Test: `electron/icons.test.ts`

**Interfaces:**
- Consumes: `AudioControl.appIcon` from Task 5.
- Produces: `iconCacheKey(exePath: string, mtimeMs: number): string`; `class AppIconCache { constructor(deps: { audioctl: AudioControl; cacheDir: string }); dataUrl(exePath: string): Promise<string | null> }` - used by Task 8.

- [ ] **Step 1: Write the failing tests** (`electron/icons.test.ts`)

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppIconCache, iconCacheKey } from "./icons.js";
import type { AudioControl } from "./audioctl.js";

describe("iconCacheKey", () => {
  it("is stable and case-insensitive on the path", () => {
    expect(iconCacheKey("C:\\Apps\\x.exe", 123)).toBe(iconCacheKey("c:\\apps\\X.EXE", 123));
  });

  it("changes when the exe changes (mtime)", () => {
    expect(iconCacheKey("C:\\Apps\\x.exe", 123)).not.toBe(iconCacheKey("C:\\Apps\\x.exe", 456));
  });
});

describe("AppIconCache", () => {
  let dir: string;
  let exe: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "audiodeck-icons-"));
    exe = path.join(dir, "fake.exe");
    await writeFile(exe, "not a real exe");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function fakeAudioctl(calls: string[]): AudioControl {
    return {
      appIcon: async (_exePath: string, outPath: string) => {
        calls.push(outPath);
        await writeFile(outPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      },
    } as unknown as AudioControl;
  }

  it("extracts once and serves a data URL from cache after", async () => {
    const calls: string[] = [];
    const cache = new AppIconCache({ audioctl: fakeAudioctl(calls), cacheDir: path.join(dir, "cache") });
    const first = await cache.dataUrl(exe);
    const second = await cache.dataUrl(exe);
    expect(first).toMatch(/^data:image\/png;base64,/);
    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it("caches extraction failure as null without retrying", async () => {
    let attempts = 0;
    const failing = {
      appIcon: async () => {
        attempts++;
        throw new Error("no icon");
      },
    } as unknown as AudioControl;
    const cache = new AppIconCache({ audioctl: failing, cacheDir: path.join(dir, "cache") });
    expect(await cache.dataUrl(exe)).toBeNull();
    expect(await cache.dataUrl(exe)).toBeNull();
    expect(attempts).toBe(1);
  });

  it("returns null for a missing exe without calling the helper", async () => {
    const calls: string[] = [];
    const cache = new AppIconCache({ audioctl: fakeAudioctl(calls), cacheDir: path.join(dir, "cache") });
    expect(await cache.dataUrl(path.join(dir, "gone.exe"))).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run electron/icons.test.ts` - Expected: FAIL (cannot resolve `./icons.js`).

- [ ] **Step 3: Implement electron/icons.ts**

```ts
// Disk + memory cache of app icon data URLs, extracted by `audioctl app-icon`.
// Icons only change when the exe does, so the key carries the file's mtime and
// a hit costs one readFile per app per run.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AudioControl } from "./audioctl.js";

/** 256 px source: crisp at any display scale; the renderer scales down. */
const ICON_SIZE = 256;

export function iconCacheKey(exePath: string, mtimeMs: number): string {
  return createHash("sha1").update(`${exePath.toLowerCase()}|${mtimeMs}`).digest("hex");
}

export class AppIconCache {
  /** exePath (lowercased) -> data URL, or null when extraction failed once. */
  private readonly memo = new Map<string, string | null>();

  constructor(private readonly deps: { audioctl: AudioControl; cacheDir: string }) {}

  async dataUrl(exePath: string): Promise<string | null> {
    const memoKey = exePath.toLowerCase();
    const memoized = this.memo.get(memoKey);
    if (memoized !== undefined) return memoized;
    let url: string | null;
    try {
      const { mtimeMs } = await stat(exePath);
      const file = path.join(this.deps.cacheDir, `${iconCacheKey(exePath, mtimeMs)}.png`);
      let bytes: Buffer;
      try {
        bytes = await readFile(file);
      } catch {
        await mkdir(this.deps.cacheDir, { recursive: true });
        await this.deps.audioctl.appIcon(exePath, file, ICON_SIZE);
        bytes = await readFile(file);
      }
      url = `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      // "No icon" is a stable answer; caching it keeps every poll from retrying.
      url = null;
    }
    this.memo.set(memoKey, url);
    return url;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/icons.test.ts` - Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/icons.ts electron/icons.test.ts
git commit -m "feat(electron): cache app icons extracted by audioctl"
```

---

### Task 8: IPC contract and handlers

**Files:**
- Modify: `shared/ipc.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts` (the `registerIpc(...)` call site)
- Modify: `src/renderer/src/useAppState.ts`

**Interfaces:**
- Consumes: `groupSessions` (Task 6), `AppIconCache` (Task 7), `AudioControl.sessions/setAppVolume/setAppMute` (Task 5).
- Produces (used by Tasks 10-11): `AudioDeckApi.getMixer(): Promise<MixerState>`, `.setAppVolume(sessionIds: string[], level: number)`, `.setAppMute(sessionIds: string[], mute: boolean)`, `.getAppIcon(exePath: string): Promise<string | null>`; `interface MixerState { apps: MixerAppView[] }`; channels `audiodeck:get-mixer`, `audiodeck:set-app-volume`, `audiodeck:set-app-mute`, `audiodeck:get-app-icon`; `IpcDeps.icons: AppIconCache`.

- [ ] **Step 1: shared/ipc.ts**

Add next to `MixerAppView`:

```ts
/** The Mixer tab's poll payload; separate from AppState so the daemon never
 *  gathers sessions while the window is closed. */
export interface MixerState {
  apps: MixerAppView[];
}
```

Add to `AudioDeckApi` (after `setEndpointEnabled`):

```ts
  /** Apps with audio sessions on the default output, grouped for the Mixer tab. */
  getMixer(): Promise<MixerState>;
  /** Set every named session's volume in one helper spawn. */
  setAppVolume(sessionIds: string[], level: number): Promise<void>;
  setAppMute(sessionIds: string[], mute: boolean): Promise<void>;
  /** PNG data URL of the app's icon; null when it cannot be extracted. */
  getAppIcon(exePath: string): Promise<string | null>;
```

Add to `IPC`:

```ts
  getMixer: "audiodeck:get-mixer",
  setAppVolume: "audiodeck:set-app-volume",
  setAppMute: "audiodeck:set-app-mute",
  getAppIcon: "audiodeck:get-app-icon",
```

- [ ] **Step 2: electron/ipc.ts handlers**

Add `icons: AppIconCache;` to `IpcDeps` (import from `./icons.js`; import `groupSessions` from `./mixer.js` and `MixerState` from `../shared/ipc.js`). Inside `registerIpc`, add:

```ts
  // Exe paths the last sessions poll actually reported. getAppIcon serves only
  // these, so the renderer cannot probe arbitrary files for icons.
  const iconableExes = new Set<string>();

  ipcMain.handle(IPC.getMixer, async (): Promise<MixerState> => {
    const sessions = await audioctl.sessions();
    for (const s of sessions) {
      if (s.exePath !== null) iconableExes.add(s.exePath.toLowerCase());
    }
    return { apps: groupSessions(sessions) };
  });

  ipcMain.handle(IPC.setAppVolume, async (_e, sessionIds: string[], level: number) => {
    const ids = Array.isArray(sessionIds) ? sessionIds.filter((id) => typeof id === "string") : [];
    if (ids.length === 0 || typeof level !== "number" || !Number.isFinite(level)) return;
    await audioctl.setAppVolume(ids, Math.min(100, Math.max(0, Math.round(level))));
  });

  ipcMain.handle(IPC.setAppMute, async (_e, sessionIds: string[], mute: boolean) => {
    const ids = Array.isArray(sessionIds) ? sessionIds.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return;
    await audioctl.setAppMute(ids, mute === true);
  });

  ipcMain.handle(IPC.getAppIcon, async (_e, exePath: string): Promise<string | null> => {
    if (typeof exePath !== "string" || !iconableExes.has(exePath.toLowerCase())) return null;
    return deps.icons.dataUrl(exePath);
  });
```

- [ ] **Step 3: electron/main.ts wiring**

At the `registerIpc({ ... })` call, construct and pass the cache (imports: `AppIconCache` from `./icons.js`, `path`, `app` are already there or trivial):

```ts
icons: new AppIconCache({ audioctl, cacheDir: path.join(app.getPath("userData"), "icon-cache") }),
```

(`audioctl` here is whatever instance main already passes as `deps.audioctl` - real or mock; reuse that exact variable.)

- [ ] **Step 4: preload.ts**

```ts
  getMixer: () => ipcRenderer.invoke(IPC.getMixer),
  setAppVolume: (sessionIds: string[], level: number) =>
    ipcRenderer.invoke(IPC.setAppVolume, sessionIds, level),
  setAppMute: (sessionIds: string[], mute: boolean) =>
    ipcRenderer.invoke(IPC.setAppMute, sessionIds, mute),
  getAppIcon: (exePath: string) => ipcRenderer.invoke(IPC.getAppIcon, exePath),
```

- [ ] **Step 5: useAppState.ts pass-throughs**

The `actionsRef` object must satisfy the widened `AudioDeckApi`. Mixer calls are queries plus actions the MixerView refreshes itself, so they are NOT wrapped (wrapping would trigger a full AppState refresh for no reader):

```ts
      getMixer: () => api.getMixer(),
      setAppVolume: (ids, level) => api.setAppVolume(ids, level),
      setAppMute: (ids, mute) => api.setAppMute(ids, mute),
      getAppIcon: (exePath) => api.getAppIcon(exePath),
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck` - PASS. Run: `npm test` - PASS (existing suites unaffected).

- [ ] **Step 7: Commit**

```bash
git add shared/ipc.ts electron/ipc.ts electron/preload.ts electron/main.ts src/renderer/src/useAppState.ts
git commit -m "feat(ipc): expose mixer state, per-app volume/mute, app icons"
```

---

### Task 9: Extract the generic Fader (renderer refactor)

**Files:**
- Create: `src/renderer/src/components/Fader.tsx`
- Modify: `src/renderer/src/components/VolumeFader.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Fader({ value, muted, ariaLabel, onCommit }: { value: number; muted: boolean; ariaLabel: string; onCommit: (v: number) => void })` rendering the same two grid cells (`.vol` meter + `.volume-value`) - used by Task 10's app rows. `VolumeFader`'s external contract (props `{device, actions}`, rendered markup) is unchanged.

- [ ] **Step 1: Create Fader.tsx**

Move the entire body of `VolumeFader.tsx` (Meter, SEGMENTS, COMMIT_DELAY_MS, the optimistic-drag/debounce/flush logic, the two-cell render) into `Fader.tsx`, generalized: `device.volume ?? 0` becomes the `value` prop, `device.mute === true` becomes `muted`, the aria-label becomes `ariaLabel`, and `commit.current` calls the `onCommit` prop (kept in a ref, reassigned every render, exactly like the current `commit.current = ...` line). The header comment moves with it; the follow-external-updates effect keys on `value`.

- [ ] **Step 2: Reduce VolumeFader.tsx to a wrapper**

```tsx
// Device-row binding of the shared Fader: same optimistic meter, committing
// through setVolume for one endpoint.

import { Fader } from "./Fader.js";
import type { AudioDeckApi, DeviceView } from "../../../../shared/ipc.js";

export function VolumeFader({ device, actions }: { device: DeviceView; actions: AudioDeckApi }) {
  return (
    <Fader
      value={device.volume ?? 0}
      muted={device.mute === true}
      ariaLabel={`${device.name} volume`}
      onCommit={(v) => void actions.setVolume(device.id, v)}
    />
  );
}
```

- [ ] **Step 3: Verify no behavior change**

Run: `npm run typecheck` and `npm test` - PASS. Then `npm run e2e` - the existing device-fader e2e coverage must stay green before anything is built on Fader.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Fader.tsx src/renderer/src/components/VolumeFader.tsx
git commit -m "refactor(renderer): extract the generic Fader from VolumeFader"
```

---

### Task 10: MixerView and tab wiring

**Files:**
- Create: `src/renderer/src/useMixer.ts`
- Create: `src/renderer/src/components/AppIcon.tsx`
- Create: `src/renderer/src/views/MixerView.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

**Interfaces:**
- Consumes: `api.getMixer/setAppVolume/setAppMute/getAppIcon` (Task 8), `Fader` (Task 9), `VolumeFader`, `MixerAppView`.
- Produces: `MixerView({ state, actions })` view; tab `mixer` labeled "Mixer". DOM contract for e2e (Task 11): each app row is `.mixer-app` containing the app name, a slider with aria-label `<name> volume`, a mute button with aria-label `Mute <name>` and `aria-pressed`.

- [ ] **Step 1: Create useMixer.ts**

```ts
// The Mixer tab's own data source: polls getMixer while the tab is mounted.
// Separate from useAppState so sessions are only gathered when someone is
// looking at them; 1 s keeps external changes (the Windows mixer, an app's own
// volume UI) feeling live.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import type { MixerAppView } from "../../../shared/ipc.js";

const MIXER_POLL_MS = 1000;

export interface MixerHook {
  /** Null before the first poll answers. */
  apps: MixerAppView[] | null;
  error: string | null;
  setAppVolume: (sessionIds: string[], level: number) => Promise<void>;
  setAppMute: (sessionIds: string[], mute: boolean) => Promise<void>;
}

export function useMixer(): MixerHook {
  const [apps, setApps] = useState<MixerAppView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getMixer();
      if (!alive.current) return;
      setApps(next.apps);
      setError(null);
    } catch (err) {
      // Keep the last rows on a failed poll; a stale mixer beats a blank one.
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), MIXER_POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const act = useCallback(
    (fn: () => Promise<void>) => async () => {
      try {
        await fn();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      await refresh();
    },
    [refresh],
  );

  return {
    apps,
    error,
    setAppVolume: (ids, level) => act(() => api.setAppVolume(ids, level))(),
    setAppMute: (ids, mute) => act(() => api.setAppMute(ids, mute))(),
  };
}
```

- [ ] **Step 2: Create AppIcon.tsx**

```tsx
// An app's icon in the mixer: PNG data URL from main, fetched once per exe and
// cached for the window's life. System sounds and icon-less apps get inline SVG
// glyphs (SVG stays crisp at this machine's display scaling).

import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { MixerAppView } from "../../../../shared/ipc.js";

const iconCache = new Map<string, string | null>();

function SystemSoundsGlyph() {
  return (
    <svg className="app-icon app-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenericAppGlyph() {
  return (
    <svg className="app-icon app-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function AppIcon({ app }: { app: MixerAppView }) {
  const exe = app.exePath;
  const [url, setUrl] = useState<string | null>(exe === null ? null : (iconCache.get(exe) ?? null));

  useEffect(() => {
    if (exe === null || iconCache.has(exe)) return;
    let live = true;
    void api.getAppIcon(exe).then((dataUrl) => {
      iconCache.set(exe, dataUrl);
      if (live) setUrl(dataUrl);
    });
    return () => {
      live = false;
    };
  }, [exe]);

  if (app.isSystemSounds) return <SystemSoundsGlyph />;
  if (url === null) return <GenericAppGlyph />;
  return <img className="app-icon" src={url} alt="" draggable={false} />;
}
```

- [ ] **Step 3: Create MixerView.tsx**

```tsx
// The Mixer tab: the Windows per-app volume mixer, drawn in AudioDeck's print
// language. Master row on top (the default output device), one row per app
// under it. Same WASAPI session state as the Windows mixer, so the two can
// never disagree; external changes land on the next 1 s poll.

import { SectionLabel } from "../components/SectionLabel.js";
import { VolumeFader } from "../components/VolumeFader.js";
import { Fader } from "../components/Fader.js";
import { AppIcon } from "../components/AppIcon.js";
import { useMixer } from "../useMixer.js";
import { displayName } from "../useAppState.js";
import type { AppState, AudioDeckApi, MixerAppView } from "../../../../shared/ipc.js";

export function MixerView({ state, actions }: { state: AppState; actions: AudioDeckApi }) {
  const { apps, error, setAppVolume, setAppMute } = useMixer();
  const defaultOut = state.devices.find((d) => d.flow === "render" && d.isDefault) ?? null;

  return (
    <main className="view mixer-view">
      {error !== null ? <div className="error-banner">{error}</div> : null}

      <SectionLabel>Output</SectionLabel>
      {defaultOut === null ? (
        <p className="mixer-empty">No output device is active.</p>
      ) : (
        <div className="mixer-row mixer-master">
          <span className="mixer-name">{displayName(defaultOut)}</span>
          <VolumeFader device={defaultOut} actions={actions} />
          <MuteButton
            name={displayName(defaultOut)}
            muted={defaultOut.mute === true}
            onToggle={() => void actions.setMute(defaultOut.id, defaultOut.mute !== true)}
          />
        </div>
      )}

      <SectionLabel>Apps</SectionLabel>
      {apps === null ? (
        <p className="mixer-empty">Reading audio sessions&hellip;</p>
      ) : apps.length === 0 ? (
        <p className="mixer-empty">
          Nothing is playing. Apps appear here while they play sound on the current output.
        </p>
      ) : (
        <ul className="mixer-apps">
          {apps.map((app) => (
            <AppRow key={app.key} app={app} setAppVolume={setAppVolume} setAppMute={setAppMute} />
          ))}
        </ul>
      )}
    </main>
  );
}

function AppRow({
  app,
  setAppVolume,
  setAppMute,
}: {
  app: MixerAppView;
  setAppVolume: (ids: string[], level: number) => Promise<void>;
  setAppMute: (ids: string[], mute: boolean) => Promise<void>;
}) {
  return (
    <li className="mixer-row mixer-app" data-active={app.active}>
      <AppIcon app={app} />
      <span className="mixer-name">{app.name}</span>
      <Fader
        value={app.volume}
        muted={app.mute}
        ariaLabel={`${app.name} volume`}
        onCommit={(v) => void setAppVolume(app.sessionIds, v)}
      />
      <MuteButton
        name={app.name}
        muted={app.mute}
        onToggle={() => void setAppMute(app.sessionIds, !app.mute)}
      />
    </li>
  );
}

function MuteButton({
  name,
  muted,
  onToggle,
}: {
  name: string;
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mixer-mute"
      aria-label={`Mute ${name}`}
      aria-pressed={muted}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: Wire the tab in App.tsx**

`type ViewName = "devices" | "mixer" | "studio" | "settings";`, add `{ name: "mixer", label: "Mixer" }` after Devices in `TABS`, and render `view === "mixer" ? <MixerView state={state} actions={actions} /> : ...` in the chain.

- [ ] **Step 5: styles.css**

Add a mixer block following the existing row grammar (this step MUST be done with the impeccable + ui-ux-pro-max skills loaded, matching the Devices rows' grid, borders, and type treatment; the block below is the structural minimum, not the finished design):

```css
/* Mixer tab: master + per-app rows sharing the device-row grid language. */
.mixer-apps { list-style: none; margin: 0; padding: 0; }
.mixer-row {
  display: grid;
  grid-template-columns: 28px 1fr minmax(180px, 2fr) 3.5em auto;
  align-items: center;
  gap: 12px;
}
.mixer-master { grid-template-columns: 1fr minmax(180px, 2fr) 3.5em auto; }
.app-icon { width: 28px; height: 28px; }
.app-icon-glyph { color: currentColor; opacity: 0.75; }
.mixer-app[data-active="false"] .mixer-name { opacity: 0.6; }
.mixer-mute svg { width: 20px; height: 20px; display: block; }
.mixer-mute[aria-pressed="true"] { /* muted state treatment per design pass */ }
.mixer-empty { opacity: 0.7; }
```

- [ ] **Step 6: Verify by hand in dev**

Run: `npm run typecheck`, then `npm run dev`. On this real machine: open the Mixer tab with audio playing; confirm apps appear with real icons, dragging a fader changes that app's loudness only, the mute button silences it, the Windows Settings mixer shows the same values immediately, and a change made in the Windows mixer lands in AudioDeck within ~1 s. Check the tab at the window's minimum width (940 px).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/useMixer.ts src/renderer/src/components/AppIcon.tsx src/renderer/src/views/MixerView.tsx src/renderer/src/App.tsx src/renderer/src/styles.css
git commit -m "feat(renderer): add the Mixer tab with per-app faders and icons"
```

---

### Task 11: E2E coverage

**Files:**
- Create: `e2e/mixer.spec.ts`
- Modify (only if it enumerates tabs): `e2e/views.spec.ts`

**Interfaces:**
- Consumes: mock fixtures (Task 5), DOM contract (Task 10), `launchApp` from `e2e/helpers.ts`.
- Produces: regression coverage for grouping, pinning, mute and volume round-trips, fallback glyphs.

- [ ] **Step 1: Write e2e/mixer.spec.ts**

```ts
// Mixer tab against the mock backend: grouped rows, pinned order, and
// mute/volume round-trips through the AudioControl surface.

import { expect, test } from "@playwright/test";
import { launchApp } from "./helpers.js";

test("lists grouped apps with system sounds pinned first", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const rows = page.locator(".mixer-app");
  await expect(rows).toHaveCount(3); // system + chrome (two sessions grouped) + spotify
  await expect(rows.nth(0)).toContainText("System sounds");
  await expect(rows.nth(1)).toContainText("Google Chrome");
  await expect(rows.nth(2)).toContainText("Spotify");
  // The mock has no icons: every row falls back to an SVG glyph.
  await expect(page.locator(".mixer-app .app-icon-glyph")).toHaveCount(3);
  await close();
});

test("muting an app round-trips through the backend", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const mute = page.getByRole("button", { name: "Mute Spotify" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await close();
});

test("keyboard volume change lands and reads back", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const slider = page.getByRole("slider", { name: "Spotify volume" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mixer-app", { hasText: "Spotify" })).toContainText("46%");
  await close();
});

test("grouped volume writes hit every session of the app", async () => {
  const { page, close } = await launchApp();
  await page.getByRole("button", { name: "Mixer" }).click();
  const slider = page.getByRole("slider", { name: "Google Chrome volume" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  // Group volume is the max of both mock sessions; if only one had been
  // written, the shown value would snap back to 80 on the next poll.
  await expect(page.locator(".mixer-app", { hasText: "Google Chrome" })).toContainText("79%");
  await close();
});
```

- [ ] **Step 2: Check views.spec.ts**

Read `e2e/views.spec.ts`; if it asserts the tab set or iterates tabs, add "Mixer" so it stays green. If it does not, leave it untouched.

- [ ] **Step 3: Run the suites**

Run: `npm run e2e` - Expected: all specs PASS, including the pre-existing ones.

- [ ] **Step 4: Commit**

```bash
git add e2e/mixer.spec.ts e2e/views.spec.ts
git commit -m "test(e2e): cover the mixer tab against the mock backend"
```

---

### Task 12: Version, README, gates

**Files:**
- Modify: `package.json` (version)
- Modify: `README.md` (feature list)

- [ ] **Step 1: Bump the version**

`package.json`: `"version": "0.1.0"` -> `"version": "0.2.0"` (minor; this is a feature).

- [ ] **Step 2: README**

Add a Mixer line to the feature list, matching the README's existing voice, e.g.: "Mixer - per-app volume and mute for the current output, synced live with the Windows volume mixer, with app icons." Update any screenshot/tab enumeration the README carries.

- [ ] **Step 3: Full gates**

Run: `npm run typecheck` && `npm test` && `npm run e2e`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore(release): bump to 0.2.0 for the mixer tab"
```

---

### Task 13: PR, hands-on install, merge question

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/<issue#>-mixer-tab
gh pr create --title "feat: Mixer tab with per-app volume, mute, and icons" --body "..."
```

Body: closes the issue, summarizes per the spec, notes the audioctl binary must be re-published in release builds (release.yml already builds it - verify the workflow includes the `dotnet publish` step and that `scripts/check-bundle-inputs.mjs` passes), ends with the standard generated-with footer.

- [ ] **Step 2: Confirm CI is green** (`gh pr checks --watch`).

- [ ] **Step 3: Install the branch build locally for hands-on testing**

Run: `npm run dist` (requires the freshly published audioctl.exe from Task 4 Step 6), install `App-Setup-x64-0.2.0.exe` (per the repo's installer artifact naming), then verify live against the Windows Settings mixer in both directions, icons included, plus the empty state (pause all audio) and a default-device switch while the tab is open.

- [ ] **Step 4: Ask the merge question**

Report the hands-on result and ask "merge?" once, with a recommendation. Do not merge without the answer. On approval: squash-merge, delete the branch locally and remotely, confirm `release.yml` publishes v0.2.0, then install the merged build and confirm the version per the shipping rules.

---

## Self-review notes

- Spec coverage: sessions command (T2), set commands (T3), icons (T4, T7), grouping (T6), IPC (T8), master row + app rows + empty state + tab (T10), sync verification (T3 smoke, T10 Step 6, T13 Step 3), e2e (T11), no-config constraint (no task touches config.ts - by design).
- Type consistency: `AppSession`/`MixerAppView`/`MixerState` defined once (T5/T6/T8) and consumed by name everywhere; `Fader` props defined in T9, used in T10.
- The premultiply direction in Gdi.ReadRgba is verified empirically in T4 Step 5; if icons look washed out, the bitmap was straight alpha already - drop the division, keep the all-zero-alpha guard.
