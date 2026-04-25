import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true, leadSource: true },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  if (existing.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 }
    )
  }

  const now = new Date()
  await db.contact.update({
    where: { id },
    data: { leadLastViewedAt: now },
  })

  return NextResponse.json({ ok: true, leadLastViewedAt: now.toISOString() })
}
