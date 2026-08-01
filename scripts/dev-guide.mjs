// `npm run dev:guide`: the normal dev server with the first-run guide forced
// open on every launch, so it can be iterated on with hot reload instead of
// clearing config or reinstalling between attempts. Dismissals are dropped, so
// a reload brings it straight back and the real config is never written.
//
// Test mode as well, because AudioDeck holds a single-instance lock: with an
// installed copy already running in the tray, the dev instance would quit on
// startup and hand the lock holder a "second-instance" event, which opens the
// INSTALLED app's window. The result looks exactly like the dev build failing
// to pick up any changes. Test mode skips the lock, the tray and the registry,
// so the dev window is a second window beside the running app rather than a
// fight with it. It reads the same config, so it still looks like a real setup.
//
// A wrapper rather than an inline env assignment in package.json: npm runs
// scripts through cmd.exe on Windows and sh elsewhere, and the two disagree
// about how to set a variable for one command.

import { spawn } from "node:child_process";

const child = spawn("npx", ["electron-vite", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, AUDIODECK_GUIDE: "1", AUDIODECK_TEST_MODE: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
