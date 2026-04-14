import { NextResponse } from "next/server"

import type { ContactMeta } from "@/lib/vault"

import { createNote, deleteNote, listNotes, updateNote } from "@/lib/vault"

export async function GET() {
  try {
    const notes = await listNotes<ContactMeta>("contacts")

    return NextResponse.json(notes)
  } catch (e) {
    console.error("Error reading contacts:", e)
    return NextResponse.json(
      { error: "Failed to read contacts" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, role, company, email, phone, address, content = "" } = body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const today = new Date().toISOString().split("T")[0]

    const meta: ContactMeta = {
      type: "contact",
      category: "personal",
      name,
      ...(role && { role }),
      ...(company && { company }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(address && { address }),
      created: today,
    }

    const note = await createNote<ContactMeta>(
      "contacts",
      `${name}.md`,
      meta,
      content
    )
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating contact:", e)
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<ContactMeta>

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    const updated = await updateNote<ContactMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating contact:", e)
    return NextResponse.json(
      { error: "Failed to update contact" },
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
    console.error("Error deleting contact:", e)
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    )
  }
}
