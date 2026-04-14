import { NextResponse } from "next/server"

import type { TemplateMeta } from "@/lib/vault"

import { createNote, deleteNote, listNotes, updateNote } from "@/lib/vault"

export async function GET() {
  try {
    const notes = await listNotes<TemplateMeta>("templates")

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading templates:", e)
    return NextResponse.json(
      { error: "Failed to read templates" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, subject, use_case, content = "" } = body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const filename = `${name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}.md`
    const today = new Date().toISOString().split("T")[0]

    const meta: TemplateMeta = {
      type: "template",
      category: "business",
      name,
      ...(subject && { subject }),
      ...(use_case && { use_case }),
      created: today,
    }

    const note = await createNote<TemplateMeta>(
      "templates",
      filename,
      meta,
      content
    )
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating template:", e)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as {
      path: string
    } & Partial<TemplateMeta>

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    const updated = await updateNote<TemplateMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating template:", e)
    return NextResponse.json(
      { error: "Failed to update template" },
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
    console.error("Error deleting template:", e)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}
