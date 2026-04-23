import { readFileSync } from "node:fs"
import path from "node:path"

import { graphFetch } from "../src/lib/msgraph/client"
import { loadMsgraphConfig } from "../src/lib/msgraph/config"

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
].join(",")

type FolderId = "inbox" | "sentitems"

interface GraphPage<T> {
  value?: T[]
  "@odata.count"?: number
  "@odata.nextLink"?: string
  "@odata.deltaLink"?: string
}

interface MailFolder {
  id: string
  displayName?: string
  parentFolderId?: string
  totalItemCount?: number
  unreadItemCount?: number
  childFolderCount?: number
}

interface MessageSample {
  id: string
  parentFolderId?: string
  receivedDateTime?: string
  sentDateTime?: string
  subject?: string
}

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local")
  let text: string
  try {
    text = readFileSync(envPath, "utf8")
  } catch {
    return
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] ??= value
  }
}

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`
  return (
    process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    fallback
  )
}

function boolArg(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function listArg(name: string, fallback: string): string[] {
  return getArg(name, fallback)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function safeUrlForLog(url: string): string {
  return url
    .replace(/([?$&](?:skiptoken|deltatoken)=)[^&]+/gi, "$1<redacted>")
    .replace(/(%24(?:skiptoken|deltatoken)=)[^&]+/gi, "$1<redacted>")
}

function summarizePage(
  url: string,
  page: GraphPage<MessageSample>,
  index: number
) {
  return {
    index,
    url: safeUrlForLog(url),
    valueLength: page.value?.length ?? 0,
    hasNextLink: !!page["@odata.nextLink"],
    hasDeltaLink: !!page["@odata.deltaLink"],
    count: page["@odata.count"],
    first: page.value?.[0]
      ? {
          id: page.value[0].id,
          parentFolderId: page.value[0].parentFolderId,
          receivedDateTime: page.value[0].receivedDateTime,
          sentDateTime: page.value[0].sentDateTime,
          subject: page.value[0].subject,
        }
      : null,
  }
}

async function countInboxMessages(targetUpn: string, sinceIso: string) {
  const url =
    `/users/${encodeURIComponent(targetUpn)}/mailFolders/inbox/messages` +
    `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
    `&$count=true&$top=1&$select=id,receivedDateTime,parentFolderId`
  const page = await graphFetch<GraphPage<MessageSample>>(url, {
    headers: { ConsistencyLevel: "eventual" },
  })
  return summarizePage(url, page, 1)
}

async function getWellKnownFolder(targetUpn: string, folder: FolderId) {
  return graphFetch<MailFolder>(
    `/users/${encodeURIComponent(targetUpn)}/mailFolders/${folder}` +
      "?$select=id,displayName,parentFolderId,totalItemCount,unreadItemCount,childFolderCount"
  )
}

async function fetchAllFolderPages(initialUrl: string): Promise<MailFolder[]> {
  const folders: MailFolder[] = []
  let url: string | undefined = initialUrl
  while (url) {
    const page: GraphPage<MailFolder> =
      await graphFetch<GraphPage<MailFolder>>(url)
    folders.push(...(page.value ?? []))
    url = page["@odata.nextLink"]
  }
  return folders
}

async function walkFolders(targetUpn: string) {
  const rootUrl =
    `/users/${encodeURIComponent(targetUpn)}/mailFolders` +
    "?$select=id,displayName,parentFolderId,totalItemCount,unreadItemCount,childFolderCount&$top=100"
  const queue = await fetchAllFolderPages(rootUrl)
  const folders: MailFolder[] = []

  for (let i = 0; i < queue.length; i++) {
    const folder = queue[i]
    folders.push(folder)
    if ((folder.childFolderCount ?? 0) > 0) {
      const childrenUrl =
        `/users/${encodeURIComponent(targetUpn)}/mailFolders/${encodeURIComponent(folder.id)}/childFolders` +
        "?$select=id,displayName,parentFolderId,totalItemCount,unreadItemCount,childFolderCount&$top=100"
      queue.push(...(await fetchAllFolderPages(childrenUrl)))
    }
  }

  return folders
}

