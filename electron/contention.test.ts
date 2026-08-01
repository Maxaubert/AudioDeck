import { describe, expect, it } from "vitest";
import {
  ASSERTIONS_TO_CONTEST,
  CONTENTION_WINDOW_MS,
  clearContention,
  emptyContention,
  noteAssertion,
  releaseIfGone,
} from "./contention.js";

const VD = "{0.0.0.00000000}.{virtual-desktop-audio}";
const HEADSET = "{0.0.0.00000000}.{arctis}";
const SPEAKERS = "{0.0.0.00000000}.{speakers}";

/** Assert `target` n times, each one taking it back from `heldBy`. */
function fight(n: number, target = HEADSET, heldBy: string | null = VD, step = 2000) {
  let state = emptyContention();
  for (let i = 0; i < n; i++) state = noteAssertion(state, target, heldBy, i * step);
  return state;
}

describe("contention", () => {
  it("tolerates setting the default a few times", () => {
    // Plugging a headset in and out while setting things up is ordinary, and
    // must not cost AudioDeck its whole job.
    expect(fight(ASSERTIONS_TO_CONTEST - 1).contestedBy).toBeNull();
  });

  it("stands down once it is clearly not sticking", () => {
    // In a settled system the default is set when something changes, and
    // things do not change several times a minute on their own.
    expect(fight(ASSERTIONS_TO_CONTEST).contestedBy).toBe(VD);
  });

  it("names whatever kept taking it, so the UI can say who", () => {
    expect(fight(ASSERTIONS_TO_CONTEST, HEADSET, SPEAKERS).contestedBy).toBe(SPEAKERS);
  });

  it("forgets assertions that have aged out of the window", () => {
    // Setting the default once an hour is not a fight with anyone.
    const slow = fight(ASSERTIONS_TO_CONTEST * 2, HEADSET, VD, CONTENTION_WINDOW_MS + 1);
    expect(slow.contestedBy).toBeNull();
  });

  it("counts each target separately", () => {
    // Alternating between two devices is a different fault from one device
    // that will not stay put, and this is not the detector for it.
    let state = emptyContention();
    for (let i = 0; i < ASSERTIONS_TO_CONTEST; i++) {
      state = noteAssertion(state, i % 2 === 0 ? HEADSET : SPEAKERS, VD, i * 1000);
    }
    expect(state.contestedBy).toBeNull();
  });

  it("blames nobody when the default was not held by anything", () => {
    // Nothing to name means nothing to blame: a banner saying "something keeps
    // taking your sound" is not worth showing.
    let state = emptyContention();
    for (let i = 0; i < ASSERTIONS_TO_CONTEST; i++) {
      state = noteAssertion(state, HEADSET, null, i * 1000);
    }
    expect(state.contestedBy).toBeNull();
  });

  it("does not blame the device it is trying to select", () => {
    let state = emptyContention();
    for (let i = 0; i < ASSERTIONS_TO_CONTEST; i++) {
      state = noteAssertion(state, HEADSET, HEADSET, i * 1000);
    }
    expect(state.contestedBy).toBeNull();
  });

  it("starts asserting again when the user changes something", () => {
    // Re-ranking or picking by hand is a new instruction, and deserves a fresh
    // attempt even against a program that won last time.
    const state = clearContention(fight(ASSERTIONS_TO_CONTEST));
    expect(state.contestedBy).toBeNull();
    expect(state.assertions.size).toBe(0);
  });

  it("lets go when the contender is no longer there", () => {
    // Nothing else can clear this on its own: once AudioDeck stops asserting
    // there is no more fight to observe.
    let state = fight(ASSERTIONS_TO_CONTEST);
    state = releaseIfGone(state, new Set([VD, HEADSET]));
    expect(state.contestedBy).toBe(VD);

    state = releaseIfGone(state, new Set([HEADSET]));
    expect(state.contestedBy).toBeNull();
  });

  it("does nothing on release when nothing is contested", () => {
    expect(releaseIfGone(emptyContention(), new Set()).contestedBy).toBeNull();
  });
});
