import { NextResponse } from "next/server"

import type { CommunicationMeta } from "@/lib/vault"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  createNote,
  deleteNote,
  listNotes,
  readNote,
  updateNote,
} from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const unauthorized = await requireApiUser()
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(req.url)
    const notePath = searchParams.get("path")
    const channel = searchParams.get("channel")
    const category = searchParams.get("category")

    // If a specific path is requested, return that single note (with full body)
    if (notePath) {
      // Security: ensure path stays within communications directory
      if (
        !notePath.startsWith("communications/") ||
        notePath.includes("..") ||
        /[\\]/.test(notePath)
      ) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 })
      }
      const note = await readNote<CommunicationMeta>(notePath)
      return NextResponse.json(note)
    }

    let notes = await listNotes<CommunicationMeta>("communications")

    if (channel) {
      notes = notes.filter((n) => n.meta.channel === channel)
    }

    if (category) {
      notes = notes.filter((n) => n.meta.category === category)
    }

    // Sort by date descending (newest first)
    notes.sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading communications:", e)
    return NextResponse.json(
      { error: "Failed to read communications" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const unauthorized = await requireApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateJsonMutationRequest(req)
    if (invalidRequest) return invalidRequest

    const body = await req.json()
    const {
      channel,
      contact,
      subject,
      date,
      direction = "outbound",
      category = "business",
      deal,
      content = "",
    } = body

    if (!channel || !contact) {
      return NextResponse.json(
        { error: "channel and contact are required" },
        { status: 400 }
      )
    }

    const commDate = date || new Date().toISOString().split("T")[0]
    const contactSlug = contact
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") // strip path separators and special chars
    const channelSlug = String(channel).replace(/[^a-z0-9-]/g, "")
    const filename = `${commDate}-${channelSlug}-${contactSlug}.md`

    const meta: CommunicationMeta = {
      type: "communication",
      category,
      channel,
      contact,
      date: commDate,
      direction,
      ...(subject && { subject }),
      ...(deal && { deal }),
      created: commDate,
    }

    const note = await createNote<CommunicationMeta>(
      "communications",
      filename,
      meta,
      content
    )

    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating communication:", e)
    return NextResponse.json(
      { error: "Failed to create communication" },
      { status: 500 }
    )
  }
}

/** Validate that a vault path stays within the communications directory */
function isValidCommPath(p: string): boolean {
  return p.startsWith("communications/") && !p.includes("..") && !/[\\]/.test(p)
}

export async function PATCH(req: Request) {
  try {
    const unauthorized = await requireApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateJsonMutationRequest(req)
    if (invalidRequest) return invalidRequest

    const body = await req.json()
    const { path, ...updates } = body as {
      path: string
    } & Partial<CommunicationMeta>

    if (!path || !isValidCommPath(path)) {
      return NextResponse.json(
        { error: "Invalid or missing path" },
        { status: 400 }
      )
    }

    const updated = await updateNote<CommunicationMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating communication:", e)
    return NextResponse.json(
      { error: "Failed to update communication" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const unauthorized = await requireApiUser()
    if (unauthorized) return unauthorized
    const invalidRequest = validateJsonMutationRequest(req)
    if (invalidRequest) return invalidRequest

    const { path } = (await req.json()) as { path: string }

    if (!path || !isValidCommPath(path)) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    await deleteNote(path)
    return NextResponse.json({ deleted: true, path })
  } catch (e) {
    console.error("Error deleting communication:", e)
    return NextResponse.json(
      { error: "Failed to delete communication" },
      { status: 500 }
    )
  }
}
