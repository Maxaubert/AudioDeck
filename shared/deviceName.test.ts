import { describe, expect, it } from "vitest";
import { splitDeviceName } from "./deviceName.js";

describe("splitDeviceName", () => {
  it("splits the ordinary composed name", () => {
    expect(splitDeviceName("Speakers (Realtek High Definition Audio)")).toEqual({
      title: "Speakers",
      detail: "Realtek High Definition Audio",
    });
  });

  it("splits a name whose interface part contains parentheses", () => {
    // "Realtek(R) Audio" is the stock friendly name on a great many machines.
    // A regex using [^()]+ for the interface cannot span the inner "(R)", so
    // this did not split at all: the whole string became the title, reapply
    // saw the saved description as permanently drifted, and it re-renamed the
    // device and force-killed ShellHost.exe on every poll tick.
    expect(splitDeviceName("Speakers (Realtek(R) Audio)")).toEqual({
      title: "Speakers",
      detail: "Realtek(R) Audio",
    });
    expect(splitDeviceName("Microphone (Realtek(R) Audio)")).toEqual({
      title: "Microphone",
      detail: "Realtek(R) Audio",
    });
  });

  it("takes the last group when the description ends in one too", () => {
    // Windows appends the interface to a description that may itself end in
    // parentheses, so only the final group is ever the interface.
    expect(splitDeviceName("Speakers (2) (USB Audio Device)")).toEqual({
      title: "Speakers (2)",
      detail: "USB Audio Device",
    });
  });

  it("survives round tripping a name it just split", () => {
    const composed = "Podcast Mic (Realtek(R) Audio)";
    const parts = splitDeviceName(composed);
    expect(splitDeviceName(`${parts.title} (${parts.detail})`)).toEqual(parts);
  });

  it("leaves a name with no interface part alone", () => {
    expect(splitDeviceName("Headphones")).toEqual({ title: "Headphones", detail: null });
  });

  it("treats an unbalanced or empty group as a plain name", () => {
    // Better to show the name Windows gave than to invent a split.
    for (const name of ["Speakers )", "Speakers ()", "(Realtek)", "Weird ) name (", ")"]) {
      expect(splitDeviceName(name)).toEqual({ title: name, detail: null });
    }
  });

  it("does not split a single word that merely ends in a bracket", () => {
    expect(splitDeviceName("Speakers(USB)")).toEqual({ title: "Speakers(USB)", detail: null });
  });
});
