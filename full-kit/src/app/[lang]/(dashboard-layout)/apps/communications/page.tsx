import { MessageSquare } from "lucide-react"

import type { CommunicationMeta, TodoMeta } from "@/lib/vault"
import type { Metadata } from "next"

import { listNotes } from "@/lib/vault"

import { CommsShell } from "./_components/comms-shell"

export const metadata: Metadata = {
  title: "Communications",
}

export default async function CommunicationsPage() {
  // Fetch communications and todos in parallel
  const [commNotes, todoNotes] = await Promise.all([
    listNotes<CommunicationMeta>("communications"),
    listNotes<TodoMeta>("todos"),
  ])

  // Sort communications by date descending
  const sortedComms = [...commNotes].sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
  )

  return (
    <section className="p-6 h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Communications</h1>
          <p className="text-sm text-muted-foreground">
            {sortedComms.length} communication
            {sortedComms.length !== 1 ? "s" : ""} logged
          </p>
        </div>
      </div>

      <CommsShell notes={sortedComms} todos={todoNotes} />
    </section>
  )
}
