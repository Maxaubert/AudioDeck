// Pure text surgery on Equalizer APO's config.txt.
//
// AudioDeck owns exactly one line of that file: an Include pointing at its own
// generated config. Everything else in there belongs to the user, or to
// Equalizer APO's stock install, and must come back byte for byte when
// AudioDeck's effects are removed. That is the whole reason this is a separate
// pure module with its own tests: a bug here damages a file we did not write.

/** The file AudioDeck generates, alongside config.txt in the same directory. */
export const AUDIODECK_CONFIG = "audiodeck.txt";

const INCLUDE_LINE = `Include: ${AUDIODECK_CONFIG}`;

/**
 * A line that includes our file. Leading whitespace is allowed; a leading `#`
 * is not, because a commented-out include does nothing and must be treated as
 * absent rather than silently trusted.
 */
function isIncludeLine(line: string): boolean {
  return new RegExp(`^\\s*Include:\\s*${AUDIODECK_CONFIG}\\s*$`, "i").test(line);
}

/** Whatever line ending the file already uses, so we do not mix them. */
function detectEol(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Split into editable lines, remembering whether the file ended with a newline.
 *
 * That flag is the whole reason this helper exists. Equalizer APO's own stock
 * config.txt ends WITHOUT a trailing newline, and an earlier version of this
 * module added one on the way in and left it there on the way out, so removing
 * AudioDeck's effects did not restore the file byte for byte. Every unit test
 * had used a fixture that ended in a newline, so all of them missed it; only a
 * round trip against the real installed file caught it.
 */
function toLines(text: string): { lines: string[]; endsWithNewline: boolean } {
  const endsWithNewline = text === "" || /[\r\n]$/.test(text);
  const lines = text.split(/\r?\n/);
  if (endsWithNewline && lines[lines.length - 1] === "") lines.pop();
  return { lines, endsWithNewline };
}

function fromLines(lines: readonly string[], endsWithNewline: boolean, eol: string): string {
  if (lines.length === 0) return "";
  return lines.join(eol) + (endsWithNewline ? eol : "");
}

/**
 * Add the include if it is not already there. Returns null when the file
 * already has it, so callers can skip the write entirely rather than rewriting
 * a file they are not changing.
 */
export function ensureIncludeLine(text: string): string | null {
  const { lines, endsWithNewline } = toLines(text);
  if (lines.some(isIncludeLine)) return null;

  // Appended last so it wins: Equalizer APO applies commands in order, and
  // AudioDeck's profiles should sit on top of whatever came before.
  return fromLines([...lines, INCLUDE_LINE], endsWithNewline, detectEol(text));
}

/**
 * Take the include back out. Returns null when there was nothing to remove.
 *
 * Only our line is touched. Blank lines the user had are left exactly where
 * they were: tidying them would be pleasant and would also mean the file we
 * hand back is not the file we were given.
 */
export function removeIncludeLine(text: string): string | null {
  const { lines, endsWithNewline } = toLines(text);
  if (!lines.some(isIncludeLine)) return null;

  const kept = lines.filter((line) => !isIncludeLine(line));
  return fromLines(kept, endsWithNewline, detectEol(text));
}
