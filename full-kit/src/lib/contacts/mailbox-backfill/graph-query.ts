import { graphFetch } from "@/lib/msgraph/client"
import { loadMsgraphConfig } from "@/lib/msgraph/config"

export interface QueryInput {
  email: string
  window: { start: Date; end: Date }
  selectFields?: string[]
  // Optional injection for testing.
  fetchImpl?: <T>(path: string, opts?: unknown) => Promise<T>
}

const DEFAULT_SELECT = [
  "id",
  "internetMessageId",
  "conversationId",
  "subject",
  "bodyPreview",
  "body",
  "from",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "parentFolderId",
  "hasAttachments",
].join(",")

interface GraphPage {
  value: any[]
  "@odata.nextLink"?: string
}

export async function fetchMessagesForContactWindow(
  input: QueryInput
): Promise<any[]> {
  const cfg = loadMsgraphConfig()
  const fetchFn = input.fetchImpl ?? graphFetch
  const { email, window } = input
  const select = input.selectFields?.join(",") ?? DEFAULT_SELECT

  // Note: Graph $search requires a double-quoted KQL expression. We further
  // wrap each email value in escaped double-quotes so KQL parses it as a
  // literal phrase. Without quoting, emails containing `+`, whitespace, or
  // KQL keywords (`OR`, `AND`, `NOT`) silently corrupt the search expression
  // — e.g. `weird+plus@example.com` would be split on `+` and `OR not@example.com`
  // would be parsed as a boolean. The inner backslash-quote escapes the
  // double-quotes against the outer KQL string delimiter.
  const safeEmail = email.replace(/"/g, '\\"')
  const search = `"from:\\"${safeEmail}\\" OR to:\\"${safeEmail}\\" OR cc:\\"${safeEmail}\\""`

  // Graph rejects combining `$search` with `$filter` on /users/{}/messages
  // ("The query parameter '$filter' is not supported with '$search'."). So
  // we send `$search` only and apply the receivedDateTime window filter
  // client-side after pagination completes. Bandwidth implication: a few
  // out-of-window messages may be fetched and discarded; for lifetime mode
  // (start = epoch, end = now) every message passes through.
  const params = new URLSearchParams({
    $search: search,
    $select: select,
    $top: "25",
  })

  const userPath = `/users/${encodeURIComponent(cfg.targetUpn)}/messages`
  let nextPath: string | null = `${userPath}?${params.toString()}`
  const out: any[] = []

  while (nextPath) {
    // Graph's @odata.nextLink is typically absolute
    // (e.g. https://graph.microsoft.com/v1.0/users/.../messages?$skiptoken=...).
    // graphFetch handles absolute URLs natively (and enforces the hostname is
    // graph.microsoft.com), so we forward whatever Graph returns verbatim
    // without trying to strip the base.
    const page: GraphPage = await fetchFn<GraphPage>(nextPath, {
      headers: { ConsistencyLevel: "eventual" }, // required for $search
    })
    out.push(...page.value)
    nextPath = page["@odata.nextLink"] ?? null
  }

  // Client-side date-window filter. Always applied; in lifetime mode the
  // window covers everything so this is a pass-through. Messages with no
  // receivedDateTime are dropped (we cannot place them in any window).
  const startMs = window.start.getTime()
  const endMs = window.end.getTime()
  return out.filter((msg) => {
    if (!msg?.receivedDateTime) return false
    const t = new Date(msg.receivedDateTime).getTime()
    return t >= startMs && t <= endMs
  })
}
