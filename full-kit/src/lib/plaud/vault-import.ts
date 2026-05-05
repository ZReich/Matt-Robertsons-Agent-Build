import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { listNotes } from "@/lib/vault/reader"

interface VaultCommunicationMeta {
  type: string
  category: "business" | "personal"
  tags?: string[]
  channel?: unknown
  contact?: unknown
  deal?: unknown
  subject?: unknown
  date?: unknown
  direction?: unknown
}

export interface VaultPlaudImportResult {
  imported: number
  skipped: number
  errors: number
}

export async function importVaultPlaudNotes(): Promise<VaultPlaudImportResult> {
  const result: VaultPlaudImportResult = { imported: 0, skipped: 0, errors: 0 }
  let notes: Array<{
    path: string
    meta: VaultCommunicationMeta
    content: string
  }>
  try {
    notes = await listNotes<VaultCommunicationMeta>("communications")
  } catch {
    return result
  }

  for (const note of notes) {
    if (note.meta.channel !== "call") continue
    if (!/plaud transcript summary/i.test(note.content)) continue
    const externalId = `vault:${note.path}`
    try {
      const existing = await db.externalSync.findUnique({
        where: { source_externalId: { source: "plaud-vault", externalId } },
      })
      if (existing?.status === "synced") {
        result.skipped++
        continue
      }

      const [contact, deal] = await Promise.all([
        resolveContact(note.meta.contact),
        resolveDeal(note.meta.deal),
      ])
      await db.$transaction(async (tx) => {
        const externalSync = await tx.externalSync.upsert({
          where: { source_externalId: { source: "plaud-vault", externalId } },
          create: {
            source: "plaud-vault",
            externalId,
            entityType: "communication",
            rawData: {
              path: note.path,
              frontmatter: note.meta,
            } as unknown as Prisma.InputJsonValue,
            status: "synced",
          },
          update: {
            rawData: {
              path: note.path,
              frontmatter: note.meta,
            } as unknown as Prisma.InputJsonValue,
            status: "synced",
            errorMsg: null,
          },
        })
        await tx.communication.create({
          data: {
            channel: "call",
            subject: asString(note.meta.subject),
            body: note.content,
            date: parseDate(note.meta.date),
            direction:
              note.meta.direction === "inbound" ||
              note.meta.direction === "outbound"
                ? note.meta.direction
                : null,
            contactId: contact?.id ?? null,
            dealId: deal?.id ?? null,
            externalSyncId: externalSync.id,
            tags: asStringArray(note.meta.tags) as Prisma.InputJsonValue,
            metadata: {
              source: "plaud",
              sourceImport: "vault",
              plaudId: externalId,
              plaudFilename: note.path,
              vaultPath: note.path,
              extractedSignals: {
                counterpartyName: contact?.name ?? wikiName(note.meta.contact),
                topic: asString(note.meta.subject),
                mentionedCompanies: [],
                mentionedProperties: deal?.propertyAddress
                  ? [deal.propertyAddress]
                  : [],
                tailSynopsis: note.content,
              },
              suggestions: contact
                ? [
                    {
                      contactId: contact.id,
                      score: 100,
                      source: "vault_frontmatter",
                      reason: `vault note frontmatter links [[${contact.name}]]`,
                    },
                  ]
                : [],
              dealSuggestions: deal
                ? [
                    {
                      dealId: deal.id,
                      contactId: deal.contactId,
                      score: 100,
                      source: "vault_frontmatter",
                      reason: `vault note frontmatter links deal "${deal.propertyAddress ?? deal.id}"`,
                    },
                  ]
                : [],
              dealReviewStatus: deal ? "linked" : "none",
            } as Prisma.InputJsonValue,
          },
        })
      })
      result.imported++
    } catch (err) {
      result.errors++
      await db.externalSync.upsert({
        where: { source_externalId: { source: "plaud-vault", externalId } },
        create: {
          source: "plaud-vault",
          externalId,
          entityType: "communication",
          status: "failed",
          errorMsg: err instanceof Error ? err.message : String(err),
        },
        update: {
          status: "failed",
          errorMsg: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }
  return result
}

async function resolveContact(
  value: unknown
): Promise<{ id: string; name: string } | null> {
  const name = wikiName(value)
  if (!name) return null
  return db.contact.findFirst({
    where: { archivedAt: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
}

async function resolveDeal(value: unknown): Promise<{
  id: string
  contactId: string
  propertyAddress: string | null
} | null> {
  const name = wikiName(value)
  if (!name) return null
  return db.deal.findFirst({
    where: {
      archivedAt: null,
      OR: [
        { propertyAddress: { equals: name, mode: "insensitive" } },
        { notes: { contains: name, mode: "insensitive" } },
      ],
    },
    select: { id: true, contactId: true, propertyAddress: true },
  })
}

function wikiName(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").trim() || null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : []
}

function parseDate(value: unknown): Date {
  const s = asString(value)
  if (!s) return new Date()
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : new Date()
}
