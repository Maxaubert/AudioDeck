import { describe, expect, it } from "vitest";
import { ensureIncludeLine, removeIncludeLine } from "./include.js";

// The config.txt a fresh Equalizer APO 1.4.2 install ships, observed
// 2026-08-01. Anything AudioDeck does to it has to be undoable.
const STOCK = [
  "Preamp: -6 dB",
  "Include: example.txt",
  "GraphicEQ: 25 0; 40 0; 63 0; 100 0; 160 0; 250 0; 400 0; 630 0; 1000 0",
  "",
].join("\n");

describe("ensureIncludeLine", () => {
  it("appends the include last, so AudioDeck's profiles sit on top", () => {
    const out = ensureIncludeLine(STOCK);
    expect(out).not.toBeNull();
    expect(out?.split("\n").filter((l) => l !== "").at(-1)).toBe("Include: audiodeck.txt");
  });

  it("leaves every existing line untouched", () => {
    const out = ensureIncludeLine(STOCK) ?? "";
    for (const line of STOCK.split("\n").filter((l) => l !== "")) {
      expect(out).toContain(line);
    }
  });

  it("reports no change when the include is already there", () => {
    // Applying twice must not write the file again, nor add a second line.
    const once = ensureIncludeLine(STOCK) ?? "";
    expect(ensureIncludeLine(once)).toBeNull();
  });

  it("is not fooled by a commented-out include", () => {
    // A commented include does nothing, so treating it as present would leave
    // the effects silently inactive.
    const commented = "# Include: audiodeck.txt\n";
    expect(ensureIncludeLine(commented)).not.toBeNull();
  });

  it("matches regardless of case and leading whitespace", () => {
    expect(ensureIncludeLine("   include:  audiodeck.txt  \n")).toBeNull();
  });

  it("handles an empty config", () => {
    expect(ensureIncludeLine("")).toBe("Include: audiodeck.txt\n");
  });

  it("keeps CRLF files on CRLF", () => {
    // Notepad users exist, and mixing endings in someone else's file is rude.
    const crlf = "Preamp: -6 dB\r\n";
    const out = ensureIncludeLine(crlf) ?? "";
    expect(out).toBe("Preamp: -6 dB\r\nInclude: audiodeck.txt\r\n");
    expect(out).not.toMatch(/[^\r]\n/);
  });

  it("preserves a file that does not end with a newline", () => {
    // Equalizer APO's own stock config.txt is exactly this shape. An earlier
    // version added a trailing newline here and never took it back off, so
    // removing effects left the file two bytes longer than it was found.
    const out = ensureIncludeLine("Preamp: -6 dB\r\nInclude: example.txt") ?? "";
    expect(out).toBe("Preamp: -6 dB\r\nInclude: example.txt\r\nInclude: audiodeck.txt");
    expect(out.endsWith("\n")).toBe(false);
  });

  it("leaves the user's own blank lines alone", () => {
    // Tidying them would be pleasant, and would also mean the file we hand
    // back is not the file we were given.
    const out = ensureIncludeLine("Preamp: -6 dB\n\n\n") ?? "";
    expect(out).toBe("Preamp: -6 dB\n\n\nInclude: audiodeck.txt\n");
  });
});

describe("removeIncludeLine", () => {
  it("restores the file exactly as it was", () => {
    // The promise in the design is that removing effects leaves the machine as
    // it was found. This is that promise, as a test.
    const withInclude = ensureIncludeLine(STOCK) ?? "";
    expect(removeIncludeLine(withInclude)).toBe(STOCK);
  });

  it("round-trips a CRLF file", () => {
    const crlf = "Preamp: -6 dB\r\nInclude: example.txt\r\n";
    const withInclude = ensureIncludeLine(crlf) ?? "";
    expect(removeIncludeLine(withInclude)).toBe(crlf);
  });

  it("reports no change when there is nothing of ours in the file", () => {
    expect(removeIncludeLine(STOCK)).toBeNull();
  });

  it("restores a file that had no trailing newline", () => {
    const stock = "Preamp: -6 dB\r\nInclude: example.txt";
    const withInclude = ensureIncludeLine(stock) ?? "";
    expect(removeIncludeLine(withInclude)).toBe(stock);
  });

  it("restores blank lines the user had", () => {
    const spaced = "Preamp: -6 dB\n\n\n";
    const withInclude = ensureIncludeLine(spaced) ?? "";
    expect(removeIncludeLine(withInclude)).toBe(spaced);
  });

  it("removes every copy if the file somehow gained more than one", () => {
    const doubled = "Preamp: -6 dB\nInclude: audiodeck.txt\nInclude: audiodeck.txt\n";
    expect(removeIncludeLine(doubled)).toBe("Preamp: -6 dB\n");
  });

  it("empties a file that contained nothing else", () => {
    expect(removeIncludeLine("Include: audiodeck.txt\n")).toBe("");
  });

  it("never touches an include of someone else's file", () => {
    const other = "Include: example.txt\nInclude: audiodeck-backup.txt\n";
    expect(removeIncludeLine(other)).toBeNull();
  });
});
