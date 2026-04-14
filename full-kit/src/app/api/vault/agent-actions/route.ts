import { NextResponse } from "next/server"

import type { AgentActionMeta } from "@/lib/vault"

import { createNote, listNotes, updateNote } from "@/lib/vault"

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
  try {
    const body = await req.json()
    const {
      action_type,
      tier = "approve",
      target_entity,
      summary,
      content = "",
    } = body

    if (!action_type || !summary) {
      return NextResponse.json(
        { error: "action_type and summary are required" },
        { status: 400 }
      )
    }

    const now = new Date()
    const dateStr = now.toISOString().split("T")[0]
    const timeStr = now.toISOString().split("T")[1].slice(0, 5).replace(":", "")
    const slug = summary
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50)
    const filename = `${dateStr}-${timeStr}-${slug}.md`

    // Auto-tier actions go straight to executed status
    const initialStatus = tier === "auto" ? "executed" : "pending"
    const subdir =
      initialStatus === "executed"
        ? "agent-actions/approved"
        : "agent-actions/pending"

    const meta: AgentActionMeta = {
      type: "agent-action",
      category: "business",
      action_type,
      tier,
      status: initialStatus,
      summary,
      created_at: now.toISOString(),
      ...(target_entity && { target_entity }),
      ...(initialStatus === "executed" && {
        executed_at: now.toISOString(),
      }),
    }

    const note = await createNote<AgentActionMeta>(
      subdir,
      filename,
      meta,
      content
    )
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating agent action:", e)
    return NextResponse.json(
      { error: "Failed to create agent action" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, status, feedback } = body as {
      path: string
      status: AgentActionMeta["status"]
      feedback?: string
    }

    if (!path || !status) {
      return NextResponse.json(
        { error: "path and status are required" },
        { status: 400 }
      )
    }

    const updates: Partial<AgentActionMeta> = { status }

    if (feedback) {
      updates.feedback = feedback
    }

    if (status === "executed") {
      updates.executed_at = new Date().toISOString()
    }

    const updated = await updateNote<AgentActionMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating agent action:", e)
    return NextResponse.json(
      { error: "Failed to update agent action" },
      { status: 500 }
    )
  }
}
