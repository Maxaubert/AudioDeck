// Split a Windows endpoint name "Desc (Interface)" into its parts. Windows
// always composes names this way and the composed form is write-protected,
// so clean display and drift detection both work on the split parts.

/**
 * Scanned from the end rather than matched with a regex, because the interface
 * part routinely contains parentheses of its own: "Speakers (Realtek(R) Audio)"
 * is the stock Realtek name on a great many machines. A pattern like
 * `\(([^()]+)\)$` cannot span that inner "(R)", so it failed to split at all,
 * and the whole composed name became the title. That made reapply see the name
 * as permanently drifted from the description the user saved, so it re-renamed
 * the device and restarted the shell host on every single poll tick.
 *
 * Taking the LAST balanced group is also what Windows composition implies: the
 * interface name is appended in parentheses to a description that may itself
 * end in some, so only the final group is the interface.
 */
export function splitDeviceName(name: string): { title: string; detail: string | null } {
  if (!name.endsWith(")")) return { title: name, detail: null };

  let depth = 0;
  let open = -1;
  for (let i = name.length - 1; i >= 0; i--) {
    const ch = name[i];
    if (ch === ")") depth++;
    else if (ch === "(") {
      depth--;
      if (depth === 0) {
        open = i;
        break;
      }
    }
  }
  // Unbalanced, or nothing but the group itself: not a composed name.
  if (open <= 0) return { title: name, detail: null };

  const title = name.slice(0, open).trimEnd();
  const detail = name.slice(open + 1, -1);
  // A composed name has a real description in front and a real interface
  // inside. Anything else is a plain name that happens to end in a bracket.
  if (title === "" || detail.trim() === "") return { title: name, detail: null };
  // Windows separates the two with a space; without one this is one word.
  if (name[open - 1] !== " ") return { title: name, detail: null };

  return { title, detail };
}
