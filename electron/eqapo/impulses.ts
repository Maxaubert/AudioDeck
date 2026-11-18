// The reverb impulse responses applyProfiles writes next to Equalizer APO's
// config, which is where Convolution resolves its paths from.
//
// Generated in memory by reverb-ir.ts rather than bundled as files.

import { reverbImpulseWav } from "./reverb-ir.js";
import type { ImpulseResponses } from "./apply.js";

export const impulseResponses: ImpulseResponses = {
  wav: reverbImpulseWav,
};
