import type { Metadata } from "next"
import { MessageSquare } from "lucide-react"

import { listNotes } from "@/lib/vault"
import type { CommunicationMeta } from "@/lib/vault"

import { CommsFeed } from "./_components/comms-feed"

export const metadata: Metadata = {
  title: "Communications",
}

export default async function CommunicationsPage() {
  const notes = await listNotes<CommunicationMeta>("communications")

  // Sort by date descending
  const sorted = [...notes].sort(
    (a, b) =>
      new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
  )

  return (
    <section className="container max-w-3xl grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} communication{sorted.length !== 1 ? "s" : ""} logged
          </p>
        </div>
      </div>

      <CommsFeed notes={sorted} />
    </section>
  )
}
