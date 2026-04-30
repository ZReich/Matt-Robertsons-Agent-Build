/**
 * Server-side utility for resolving rich context for todos.
 * Cross-references todo metadata against clients, contacts, deals, and communications.
 *
 * This runs ONLY on the server (uses vault reader). The resolved context
 * is serialized and passed to client components as plain objects.
 */

import type { AttachmentSummary } from "@/lib/communications/attachment-types"
import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
  VaultNote,
} from "./types"

import {
  getAttachmentSummary,
  getExplicitAttachmentSummary,
} from "@/lib/communications/attachment-types"
import { getOutlookDeeplinkForSource } from "@/lib/communications/outlook-deeplink"
import { prismaTodoPath } from "@/lib/todos/paths"

import { normalizeEntityRef, toSlug } from "./utils"

/** Minimal resolved client/contact info for UI display */
export interface ResolvedPerson {
  name: string
  slug: string
  company?: string
  email?: string
  phone?: string
  role?: string
  preferredContact?: string
  /** "clients" or "contacts" — determines the link path */
  entityType: "clients" | "contacts"
}

/** Minimal resolved deal info for UI display */
export interface ResolvedDeal {
  noteTitle: string
  slug: string
  /**
   * Null for buyer-rep deals (and seller-rep deals with no parseable address
   * yet) — UI must render a fallback string in that case.
   */
  propertyAddress: string | null
  propertyType?: string
  stage: string
  value?: number
  squareFeet?: number
  clientName?: string
  closingDate?: string
  keyContacts?: Record<string, string>
}

/** Minimal resolved source communication for UI display */
export interface ResolvedSourceComm {
  path: string
  channel: string
  subject?: string
  date: string
  contact?: string
  externalMessageId?: string | null
  sourceSystem?: string | null
  outlookUrl?: string | null
  attachments?: AttachmentSummary
}

/** Full resolved context for a single todo */
export interface TodoResolvedContext {
  person?: ResolvedPerson
  deal?: ResolvedDeal
  sourceComm?: ResolvedSourceComm
}

type DecimalLike = number | string | { toNumber(): number } | null | undefined

interface PrismaContactContext {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
  preferredContact?: string | null
}

interface PrismaDealContext {
  id: string
  // propertyAddress / propertyType are nullable because buyer-rep deals (and
  // seller-rep deals whose lead inquiry didn't yield a parseable address)
  // exist without a concrete property. Todos can be linked to those deals
  // during the search phase, so the renderer below handles the null case.
  propertyAddress: string | null
  propertyType?: string | null
  stage: string
  value?: DecimalLike
  squareFeet?: number | null
  closingDate?: Date | string | null
  keyContacts?: unknown
  contact?: { name: string } | null
}

interface PrismaCommunicationContext {
  id: string
  channel: string
  subject?: string | null
  date: Date | string
  externalMessageId?: string | null
  createdBy?: string | null
  metadata?: unknown
  contact?: { name: string } | null
}

export interface PrismaTodoContextInput {
  id: string
  contact?: PrismaContactContext | null
  deal?: PrismaDealContext | null
  communication?: PrismaCommunicationContext | null
}

/**
 * Build lookup maps from vault notes for efficient context resolution.
 * Call once per page render, then use with `resolveTodoContext`.
 */
