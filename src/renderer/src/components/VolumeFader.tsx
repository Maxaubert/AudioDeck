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
