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
    const first = members[0];
    // Groups are built by pushing at least one session; the guard is for the
    // index checker, not a reachable state.
    if (first === undefined) continue;
    rows.push({
      key,
      name: members.find((m) => m.name !== "")?.name ?? `App ${first.pid}`,
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
