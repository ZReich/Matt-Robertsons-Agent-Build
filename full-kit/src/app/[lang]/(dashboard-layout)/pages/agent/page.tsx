import type { AgentActionMeta, AgentMemoryMeta } from "@/lib/vault"
import type { Metadata } from "next"

import { listNotes } from "@/lib/vault"

import { AgentControlCenter } from "./_components/agent-control-center"

export const metadata: Metadata = {
  title: "Agent Control Center",
}

export default async function AgentPage() {
  const [actions, memory] = await Promise.all([
    listNotes<AgentActionMeta>("agent-actions"),
    listNotes<AgentMemoryMeta>("agent-memory"),
  ])

  // Sort actions: pending first, then by date desc
  const statusOrder = { pending: 0, approved: 1, executed: 2, rejected: 3 }
  actions.sort((a, b) => {
    const sa = statusOrder[a.meta.status] ?? 4
    const sb = statusOrder[b.meta.status] ?? 4
    if (sa !== sb) return sa - sb
    return (
      new Date(b.meta.created_at).getTime() -
      new Date(a.meta.created_at).getTime()
    )
  })

  return (
    <section className="container grid gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Agent Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Manage approvals, review activity, and configure agent behavior.
        </p>
      </div>

      <AgentControlCenter
        initialActions={JSON.parse(JSON.stringify(actions))}
        initialMemory={JSON.parse(JSON.stringify(memory))}
      />
    </section>
  )
}
