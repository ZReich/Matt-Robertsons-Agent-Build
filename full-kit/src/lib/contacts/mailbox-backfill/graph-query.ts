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

  // Note: Graph $search requires a double-quoted KQL expression.
  const search = `"from:${email} OR to:${email} OR cc:${email}"`
  const filter =
    `receivedDateTime ge ${window.start.toISOString()} ` +
    `and receivedDateTime le ${window.end.toISOString()}`

  const params = new URLSearchParams({
    $search: search,
    $filter: filter,
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

  return out
}