function deltaUrl(
  targetUpn: string,
  folder: string,
  sinceIso: string,
  variant: "currentTop" | "preferMaxPage"
): string {
  const base =
    `/users/${encodeURIComponent(targetUpn)}/mailFolders/${encodeURIComponent(folder)}/messages/delta` +
    `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
    `&$select=${encodeURIComponent(EMAIL_SELECT_FIELDS)}`
  return variant === "currentTop" ? `${base}&$top=100` : base
}

async function traceDelta(
  targetUpn: string,
  folder: string,
  folderLabel: string,
  sinceIso: string,
  variant: "currentTop" | "preferMaxPage",
  maxPages: number
) {
  const prefer =
    variant === "preferMaxPage"
      ? 'outlook.body-content-type="text", odata.maxpagesize=100'
      : 'outlook.body-content-type="text"'
  const pages = []
  let url: string | undefined = deltaUrl(targetUpn, folder, sinceIso, variant)

  for (let index = 1; url && index <= maxPages; index++) {
    const page: GraphPage<MessageSample> = await graphFetch<
      GraphPage<MessageSample>
    >(url, {
      headers: { Prefer: prefer },
    })
    pages.push(summarizePage(url, page, index))
    url = page["@odata.nextLink"]
  }

  return {
    folder: folderLabel,
    folderIdentifierUsed: folder,
    variant,
    maxPages,
    pages,
    stoppedBecause: url ? "maxPages" : "deltaComplete",
    remainingNextLink: url ? safeUrlForLog(url) : null,
  }
}

async function main() {
  loadEnvLocal()

  const daysBack = Number.parseInt(getArg("daysBack", "90"), 10)
  const maxPages = Number.parseInt(getArg("maxPages", "5"), 10)
  const includeGuidDelta = boolArg("includeGuidDelta")
  const variants = listArg("variants", "currentTop,preferMaxPage")
  const folders = listArg("folders", "inbox,sentitems")
  const sinceIso = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString()
  const cfg = loadMsgraphConfig()

  let inboxCount: unknown
  try {
    inboxCount = await countInboxMessages(cfg.targetUpn, sinceIso)
  } catch (err) {
    inboxCount = {
      error: err instanceof Error ? err.message : String(err),
      status:
        typeof err === "object" && err !== null && "status" in err
          ? err.status
          : undefined,
      code:
        typeof err === "object" && err !== null && "code" in err
          ? err.code
          : undefined,
    }
  }

  const [inboxFolder, sentFolder, folderTree] = await Promise.all([
    getWellKnownFolder(cfg.targetUpn, "inbox"),
    getWellKnownFolder(cfg.targetUpn, "sentitems"),
    walkFolders(cfg.targetUpn),
  ])

  const interestingFolders = folderTree
    .filter((folder) => {
      const display = folder.displayName?.toLowerCase() ?? ""
      return (
        folder.id === inboxFolder.id ||
        folder.id === sentFolder.id ||
        display === "inbox" ||
        display === "sent items"
      )
    })
    .map((folder) => ({
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId,
      totalItemCount: folder.totalItemCount,
      unreadItemCount: folder.unreadItemCount,
      childFolderCount: folder.childFolderCount,
    }))

  const traces = []
  for (const folder of folders) {
    if (folder !== "inbox" && folder !== "sentitems") continue
    for (const variant of variants) {
      if (variant !== "currentTop" && variant !== "preferMaxPage") continue
      traces.push(
        await traceDelta(
          cfg.targetUpn,
          folder,
          folder,
          sinceIso,
          variant,
          maxPages
        )
      )
    }
  }

  if (includeGuidDelta) {
    for (const variant of variants) {
      if (variant !== "currentTop" && variant !== "preferMaxPage") continue
      traces.push(
        await traceDelta(
          cfg.targetUpn,
          inboxFolder.id,
          "inbox-guid",
          sinceIso,
          variant,
          maxPages
        ),
        await traceDelta(
          cfg.targetUpn,
          sentFolder.id,
          "sentitems-guid",
          sinceIso,
          variant,
          maxPages
        )
      )
    }
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        daysBack,
        sinceIso,
        targetUpn: cfg.targetUpn,
        inboxCountProbe: inboxCount,
        wellKnownFolders: {
          inbox: inboxFolder,
          sentitems: sentFolder,
        },
        interestingFolders,
        traces,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
