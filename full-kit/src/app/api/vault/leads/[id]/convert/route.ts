import { NextResponse } from "next/server"

import type { ClientMeta, ContactMethod } from "@/lib/vault"

import { db } from "@/lib/prisma"
import { createNote, listNotes, sanitizeFilename, toSlug } from "@/lib/vault"

const CONTACT_METHODS = new Set<ContactMethod>([
  "email",
  "phone",
  "text",
  "whatsapp",
])

function preferredContact(value: string | null): ContactMethod | undefined {
  if (!value) return undefined
  return CONTACT_METHODS.has(value as ContactMethod)
    ? (value as ContactMethod)
    : undefined
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const contact = await db.contact.findUnique({ where: { id } })
  if (!contact)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  if (contact.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 }
    )
  }

  if (contact.email) {
    const existing = await listNotes<ClientMeta>("clients")
    const match = existing.find(
      (note) =>
        note.meta.type === "client" &&
        note.meta.email?.toLowerCase() === contact.email?.toLowerCase()
    )
    if (match) {
      await db.contact.update({
        where: { id },
        data: { leadStatus: "converted" },
      })
      return NextResponse.json({
        ok: true,
        alreadyClient: true,
        clientPath: match.path,
      })
    }
  }

  const today = new Date().toISOString().split("T")[0]
  const slug = toSlug(contact.name) || "lead"
  const filename = `${sanitizeFilename(contact.name) || slug}.md`
  const contactPreference = preferredContact(contact.preferredContact)
  const meta: ClientMeta = {
    type: "client",
    category: "business",
    name: contact.name,
    ...(contact.company ? { company: contact.company } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.phone ? { phone: contact.phone } : {}),
    ...(contact.role ? { role: contact.role } : {}),
    ...(contactPreference ? { preferred_contact: contactPreference } : {}),
    created: today,
  }

  const note = await createNote<ClientMeta>(
    `clients/${slug}`,
    filename,
    meta,
    contact.notes ?? ""
  )

  await db.contact.update({
    where: { id },
    data: { leadStatus: "converted" },
  })

  return NextResponse.json(
    { ok: true, alreadyClient: false, clientPath: note.path },
    { status: 201 }
  )
}
