import { db } from "@/lib/prisma";
import type { EmailFolder } from "./email-types";

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
