import { NextResponse } from "next/server"

import { listNotes, updateNote, createNote, deleteNote } from "@/lib/vault"
import type { CommunicationMeta } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const channel = searchParams.get("channel")
    const category = searchParams.get("category")

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
    const contactSlug = contact.toLowerCase().replace(/\s+/g, "-")
    const filename = `${commDate}-${channel}-${contactSlug}.md`

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

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<CommunicationMeta>

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
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
    const { path } = (await req.json()) as { path: string }

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      )
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
