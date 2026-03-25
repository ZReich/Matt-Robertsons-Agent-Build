import { NextResponse } from "next/server"

import { listNotes, updateNote, createNote } from "@/lib/vault"
import type { AgentMemoryMeta } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const memoryType = searchParams.get("memory_type")

    let notes = await listNotes<AgentMemoryMeta>("agent-memory")

    if (memoryType) {
      notes = notes.filter((n) => n.meta.memory_type === memoryType)
    }

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading agent memory:", e)
    return NextResponse.json(
      { error: "Failed to read agent memory" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      title,
      memory_type = "preference",
      priority = "medium",
      subdir,
      content = "",
    } = body

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split("T")[0]
    const slug = title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    const filename = `${slug}.md`

    const basePath = subdir ? `agent-memory/${subdir}` : "agent-memory"

    const meta: AgentMemoryMeta = {
      type: "agent-memory",
      category: "business",
      memory_type,
      title,
      priority,
      last_updated: today,
      created: today,
    }

    const note = await createNote<AgentMemoryMeta>(basePath, filename, meta, content)
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating agent memory:", e)
    return NextResponse.json(
      { error: "Failed to create agent memory" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<AgentMemoryMeta>

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      )
    }

    // Always update last_updated
    const updatesWithDate = {
      ...updates,
      last_updated: new Date().toISOString().split("T")[0],
    }

    const updated = await updateNote<AgentMemoryMeta>(path, updatesWithDate)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating agent memory:", e)
    return NextResponse.json(
      { error: "Failed to update agent memory" },
      { status: 500 }
    )
  }
}
