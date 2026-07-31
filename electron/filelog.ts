// Mirror console.log/error to %APPDATA%\AudioDeck\daemon.log with timestamps.
// Best effort: logging must never crash or slow the daemon.

import { appendFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { configDir } from "./config.js";

const MAX_BYTES = 1024 * 1024;

export function installFileLog(file: string = path.join(configDir(), "daemon.log")): void {
  rotateIfLarge(file);
  patch("log", file);
  patch("error", file);
}

function patch(level: "log" | "error", file: string): void {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]): void => {
    original(...args);
    try {
      const line = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.stack ?? String(a) : JSON.stringify(a)))
        .join(" ");
      appendFileSync(file, `${new Date().toISOString()} [${level}] ${line}\n`, "utf8");
    } catch {
      // Never let logging break the daemon.
    }
  };
}

/** One-generation rotation keeps the log bounded without a scheduler. */
function rotateIfLarge(file: string): void {
  try {
    if (statSync(file).size > MAX_BYTES) renameSync(file, `${file}.old`);
  } catch {
    // Missing file or busy target: nothing to rotate.
  }
}
