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

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function metadataString(metadata: unknown, key: string): string | null {
  const value = asRecord(metadata)[key]
  return typeof value === "string" ? value : null
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