export function buildContextMaps(
  clientNotes: VaultNote<ClientMeta>[],
  contactNotes: VaultNote<ContactMeta>[],
  dealNotes: VaultNote<DealMeta>[],
  commNotes: VaultNote<CommunicationMeta>[]
) {
  // People: keyed by normalized name → resolved person
  const peopleByName = new Map<string, ResolvedPerson>()

  for (const n of clientNotes) {
    if (n.meta.type !== "client") continue
    const name = n.meta.name
    if (!name) continue
    const slug = n.path.split("/")[1] ?? toSlug(name)
    peopleByName.set(name, {
      name,
      slug,
      company: n.meta.company,
      email: n.meta.email,
      phone: n.meta.phone,
      role: n.meta.role,
      preferredContact: n.meta.preferred_contact,
      entityType: "clients",
    })
  }

  for (const n of contactNotes) {
    if (n.meta.type !== "contact") continue
    const name = n.meta.name
    if (!name) continue
    const filename = n.path.split("/").pop() ?? ""
    const slug = filename
      .replace(/\.md$/, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
    // Don't overwrite a client entry — business takes priority
    if (!peopleByName.has(name)) {
      peopleByName.set(name, {
        name,
        slug,
        company: n.meta.company,
        email: n.meta.email,
        phone: n.meta.phone,
        role: n.meta.role,
        entityType: "contacts",
      })
    }
  }

  // Deals: keyed by note title (the filename without .md and path prefix)
  // e.g., "123 Main St Office" from vault path "clients/john-smith/123 Main St Office.md"
  const dealsByTitle = new Map<string, ResolvedDeal>()

  for (const n of dealNotes) {
    if (n.meta.type !== "deal") continue
    const filename = n.path.split("/").pop() ?? ""
    const noteTitle = filename.replace(/\.md$/, "")
    const clientSlug = n.path.split("/")[1] ?? ""
    dealsByTitle.set(noteTitle, {
      noteTitle,
      slug: clientSlug + "/" + toSlug(noteTitle),
      propertyAddress: n.meta.property_address,
      propertyType: n.meta.property_type,
      stage: n.meta.stage,
      value: n.meta.value,
      squareFeet: n.meta.square_feet,
      clientName: n.meta.client ? normalizeEntityRef(n.meta.client) : undefined,
      closingDate: n.meta.closing_date,
      keyContacts: n.meta.key_contacts as Record<string, string> | undefined,
    })
  }

  // Communications: keyed by vault path for source_communication lookups
  const commsByPath = new Map<string, ResolvedSourceComm>()

  for (const n of commNotes) {
    commsByPath.set(n.path, {
      path: n.path,
      channel: n.meta.channel,
      subject: n.meta.subject,
      date: n.meta.date,
      contact: n.meta.contact ? normalizeEntityRef(n.meta.contact) : undefined,
      attachments: nonEmptyExplicitAttachmentSummary(
        n.meta.attachments,
        n.meta.attachmentFetchStatus
      ),
    })
  }

  return { peopleByName, dealsByTitle, commsByPath }
}

/**
 * Resolve rich context for a single todo.
 */
export function resolveTodoContext(
  todo: VaultNote<TodoMeta>,
  maps: ReturnType<typeof buildContextMaps>
): TodoResolvedContext {
  const ctx: TodoResolvedContext = {}

  // Resolve person (contact/client)
  if (todo.meta.contact) {
    const name = normalizeEntityRef(todo.meta.contact)
    ctx.person = maps.peopleByName.get(name)
  }

  // Resolve deal
  if (todo.meta.deal) {
    const dealTitle = normalizeEntityRef(todo.meta.deal)
    ctx.deal = maps.dealsByTitle.get(dealTitle)
  }

  // Resolve source communication
  if (todo.meta.source_communication) {
    ctx.sourceComm = maps.commsByPath.get(todo.meta.source_communication)
  }

  return ctx
}

/**
 * Resolve context for all todos in a batch.
 * Returns a Record keyed by todo vault path.
 */
export function resolveAllTodoContexts(
  todos: VaultNote<TodoMeta>[],
  clientNotes: VaultNote<ClientMeta>[],
  contactNotes: VaultNote<ContactMeta>[],
  dealNotes: VaultNote<DealMeta>[],
  commNotes: VaultNote<CommunicationMeta>[]
): Record<string, TodoResolvedContext> {
  const maps = buildContextMaps(clientNotes, contactNotes, dealNotes, commNotes)
  const result: Record<string, TodoResolvedContext> = {}

  for (const todo of todos) {
    result[todo.path] = resolveTodoContext(todo, maps)
  }

  return result
}

/**
 * Resolve rich context for Prisma-backed todos.
 *
 * Prisma todos are represented to the UI as synthetic vault notes keyed by
 * `prisma-todos/<uuid>`, but their context lives in relational Prisma data
 * instead of vault note paths. This pure adapter maps already-fetched Prisma
 * relations into the same drawer context shape used by vault todos.
 */
export function resolvePrismaTodoContexts(
  todos: PrismaTodoContextInput[]
): Record<string, TodoResolvedContext> {
  const result: Record<string, TodoResolvedContext> = {}

  for (const todo of todos) {
    const context: TodoResolvedContext = {}

    if (todo.contact) {
      context.person = {
        name: todo.contact.name,
        slug: todo.contact.id,
        company: todo.contact.company ?? undefined,
        email: todo.contact.email ?? undefined,
        phone: todo.contact.phone ?? undefined,
        role: todo.contact.role ?? undefined,
        preferredContact: todo.contact.preferredContact ?? undefined,
        entityType: "contacts",
      }
    }

    if (todo.deal) {
      const propertyAddress = todo.deal.propertyAddress
      context.deal = {
        // Buyer-rep deals (and seller-rep deals with no parseable address yet)
        // surface a placeholder title here so the drawer still has something
        // to label the deal pill with.
        noteTitle: propertyAddress ?? "(no specific property)",
        slug: todo.deal.id,
        propertyAddress: propertyAddress,
        propertyType: todo.deal.propertyType
          ? normalizePrismaEnum(todo.deal.propertyType)
          : undefined,
        stage: normalizePrismaEnum(todo.deal.stage),
        value: decimalToNumber(todo.deal.value),
        squareFeet: todo.deal.squareFeet ?? undefined,
        clientName: todo.deal.contact?.name,
        closingDate: todo.deal.closingDate
          ? toIsoString(todo.deal.closingDate)
          : undefined,
        keyContacts: recordOfStrings(todo.deal.keyContacts),
      }
    }

    if (todo.communication) {
      const sourceSystem = getCommunicationSourceSystem(todo.communication)
      const outlookUrl = getOutlookDeeplinkForSource(
        todo.communication.externalMessageId,
        sourceSystem
      )

      context.sourceComm = {
        path: `communication:${todo.communication.id}`,
        channel: todo.communication.channel,
        subject: todo.communication.subject ?? undefined,
        date: toIsoString(todo.communication.date),
        contact: todo.communication.contact?.name,
        externalMessageId: todo.communication.externalMessageId ?? undefined,
        sourceSystem: sourceSystem ?? undefined,
        outlookUrl: outlookUrl ?? undefined,
        attachments: nonEmptyAttachmentSummary(todo.communication.metadata),
      }
    }

    result[prismaTodoPath(todo.id)] = context
  }

  return result
}

function nonEmptyAttachmentSummary(metadata: unknown) {
  const summary = getAttachmentSummary(metadata)
  return summary.items.length > 0 || summary.fetchStatus ? summary : undefined
}

function nonEmptyExplicitAttachmentSummary(items: unknown, status?: unknown) {
  const summary = getExplicitAttachmentSummary(items, status)
  return summary.items.length > 0 || summary.fetchStatus ? summary : undefined
}

function decimalToNumber(value: DecimalLike) {
  if (value == null) return undefined
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  return value.toNumber()
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function normalizePrismaEnum(value: string) {
  return value.replace(/_/g, "-")
}

function getCommunicationSourceSystem(
  communication: PrismaCommunicationContext
) {
  // createdBy identifies the ingestion/mailbox system (e.g. "msgraph-email").
  // Communication.metadata.source holds lead-classification values like
  // "crexi-lead" or "loopnet-lead" — those are routing tags from the message
  // body, not mailbox identifiers, and must NOT be used to decide whether a
  // message is Outlook-readable.
  return communication.createdBy ?? null
}

function recordOfStrings(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
