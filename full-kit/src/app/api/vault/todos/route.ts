import { NextResponse } from "next/server"

import type { TodoMeta } from "@/lib/vault"

import { authenticateUser } from "@/lib/auth"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
} from "@/lib/reviewer-auth"
import {
  archivePrismaTodoFromVaultPath,
  getPrismaTodoId,
  isPrismaTodoPath,
  listPrismaTodoNotes,
  updatePrismaTodoFromVaultPath,
} from "@/lib/todos/prisma-todo-notes"
import { createNote, deleteNote, listNotes, updateNote } from "@/lib/vault"

async function requireTodoApiUser() {
  try {
    await authenticateUser()
    return null
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
}

function validateMutationRequest(req: Request) {
  try {
    assertSameOriginRequest(req)
    assertJsonRequest(req)
    return null
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}

export async function GET(req: Request) {
  try {
    const unauthorized = await requireTodoApiUser()
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    let notes = [
      ...(await listNotes<TodoMeta>("todos")),
      ...(await listPrismaTodoNotes()),
    ]

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
    const unauthorized = await requireTodoApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateMutationRequest(req)
    if (invalidRequest) return invalidRequest

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
  if (p.includes("..") || /[\\]/.test(p)) return false
  if (isPrismaTodoPath(p)) {
    // Reject "prisma-todos/" with no id; otherwise downstream Prisma calls
    // run with an empty id and surface as P2025 → 404.
    return (getPrismaTodoId(p) ?? "").length > 0
  }
  return p.startsWith("todos/")
}

const VALID_PRIORITIES: ReadonlySet<string> = new Set([
  "low",
  "medium",
  "high",
  "urgent",
])

const VALID_VAULT_STATUSES: ReadonlySet<string> = new Set([
  "proposed",
  "pending",
  "in_progress",
  "in-progress",
  "done",
  "dismissed",
])

const PRISMA_REPRESENTABLE_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "in_progress",
  "in-progress",
  "done",
])

/**
 * Validate a PATCH body's free-form fields. Returns a NextResponse on error,
 * or null when the body is acceptable. Prevents the silent-coerce bug where
 * an unknown priority or status (e.g. {priority: "extreme"} or, for a Prisma
 * todo, {status: "dismissed"}) would round-trip to a default and discard the
 * caller's intent.
 */
function validateTodoUpdates(
  path: string,
  updates: Partial<TodoMeta>
): NextResponse | null {
  if (
    updates.priority !== undefined &&
    !VALID_PRIORITIES.has(updates.priority)
  ) {
    return NextResponse.json(
      { error: `Invalid priority "${updates.priority}"` },
      { status: 400 }
    )
  }
  if (updates.status !== undefined) {
    if (!VALID_VAULT_STATUSES.has(updates.status)) {
      return NextResponse.json(
        { error: `Invalid status "${updates.status}"` },
        { status: 400 }
      )
    }
    if (
      isPrismaTodoPath(path) &&
      !PRISMA_REPRESENTABLE_STATUSES.has(updates.status)
    ) {
      return NextResponse.json(
        {
          error: `Invalid status "${updates.status}" for a Prisma-backed todo`,
        },
        { status: 400 }
      )
    }
  }
  return null
}

export async function PATCH(req: Request) {
  try {
    const unauthorized = await requireTodoApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateMutationRequest(req)
    if (invalidRequest) return invalidRequest

    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<TodoMeta>

    if (!path || !isValidTodoPath(path)) {
      return NextResponse.json(
        { error: "Invalid or missing path" },
        { status: 400 }
      )
    }

    const invalidUpdates = validateTodoUpdates(path, updates)
    if (invalidUpdates) return invalidUpdates

    if (isPrismaTodoPath(path)) {
      const updated = await updatePrismaTodoFromVaultPath(path, updates)
      if (!updated) {
        return NextResponse.json(
          { error: "todo not found", code: "todo_missing" },
          { status: 404 }
        )
      }
      return NextResponse.json(updated)
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
    const unauthorized = await requireTodoApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateMutationRequest(req)
    if (invalidRequest) return invalidRequest

    const { path } = (await req.json()) as { path: string }

    if (!path || !isValidTodoPath(path)) {
      return NextResponse.json(
        { error: "Invalid or missing path" },
        { status: 400 }
      )
    }

    if (isPrismaTodoPath(path)) {
      const deleted = await archivePrismaTodoFromVaultPath(path)
      if (!deleted) {
        return NextResponse.json(
          { error: "todo not found", code: "todo_missing" },
          { status: 404 }
        )
      }
      return NextResponse.json(deleted)
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
