import { db } from "@/lib/prisma"

type MetadataRecord = Record<string, unknown>

export type HeuristicMatches = {
  contacts: Array<{
    id: string
    name: string
    email: string | null
    reason: string
  }>
  deals: Array<{ id: string; propertyAddress: string; reason: string }>
}

export type OpenTodoCandidate = {
  id: string
  title: string
  status: string
  dueDate: string | null
  contactId: string | null
  dealId: string | null
  communicationId: string | null
  createdAt: string
  updatedAt: string
}

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function metadataString(metadata: unknown, key: string): string | null {
  const value = asRecord(metadata)[key]
  return typeof value === "string" ? value : null
}

function recipientEmail(recipient: unknown): string | null {
  const emailAddress = asRecord(asRecord(recipient).emailAddress)
  const address =
    typeof emailAddress.address === "string" ? emailAddress.address : null
  return address?.trim().toLowerCase() || null
}

export function extractOutboundRecipientEmails(metadata: unknown): string[] {
  const record = asRecord(metadata)
  const emails = new Set<string>()
  for (const key of ["toRecipients", "ccRecipients"]) {
    const recipients = record[key]
    if (!Array.isArray(recipients)) continue
    for (const recipient of recipients) {
      const email = recipientEmail(recipient)
      if (email?.includes("@")) emails.add(email)
    }
  }
  return [...emails].slice(0, 25)
}

export function extractSenderEmail(metadata: unknown): string | null {
  const from = asRecord(asRecord(metadata).from)
  const address = from.address
  return typeof address === "string" ? address.toLowerCase() : null
}

export async function runHeuristicLinker(comm: {
  subject: string | null
  body: string | null
  contactId?: string | null
  dealId?: string | null
  metadata?: unknown
}): Promise<HeuristicMatches> {
  const senderEmail = extractSenderEmail(comm.metadata)
  const contacts = senderEmail
    ? await db.contact.findMany({
        where: { email: { equals: senderEmail, mode: "insensitive" } },
        take: 5,
        select: { id: true, name: true, email: true },
      })
    : []

  const haystack = `${comm.subject ?? ""}\n${comm.body ?? ""}`.toLowerCase()
  const deals = await db.deal.findMany({
    where: { archivedAt: null },
    take: 25,
    select: { id: true, propertyAddress: true },
  })

  return {
    contacts: contacts.map((contact) => ({
      ...contact,
      reason: "sender_email",
    })),
    deals: deals
      .filter((deal) => {
        const address = deal.propertyAddress.toLowerCase()
        return address.length > 5 && haystack.includes(address)
      })
      .slice(0, 5)
      .map((deal) => ({
        id: deal.id,
        propertyAddress: deal.propertyAddress,
        reason: "property_address",
      })),
  }
}

export async function loadScopedMemory(
  matches: HeuristicMatches
): Promise<string> {
  const contactIds = matches.contacts.map((contact) => contact.id)
  const dealIds = matches.deals.map((deal) => deal.id)
  const memories = await db.agentMemory.findMany({
    where: {
      OR: [
        { contactId: { in: contactIds.length ? contactIds : ["__none__"] } },
        { dealId: { in: dealIds.length ? dealIds : ["__none__"] } },
      ],
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true },
  })
  return memories
    .map((memory) => `## ${memory.title}\n${memory.content}`)
    .join("\n\n")
}

export async function loadGlobalMemoryBlock(): Promise<string> {
  const memories = await db.agentMemory.findMany({
    where: { contactId: null, dealId: null },
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true },
  })
  return memories
    .map((memory) => `## ${memory.title}\n${memory.content}`)
    .join("\n\n")
}

export async function loadRecentThread(comm: {
  metadata?: unknown
}): Promise<string> {
  const conversationId = metadataString(comm.metadata, "conversationId")
  if (!conversationId) return ""
  const rows = await db.communication.findMany({
    where: { metadata: { path: ["conversationId"], equals: conversationId } },
    orderBy: { date: "desc" },
    take: 3,
    select: { date: true, subject: true, body: true },
  })
  return rows
    .map(
      (row) =>
        `${row.date.toISOString()} ${row.subject ?? ""}: ${(row.body ?? "").slice(0, 300)}`
    )
    .join("\n")
}

export async function loadOpenTodoCandidates(
  comm: {
    id?: string | null
    conversationId?: string | null
    contactId?: string | null
    dealId?: string | null
    direction?: string | null
    metadata?: unknown
  },
  matches: HeuristicMatches
): Promise<OpenTodoCandidate[]> {
  const contactIds = new Set(
    [
      comm.contactId ?? null,
      ...matches.contacts.map((contact) => contact.id),
    ].filter(Boolean) as string[]
  )
  const dealIds = new Set(
    [comm.dealId ?? null, ...matches.deals.map((deal) => deal.id)].filter(
      Boolean
    ) as string[]
  )
  const communicationIds = new Set(
    [comm.id ?? null].filter(Boolean) as string[]
  )
  if (comm.direction === "outbound") {
    const recipientEmails = extractOutboundRecipientEmails(comm.metadata)
    if (recipientEmails.length > 0) {
      const recipientContacts = await db.contact.findMany({
        where: {
          archivedAt: null,
          email: { in: recipientEmails, mode: "insensitive" },
        },
        take: 25,
        select: { id: true },
      })
      for (const contact of recipientContacts) {
        contactIds.add(contact.id)
      }
    }
  }
  if (comm.conversationId) {
    const threadComms = await db.communication.findMany({
      where: { conversationId: comm.conversationId },
      take: 20,
      select: { id: true },
    })
    for (const threadComm of threadComms) {
      communicationIds.add(threadComm.id)
    }
  }
  if (
    contactIds.size === 0 &&
    dealIds.size === 0 &&
    communicationIds.size === 0
  ) {
    return []
  }

  const rows = await db.todo.findMany({
    where: {
      archivedAt: null,
      status: { in: ["pending", "in_progress"] },
      OR: [
        ...Array.from(contactIds).map((contactId) => ({ contactId })),
        ...Array.from(dealIds).map((dealId) => ({ dealId })),
        ...Array.from(communicationIds).map((communicationId) => ({
          communicationId,
        })),
      ],
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      contactId: true,
      dealId: true,
      communicationId: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((row) => ({
    ...row,
    dueDate: row.dueDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function hasThreadOutboundEvidence(comm: {
  id?: string | null
  conversationId?: string | null
}): Promise<boolean> {
  if (!comm.conversationId) return false
  const count = await db.communication.count({
    where: {
      direction: "outbound",
      id: comm.id ? { not: comm.id } : undefined,
      OR: [
        { conversationId: comm.conversationId },
        {
          metadata: {
            path: ["conversationId"],
            equals: comm.conversationId,
          },
        },
      ],
    },
  })
  return count > 0
}
