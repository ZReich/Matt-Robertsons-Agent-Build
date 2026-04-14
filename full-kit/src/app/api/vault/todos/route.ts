import { NextResponse } from "next/server"

import type { TodoMeta } from "@/lib/vault"

import { createNote, deleteNote, listNotes, updateNote } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    let notes = await listNotes<TodoMeta>("todos")

    if (category) {
      notes = notes.filter((n) => n.meta.category === category)
    }

    if (status) {
      notes = notes.filter((n) => n.meta.status === status)
    }

    // Sort: urgent/high priority first, then by due date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    notes.sort((a, b) => {
      const pa = priorityOrder[a.meta.priority ?? "medium"]
      const pb = priorityOrder[b.meta.priority ?? "medium"]
      if (pa !== pb) return pa - pb

      const da = a.meta.due_date
        ? new Date(a.meta.due_date).getTime()
        : Infinity
      const db = b.meta.due_date
        ? new Date(b.meta.due_date).getTime()
        : Infinity
      return da - db
    })

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading todos:", e)
    return NextResponse.json({ error: "Failed to read todos" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      title,
      priority = "medium",
      due_date,
      category = "business",
      status = "pending",
      deal,
      contact,
      source_communication,
      content = "",
    } = body

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const subdir = `todos/${category === "personal" ? "personal" : "business"}`
    const filename = `${title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}.md`
    const today = new Date().toISOString().split("T")[0]

    const meta: TodoMeta = {
      type: "todo",
      category,
      title,
      status,
      priority,
      ...(due_date && { due_date }),
      ...(deal && { deal }),
      ...(contact && { contact }),
      ...(source_communication && { source_communication }),
      created: today,
    }

    const note = await createNote<TodoMeta>(subdir, filename, meta, content)
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating todo:", e)
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    )
  }
}

/** Validate that a vault path stays within the todos directory */
function isValidTodoPath(p: string): boolean {
  return p.startsWith("todos/") && !p.includes("..") && !/[\\]/.test(p)
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<TodoMeta>

    if (!path || !isValidTodoPath(path)) {
      return NextResponse.json(
        { error: "Invalid or missing path" },
        { status: 400 }
      )
    }

    const updated = await updateNote<TodoMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating todo:", e)
    return NextResponse.json(
      { error: "Failed to update todo" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { path } = (await req.json()) as { path: string }

    if (!path || !isValidTodoPath(path)) {
      return NextResponse.json(
        { error: "Invalid or missing path" },
        { status: 400 }
      )
    }

    await deleteNote(path)
    return NextResponse.json({ deleted: true, path })
  } catch (e) {
    console.error("Error deleting todo:", e)
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    )
  }
}
