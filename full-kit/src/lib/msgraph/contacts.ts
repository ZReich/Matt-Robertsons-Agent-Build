import { db } from "@/lib/prisma";
import type { Prisma } from ".prisma/client";

// =============================================================================
// Graph contact payload shapes (narrow — only fields we consume)
// =============================================================================

export interface GraphContactAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryOrRegion?: string | null;
}

export interface GraphContactEmail {
  name?: string | null;
  address: string;
}

export interface GraphContact {
  id: string;
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  emailAddresses?: GraphContactEmail[];
  mobilePhone?: string | null;
  businessPhones?: string[];
  homePhones?: string[];
  companyName?: string | null;
  businessAddress?: GraphContactAddress;
  categories?: string[];
  personalNotes?: string | null;
  // The Graph API returns many more fields; they live verbatim
  // on ExternalSync.rawData.graphContact for future use. Not typed here.
}

/** Graph delta tombstone for a removed contact. */
export interface GraphContactRemoved {
  id: string;
  "@removed": { reason: string };
}

// =============================================================================
// Mapping types
// =============================================================================

export interface ContactPartialFields {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tags?: string[];
}

export interface ContactCreateOnlyFields {
  name: string;
  category: "business";
  createdBy: string;
  notes: string | null;
}

export interface MappedContact {
  partial: ContactPartialFields;
  createOnly: ContactCreateOnlyFields;
}

// =============================================================================
// Pure mapper
// =============================================================================

/**
 * Turn a Graph contact payload into a partial update-safe map PLUS a
 * createOnly block of defaults used on first insert.
 *
 * Graph's delta endpoint may return an updated contact as { id, ...changed }
 * — NOT a full resource. `partial` therefore only contains keys that Graph
 * actually provided; absent keys mean "don't touch" on update.
 */
export function mapGraphToContact(gc: GraphContact): MappedContact {
  const partial: ContactPartialFields = {};

  // name — set in partial only if Graph provided something that implies it
  const derivedName = deriveName(gc);
  if (derivedName !== undefined) {
    partial.name = derivedName;
  }

  if (Object.prototype.hasOwnProperty.call(gc, "companyName")) {
    partial.company = nullish(gc.companyName);
  }

  if (gc.emailAddresses !== undefined) {
    partial.email = gc.emailAddresses[0]?.address ?? null;
  }

  const phone = derivePhone(gc);
  if (phone !== "unset") {
    partial.phone = phone;
  }

  if (gc.businessAddress !== undefined) {
    partial.address = formatAddress(gc.businessAddress);
  }

  if (gc.categories !== undefined) {
    partial.tags = [...gc.categories];
  }

  const createOnly: ContactCreateOnlyFields = {
    name: derivedName ?? gc.id,
    category: "business",
    createdBy: "msgraph-contacts",
    notes: gc.personalNotes && gc.personalNotes.length > 0 ? gc.personalNotes : null,
  };

  return { partial, createOnly };
}

function deriveName(gc: GraphContact): string | undefined {
  if (gc.displayName) return gc.displayName;
  if (gc.givenName || gc.surname) {
    return [gc.givenName, gc.surname].filter(Boolean).join(" ");
  }
  const firstEmail = gc.emailAddresses?.[0];
  if (firstEmail?.name) return firstEmail.name;
  if (firstEmail?.address) return firstEmail.address;
  return undefined;
}

function derivePhone(gc: GraphContact): string | null | "unset" {
  // "unset" marker = Graph provided no phone-related keys at all; leave DB column alone.
  if (
    gc.mobilePhone === undefined &&
    gc.businessPhones === undefined &&
    gc.homePhones === undefined
  ) {
    return "unset";
  }
  if (gc.mobilePhone) return gc.mobilePhone;
  if (gc.businessPhones && gc.businessPhones[0]) return gc.businessPhones[0];
  if (gc.homePhones && gc.homePhones[0]) return gc.homePhones[0];
  return null;
}

