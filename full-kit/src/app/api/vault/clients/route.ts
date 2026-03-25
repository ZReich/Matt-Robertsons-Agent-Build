import { NextResponse } from "next/server"

import { listNotes, updateNote, createNote, archiveNote } from "@/lib/vault"
import type { ClientMeta } from "@/lib/vault"

export async function GET() {
  try {
    const notes = await listNotes<ClientMeta>("clients")
    const clients = notes.filter((n) => n.meta.type === "client")

    return NextResponse.json(clients)
  } catch (e) {
    console.error("Error reading clients:", e)
    return NextResponse.json(
      { error: "Failed to read clients" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, company, email, phone, role, preferred_contact, content = "" } = body

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      )
    }

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    const today = new Date().toISOString().split("T")[0]

    const meta: ClientMeta = {
      type: "client",
      category: "business",
      name,
      ...(company && { company }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(role && { role }),
      ...(preferred_contact && { preferred_contact }),
      created: today,
    }

    const note = await createNote<ClientMeta>(
      `clients/${slug}`,
      `${name}.md`,
      meta,
      content
    )

    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating client:", e)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<ClientMeta>

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      )
    }

    const updated = await updateNote<ClientMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating client:", e)
    return NextResponse.json(
      { error: "Failed to update client" },
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

    const archived = await archiveNote<ClientMeta>(path)
    return NextResponse.json({ archived: true, path: archived.path })
  } catch (e) {
    console.error("Error archiving client:", e)
    return NextResponse.json(
      { error: "Failed to archive client" },
      { status: 500 }
    )
  }
}
