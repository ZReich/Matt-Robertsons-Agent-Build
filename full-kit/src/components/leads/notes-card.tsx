interface NotesCardProps {
  notes: string | null
}

export function NotesCard({ notes }: NotesCardProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
        Notes
      </div>
      {notes && notes.trim().length > 0 ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{notes}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground">No notes yet.</p>
      )}
    </div>
  )
}