function formatAddress(addr: GraphContactAddress): string | null {
  const parts: string[] = [];
  if (addr.street) parts.push(addr.street);
  const cityStateZip = [
    addr.city,
    [addr.state, addr.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) parts.push(cityStateZip);
  if (addr.countryOrRegion) parts.push(addr.countryOrRegion);
  const formatted = parts.join(", ");
  return formatted.length > 0 ? formatted : null;
}

function nullish(v: string | null | undefined): string | null {
  return v === undefined || v === null || v === "" ? null : v;
}

// =============================================================================
// Cursor helpers — one special ExternalSync row with externalId="__cursor__"
// =============================================================================

const SOURCE = "msgraph-contacts";
const CURSOR_EXTERNAL_ID = "__cursor__";

export interface Cursor {
  deltaLink: string;
}

export async function loadCursor(): Promise<Cursor | null> {
  const row = await db.externalSync.findUnique({
    where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
  });
  if (!row) return null;
  const raw = row.rawData as unknown;
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    typeof (raw as Record<string, unknown>).deltaLink === "string" &&
    (raw as Record<string, string>).deltaLink.length > 0
  ) {
    return { deltaLink: (raw as Record<string, string>).deltaLink };
  }
  // Malformed rawData — force the caller into bootstrap mode.
  return null;
}

export async function saveCursor(deltaLink: string): Promise<void> {
  await db.externalSync.upsert({
    where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
    create: {
      source: SOURCE,
      externalId: CURSOR_EXTERNAL_ID,
      entityType: "cursor",
      entityId: null,
      rawData: { deltaLink },
      status: "synced",
    },
    update: {
      rawData: { deltaLink },
      syncedAt: new Date(),
      status: "synced",
    },
  });
}

export async function deleteCursor(): Promise<void> {
  try {
    await db.externalSync.delete({
      where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
    });
  } catch (err) {
    // P2025 = "an operation failed because it depends on one or more records that were required but not found"
    if ((err as { code?: string })?.code !== "P2025") throw err;
  }
}

// =============================================================================
// Per-item operations
// =============================================================================

export type UpsertOutcome = "created" | "updated" | "unarchived";

export async function upsertContact(graphContact: GraphContact): Promise<UpsertOutcome> {
  const { partial, createOnly } = mapGraphToContact(graphContact);

  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: SOURCE, externalId: graphContact.id },
    },
  });

  if (!existing) {
    // CREATE path — Contact + ExternalSync in one transaction
    const createData = {
      ...createOnly,
      ...partial,
    };
    const outcome = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const contact = await tx.contact.create({ data: createData });
      await tx.externalSync.create({
        data: {
          source: SOURCE,
          externalId: graphContact.id,
          entityType: "contact",
          entityId: contact.id,
          status: "synced",
          rawData: { graphContact },
        },
      });
      return "created" as const;
    });
    return outcome;
  }

  // UPDATE path
  if (!existing.entityId) {
    throw new Error(
      `ExternalSync (id=${existing.id}) for Graph contact ${graphContact.id} has no entityId. This violates the schema invariant for contact-type rows. Manual DB repair needed.`,
    );
  }
  const contact = await db.contact.findUnique({ where: { id: existing.entityId } });
  if (!contact) {
    throw new Error(
      `ExternalSync (id=${existing.id}) for Graph contact ${graphContact.id} points to missing Contact row ${existing.entityId}. Refusing to guess — manual DB repair needed.`,
    );
  }

  // Only clear archivedAt if the ExternalSync.status was "removed" (Graph-origin archive).
  // A manual archive (status="synced" but archivedAt set) is preserved.
  const graphOriginArchive = existing.status === "removed";
  const shouldUnarchive = graphOriginArchive;

  const updateData: Prisma.ContactUpdateInput = { ...partial };
  if (shouldUnarchive) {
    updateData.archivedAt = null;
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.contact.update({
      where: { id: contact.id },
      data: updateData,
    });
    await tx.externalSync.update({
      where: { id: existing.id },
      data: {
        status: "synced",
        syncedAt: new Date(),
        rawData: { graphContact },
      },
    });
  });

  return shouldUnarchive ? "unarchived" : "updated";
}
