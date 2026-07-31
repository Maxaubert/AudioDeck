// Resolves the on-disk paths of the two helper executables. In development
// they live in the repo (audioctl publish output, vendor download); in a
// packaged app electron-builder copies them under process.resourcesPath as
// declared in electron-builder.yml.

import { app } from "electron";
import path from "node:path";
import { defaultAudioctlPath } from "./audioctl.js";
import { defaultHeadsetControlPath } from "./headsetcontrol.js";

export function audioctlExePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", "audioctl.exe");
  }
  return defaultAudioctlPath();
}

export function headsetControlExePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "vendor", "headsetcontrol.exe");
  }
  return defaultHeadsetControlPath();
}
