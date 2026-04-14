import { NextResponse } from "next/server"

import type { MeetingMeta } from "@/lib/vault"

import { createNote, deleteNote, listNotes, updateNote } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")

    let notes = await listNotes<MeetingMeta>("meetings")

    if (category) {
      notes = notes.filter((n) => n.meta.category === category)
    }

    // Sort by date ascending (upcoming first)
    notes.sort(
      (a, b) =>
        new Date(a.meta.date).getTime() - new Date(b.meta.date).getTime()
    )

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading meetings:", e)
    return NextResponse.json(
      { error: "Failed to read meetings" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      title,
      contact,
      date,
      duration_minutes,
      location,
      category = "business",
      deal,
      content = "",
    } = body

    if (!title || !date) {
      return NextResponse.json(
        { error: "title and date are required" },
        { status: 400 }
      )
    }

    const titleSlug = title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    const filename = `${date}-${titleSlug}.md`

    const meta: MeetingMeta = {
      type: "meeting",
      category,
      title,
      date,
      ...(contact && { contact }),
      ...(duration_minutes && { duration_minutes }),
      ...(location && { location }),
      ...(deal && { deal }),
      created: new Date().toISOString().split("T")[0],
    }

    const note = await createNote<MeetingMeta>(
      "meetings",
      filename,
      meta,
      content
    )
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating meeting:", e)
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<MeetingMeta>

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    const updated = await updateNote<MeetingMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating meeting:", e)
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { path } = (await req.json()) as { path: string }

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    await deleteNote(path)
    return NextResponse.json({ deleted: true, path })
  } catch (e) {
    console.error("Error deleting meeting:", e)
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    )
  }
}
