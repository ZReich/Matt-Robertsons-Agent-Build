import { db } from "@/lib/prisma";
import { graphFetch } from "./client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GraphError } from "./errors";
import { loadMsgraphConfig } from "./config";
import type { EmailFolder, GraphEmailMessage, BehavioralHints } from "./email-types";
import { domainIsLargeCreBroker } from "./email-filter";
import type { LeadSource, Prisma } from ".prisma/client";
import type { InquirerInfo } from "./email-extractors";

const CURSOR_EXTERNAL_ID = "__cursor__";

function cursorSourceFor(folder: EmailFolder): string {
  return folder === "inbox" ? "msgraph-email-inbox" : "msgraph-email-sentitems";
}

export async function loadEmailCursor(
  folder: EmailFolder,
): Promise<{ deltaLink: string } | null> {
  const row = await db.externalSync.findUnique({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
  });
  if (!row) return null;
  const data = row.rawData as { deltaLink?: string } | null;
  if (!data?.deltaLink || typeof data.deltaLink !== "string") return null;
  return { deltaLink: data.deltaLink };
}

export async function saveEmailCursor(
  folder: EmailFolder,
  deltaLink: string,
): Promise<void> {
  await db.externalSync.upsert({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
    create: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
      entityType: "cursor",
      status: "synced",
      rawData: { deltaLink },
    },
    update: {
      rawData: { deltaLink },
      status: "synced",
      syncedAt: new Date(),
    },
  });
}

export async function deleteEmailCursor(folder: EmailFolder): Promise<void> {
  await db.externalSync.deleteMany({
    where: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
    },
  });
}

// ---------------------------------------------------------------------------
// Delta fetcher
// ---------------------------------------------------------------------------

interface GraphDeltaPage {
  value: Array<GraphEmailMessage & { "@removed"?: { reason: string } }>;
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

const EMAIL_SELECT_FIELDS = [
  "id",
  "internetMessageId",
  "conversationId",
  "parentFolderId",
  "subject",
  "from",
  "sender",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "isRead",
  "importance",
  "body",
  "bodyPreview",
  "internetMessageHeaders",
].join(",");

const PREFER_HEADER = {
  Prefer: 'outlook.body-content-type="text"',
};

const PAGE_SIZE = 100;

/**
 * Async generator that yields Graph email pages for a single folder.
 *
 * Starts from the stored cursor if one exists, or from the folder root
 * filtered by receivedDateTime >= sinceIso otherwise. Yields each page plus
 * the final deltaLink when the sync completes.
 */
export async function* fetchEmailDelta(
  folder: EmailFolder,
  sinceIso: string,
): AsyncGenerator<{ page: GraphDeltaPage; isFinal: boolean }, void, void> {
  const cfg = loadMsgraphConfig();
  const cursor = await loadEmailCursor(folder);

  const initialUrl =
    cursor?.deltaLink ??
    `/users/${encodeURIComponent(cfg.targetUpn)}/mailFolders/${folder}/messages/delta` +
      `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
      `&$select=${encodeURIComponent(EMAIL_SELECT_FIELDS)}` +
      `&$top=${PAGE_SIZE}`;

  let url: string | undefined = initialUrl;
  while (url) {
    const res: GraphDeltaPage = await graphFetch<GraphDeltaPage>(url, { headers: PREFER_HEADER });
    const isFinal = !res["@odata.nextLink"] && !!res["@odata.deltaLink"];
    yield { page: res, isFinal };
    url = res["@odata.nextLink"];
  }
}

/** Exported for test re-export and type-only consumers. */
export type { GraphDeltaPage };

/**
 * Compute behavioral hints for the filter context. These influence Layer A's
 * known-counterparty rule and are stored on uncertain rows as hints for the
 * future classifier spec.
 *
 * All queries are scoped to the single sender + conversation under test, so
 * they are cheap per-message.
 */
export async function computeBehavioralHints(
  senderAddress: string,
  conversationId: string | undefined,
): Promise<BehavioralHints> {
  const senderDomain = senderAddress.includes("@")
    ? senderAddress.split("@")[1]
    : undefined;

  const [contactRow, outboundCount, threadSize] = await Promise.all([
    senderAddress
      ? db.contact.findFirst({
          where: { email: { equals: senderAddress, mode: "insensitive" } },
          select: { id: true },
        })
      : Promise.resolve(null),
    senderAddress
      ? db.communication.count({
          where: {
            direction: "outbound",
            metadata: {
              path: ["toRecipients"],
              array_contains: [{ emailAddress: { address: senderAddress } }],
            },
          },
        })
      : Promise.resolve(0),
    conversationId
      ? db.communication.count({
          where: { metadata: { path: ["conversationId"], equals: conversationId } },
        })
      : Promise.resolve(0),
  ]);

  return {
    senderInContacts: !!contactRow,
    mattRepliedBefore: outboundCount > 0,
    threadSize: threadSize + 1,
    domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
  };
}

export interface UpsertLeadContactInput {
  inquirer: InquirerInfo;
  leadSource: LeadSource;
  leadAt: Date;
}

export interface UpsertLeadContactResult {
  contactId: string;
  created: boolean;
  becameLead: boolean;
}

/**
 * Create or update a Contact from an extracted lead inquirer.
 *
 * Rules:
 * - Requires inquirer.email (we key on normalized email).
 * - New Contact → created with leadSource, leadStatus=new, leadAt.
 * - Existing Contact with NO deals AND null leadSource → fill in lead fields.
 * - Existing Contact with deals (i.e. already a Client) → leave lead fields null.
 * - Existing Contact already a lead (leadSource set) → do not touch leadStatus/leadAt.
 * - Runs inside a transaction; safe to re-call on duplicate inquirer emails.
 */
export async function upsertLeadContact(
  input: UpsertLeadContactInput,
  tx?: Prisma.TransactionClient,
): Promise<UpsertLeadContactResult | null> {
  if (!input.inquirer.email) return null;
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient);
  const email = input.inquirer.email.toLowerCase();

  const existing = await client.contact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { _count: { select: { deals: true } } },
  });

  if (!existing) {
    const created = await client.contact.create({
      data: {
        name: input.inquirer.name ?? input.inquirer.email,
        email,
        phone: input.inquirer.phone ?? null,
        company: input.inquirer.company ?? null,
        notes: input.inquirer.message ?? null,
        category: "business",
        tags: [],
        createdBy: `msgraph-email-${input.leadSource}-extract`,
        leadSource: input.leadSource,
        leadStatus: "new",
        leadAt: input.leadAt,
      },
      select: { id: true },
    });
    return { contactId: created.id, created: true, becameLead: true };
  }

  const isClient = existing._count.deals > 0;
  const alreadyLead = existing.leadSource !== null;

  if (isClient || alreadyLead) {
    return { contactId: existing.id, created: false, becameLead: false };
  }

  await client.contact.update({
    where: { id: existing.id },
    data: {
      leadSource: input.leadSource,
      leadStatus: "new",
      leadAt: input.leadAt,
      // Only fill missing demographic fields; never overwrite what Matt curated.
      phone: existing.phone ?? input.inquirer.phone ?? null,
      company: existing.company ?? input.inquirer.company ?? null,
    },
  });
  return { contactId: existing.id, created: false, becameLead: true };
}
