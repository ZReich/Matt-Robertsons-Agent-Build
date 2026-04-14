import { NextResponse } from "next/server"

import type { DealMeta, DealStage } from "@/lib/vault"

import { archiveNote, createNote, listNotes, updateNote } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const stage = searchParams.get("stage")

    const notes = await listNotes<DealMeta>("clients")
    const deals = notes.filter((n) => n.meta.type === "deal")

    const filtered = stage ? deals.filter((d) => d.meta.stage === stage) : deals

    return NextResponse.json(filtered)
  } catch (e) {
    console.error("Error reading deals:", e)
    return NextResponse.json({ error: "Failed to read deals" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      client,
      property_address,
      property_type,
      stage = "prospecting",
      value,
      square_feet,
      listed_date,
      closing_date,
      content = "",
    } = body

    if (!client || !property_address || !property_type) {
      return NextResponse.json(
        { error: "client, property_address, and property_type are required" },
        { status: 400 }
      )
    }

    // Build client folder slug
    const clientSlug = client
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

    const filename = `${property_address}.md`
    const today = new Date().toISOString().split("T")[0]

    const meta: DealMeta = {
      type: "deal",
      category: "business",
      client,
      property_address,
      property_type,
      stage: stage as DealStage,
      ...(value && { value }),
      ...(square_feet && { square_feet }),
      listed_date: listed_date || today,
      ...(closing_date && { closing_date }),
      created: today,
    }

    const note = await createNote<DealMeta>(
      `clients/${clientSlug}`,
      filename,
      meta,
      content
    )

    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    console.error("Error creating deal:", e)
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, ...updates } = body as { path: string } & Partial<DealMeta>

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    const updated = await updateNote<DealMeta>(path, updates)
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Error updating deal:", e)
    return NextResponse.json(
      { error: "Failed to update deal" },
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

    const archived = await archiveNote<DealMeta>(path)
    return NextResponse.json({ archived: true, path: archived.path })
  } catch (e) {
    console.error("Error archiving deal:", e)
    return NextResponse.json(
      { error: "Failed to archive deal" },
      { status: 500 }
    )
  }
}
