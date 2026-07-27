// Autostart with Windows via the HKCU Run key, on by default, toggleable in UI.
// Stage 2 stub: interface is final, implementation lands with the daemon core.

export function isAutostartEnabled(): Promise<boolean> {
  throw new Error("autostart.isAutostartEnabled: Stage 2 stub, implemented with the daemon core");
}

export function setAutostart(enabled: boolean): Promise<void> {
  void enabled;
  throw new Error("autostart.setAutostart: Stage 2 stub, implemented with the daemon core");
}
