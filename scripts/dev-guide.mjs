// `npm run dev:guide`: the normal dev server with the first-run guide forced
// open on every launch, so it can be iterated on with hot reload instead of
// clearing config or reinstalling between attempts. Dismissals are dropped, so
// a reload brings it straight back and the real config is never written.
//
// A wrapper rather than an inline env assignment in package.json: npm runs
// scripts through cmd.exe on Windows and sh elsewhere, and the two disagree
// about how to set a variable for one command.

import { spawn } from "node:child_process";

const child = spawn("npx", ["electron-vite", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, AUDIODECK_GUIDE: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
