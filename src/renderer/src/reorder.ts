// Pure list-reordering helpers for the priority lists. No React, no I/O.

/** Move the item at `from` to position `to`, returning a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || from >= result.length || to < 0 || to >= result.length || from === to) {
    return result;
  }
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item as T);
  return result;
}
