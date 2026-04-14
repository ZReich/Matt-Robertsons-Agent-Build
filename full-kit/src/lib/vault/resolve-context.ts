/**
 * Server-side utility for resolving rich context for todos.
 * Cross-references todo metadata against clients, contacts, deals, and communications.
 *
 * This runs ONLY on the server (uses vault reader). The resolved context
 * is serialized and passed to client components as plain objects.
 */

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
  VaultNote,
} from "./types"

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
  propertyAddress: string
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
}

/** Full resolved context for a single todo */
export interface TodoResolvedContext {
  person?: ResolvedPerson
  deal?: ResolvedDeal
  sourceComm?: ResolvedSourceComm
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
