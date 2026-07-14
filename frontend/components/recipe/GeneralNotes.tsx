export default function GeneralNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <section>
      <h2 className="font-display text-xl tracking-tight">General Notes</h2>
      <ul className="mt-3 space-y-2">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span aria-hidden>💡</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
