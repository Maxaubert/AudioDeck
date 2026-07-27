// Spawn a short-lived helper exe at BELOW_NORMAL priority. The daemon polls
// every couple of seconds; its helpers must never compete with a foreground
// game for CPU time, so their priority is dropped the moment they start.

import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface QuietResult {
  stdout: string;
  stderr: string;
}

export async function execQuiet(
  exePath: string,
  args: string[],
  timeoutMs: number,
): Promise<QuietResult> {
  const promise = execFileAsync(exePath, args, {
    timeout: timeoutMs,
    windowsHide: true,
    encoding: "utf8",
  });
  const pid = promise.child.pid;
  if (pid !== undefined) {
    try {
      os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {
      // The helper may already have exited; priority is best effort.
    }
  }
  return promise;
}
