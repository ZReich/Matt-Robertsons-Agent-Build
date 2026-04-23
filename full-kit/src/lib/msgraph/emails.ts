import { db } from "@/lib/prisma";
import { graphFetch } from "./client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GraphError } from "./errors";
import { loadMsgraphConfig } from "./config";
import type { EmailFolder, GraphEmailMessage } from "./email-types";

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
