// Section header: black display plate, rule, and a small count on the right.

export function SectionLabel({ title, note }: { title: string; note?: string }) {
  return (
    <h3 className="section-label">
      <span>{title}</span>
      <span className="rule" />
      {note !== undefined ? <span className="note">{note}</span> : null}
    </h3>
  );
}
