import { NextResponse } from "next/server"

import type { AgentActionMeta } from "@/lib/vault"

import { listNotes } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const tier = searchParams.get("tier")
    const actionType = searchParams.get("action_type")

    let notes = await listNotes<AgentActionMeta>("agent-actions")

    if (status) {
      notes = notes.filter((n) => n.meta.status === status)
    }

    if (tier) {
      notes = notes.filter((n) => n.meta.tier === tier)
    }

    if (actionType) {
      notes = notes.filter((n) => n.meta.action_type === actionType)
    }

    // Sort by created_at descending (newest first)
    notes.sort(
      (a, b) =>
        new Date(b.meta.created_at).getTime() -
        new Date(a.meta.created_at).getTime()
    )

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading agent actions:", e)
    return NextResponse.json(
      { error: "Failed to read agent actions" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return vaultAgentActionWritesGone(req)
}

export async function PATCH(req: Request) {
  return vaultAgentActionWritesGone(req)
}

function vaultAgentActionWritesGone(_req: Request) {
  return NextResponse.json(
    {
      error:
        "vault agent-action writes are retired; use /api/agent/actions review APIs",
      code: "vault_agent_actions_retired",
    },
    { status: 410 }
  )
}
