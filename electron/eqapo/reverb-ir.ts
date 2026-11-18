// Generates the cathedral impulse response AudioDeck convolves with.
//
// Built at runtime rather than shipped: it is a few dozen lines of seeded
// noise, and the two WAVs it replaces were 2.6 MB of the installer.
//
// Synthesised rather than recorded, which sidesteps the licensing question
// entirely: a recorded impulse response of a real hall is someone's work, and
// AudioDeck would be redistributing it. Exponentially decaying noise is what a
// diffuse reverb tail actually is, so the result is a real cathedral rather
// than an approximation of one.
//
// The output is deterministic and pinned by a hash in reverb-ir.test.ts, so
// the reverb sounds the same as it did when these files shipped prebuilt.

/** Seconds for the tail to fall by 60 dB. Cathedral territory. */
const RT60 = 3.2;
/** Total length; beyond the point the tail is inaudible there is no value. */
const SECONDS = 3.6;
/** Gap before the first reflection, which is what makes a space sound large. */
const PREDELAY_MS = 28;
/** Early reflections: [ms after the predelay, gain]. */
const EARLY_REFLECTIONS: ReadonlyArray<readonly [number, number]> = [
  [17, 0.5],
  [29, 0.42],
  [43, 0.34],
  [67, 0.26],
  [93, 0.2],
];
/**
 * Different seeds per channel: identical noise in both would collapse the
 * tail to the centre of the image, which is the opposite of a large space.
 */
const SEED_LEFT = 0x5eed1;
const SEED_RIGHT = 0xb0a71;

/** Deterministic noise, so every run produces the same bytes. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0x100000000) * 2 - 1;
  };
}

/**
 * One channel of tail: noise shaped by an exponential decay, rolled off with a
 * one-pole low pass whose cutoff falls as the tail ages. Air and stone absorb
 * treble faster than bass, and without that the tail sounds like hiss.
 */
function synthesise(rate: number, seed: number): Float64Array {
  const total = Math.floor(rate * SECONDS);
  const predelay = Math.floor((PREDELAY_MS / 1000) * rate);
  const out = new Float64Array(total);
  const random = makeRandom(seed);
  let lowpass = 0;

  for (let i = predelay; i < total; i++) {
    const age = (i - predelay) / rate;
    // -60 dB over RT60 seconds.
    const decay = Math.pow(10, (-60 * age) / (20 * RT60));
    // Cutoff sliding from bright to dark as the tail ages.
    const alpha = Math.max(0.03, 0.55 * Math.pow(0.5, age / 1.1));
    lowpass += alpha * (random() - lowpass);
    out[i] = lowpass * decay;
  }

  // Early reflections in front of the tail: what the ear reads as the size and
  // shape of the room. There is deliberately no impulse at time zero, because
  // that would be the dry signal, and the dry signal is mixed separately. An
  // impulse response used for a wet/dry mix must be wet only.
  for (const [ms, gain] of EARLY_REFLECTIONS) {
    const at = predelay + Math.floor((ms / 1000) * rate);
    if (at < total) out[at] = (out[at] ?? 0) + gain;
  }

  // Normalised by ENERGY, not by peak. Convolution scales a signal by the
  // impulse response's L2 norm, so a long tail normalised to a peak of 0.85
  // still contains enormous total energy and makes everything louder as the
  // reverb comes up. Setting the norm to 1 makes the wet path unity gain, so
  // the slider changes the character rather than the volume.
  let energy = 0;
  for (const v of out) energy += v * v;
  const scale = energy === 0 ? 0 : 1 / Math.sqrt(energy);
  return out.map((v) => v * scale);
}

/**
 * 32-bit float stereo WAV, which libsndfile reads and Equalizer APO accepts.
 *
 * Float rather than 16-bit PCM because the response is energy-normalised: its
 * samples are tiny, and quantising a 3.6 second tail to 16 bits would bury the
 * end of it in quantisation noise.
 */
function toWav(left: Float64Array, right: Float64Array, rate: number): Buffer {
  const frames = left.length;
  const data = Buffer.alloc(frames * 8);
  for (let i = 0; i < frames; i++) {
    data.writeFloatLE(left[i] ?? 0, i * 8);
    data.writeFloatLE(right[i] ?? 0, i * 8 + 4);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const cache = new Map<number, Buffer>();

/**
 * The impulse response for one sample rate, as WAV bytes. Built once per rate
 * and kept: a slider drag re-applies the config many times.
 */
export function reverbImpulseWav(rate: number): Buffer {
  let wav = cache.get(rate);
  if (wav === undefined) {
    wav = toWav(synthesise(rate, SEED_LEFT), synthesise(rate, SEED_RIGHT), rate);
    cache.set(rate, wav);
  }
  return wav;
}
