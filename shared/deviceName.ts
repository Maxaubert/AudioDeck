// Split a Windows endpoint name "Desc (Interface)" into its parts. Windows
// always composes names this way and the composed form is write-protected,
// so clean display and drift detection both work on the split parts.

export function splitDeviceName(name: string): { title: string; detail: string | null } {
  const match = /^(.*\S)\s+\(([^()]+)\)$/.exec(name);
  if (match === null) return { title: name, detail: null };
  return { title: match[1] ?? name, detail: match[2] ?? null };
}
