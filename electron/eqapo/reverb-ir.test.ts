import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reverbImpulseWav } from "./reverb-ir.js";
import { IR_RATES } from "./render.js";

// SHA-256 of the WAVs that scripts/make-reverb-ir.mjs produced and v0.2.5
// shipped prebuilt. The runtime generator must match them byte for byte, so
// moving generation into the app does not change how the reverb sounds.
const SHIPPED: Record<number, string> = {
  44100: "d1ded5f8e88b0fc9a880aac30124b7dda840c725329cbb054fc43b5c0e4f57a0",
  48000: "de4faff24469f18cc3d7f3d90d420b96a1854247eb586b9de91444ea95c57361",
};

describe("reverbImpulseWav", () => {
  it.each(IR_RATES.map((rate) => [rate]))("matches the shipped %i Hz response exactly", (rate) => {
    const hash = createHash("sha256").update(reverbImpulseWav(rate)).digest("hex");
    expect(hash).toBe(SHIPPED[rate]);
  });

  it("returns the cached buffer on repeat calls", () => {
    expect(reverbImpulseWav(48000)).toBe(reverbImpulseWav(48000));
  });
});
