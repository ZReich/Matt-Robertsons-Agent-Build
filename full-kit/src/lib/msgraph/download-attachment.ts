import "server-only"

import { GRAPH_BASE_URL } from "./client"
import { getAccessToken } from "./token-manager"

/**
 * Binary payload for a single Graph file attachment.
 *
 * `contentBytes` is the decoded binary (Anthropic's `Base64PDFSource`
 * re-encodes it; we keep it as a Buffer here so callers can also write
 * to disk, hash it, etc., without a redundant decode/encode round trip).
 */
export interface AttachmentBlob {
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: Buffer
}

/**
 * Download a single message attachment from Microsoft Graph.
 *
 * Hits `/users/{upn}/messages/{messageId}/attachments/{attachmentId}`
 * directly with the token-manager's bearer. We do NOT route through
 * `graphFetch` because:
 *
 *  - This module is called from the lease-backfill orchestrator on a
 *    per-PDF basis. The `graphFetch` retry loop was tuned for the delta
 *    endpoint; an attachment download that fails once should fail loudly
 *    and let the orchestrator decide whether to retry, rather than
 *    chewing up to 62s of latency on its own retry budget.
 *  - The 401 invalidate-and-retry hop in `graphFetch` is overkill for a
 *    single short-lived call. The token manager refreshes on its own
 *    schedule.
 *
 * Graph returns `contentBytes` as a base64 string; we decode it to a
 * Buffer once and surface the standard metadata alongside.
 *
 * Throws on missing `MSGRAPH_TARGET_UPN`, on any non-2xx, and on a 2xx
 * payload that lacks `contentBytes` (defensive — Graph occasionally
 * returns reference attachments under `fileAttachment` headers).
 */
export async function downloadAttachment(
  messageId: string,
  attachmentId: string
): Promise<AttachmentBlob> {
  const upn = process.env.MSGRAPH_TARGET_UPN
  if (!upn) throw new Error("MSGRAPH_TARGET_UPN not set")

  const token = await getAccessToken()
  const url =
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(upn)}` +
    `/messages/${encodeURIComponent(messageId)}` +
    `/attachments/${encodeURIComponent(attachmentId)}`

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `download attachment failed (${res.status}): ${text.slice(0, 200)}`
    )
  }

  const json = (await res.json()) as {
    id?: string
    name?: string
    contentType?: string
    size?: number
    contentBytes?: string
  }
  if (!json.contentBytes) {
    throw new Error("attachment payload missing contentBytes")
  }

  return {
    id: json.id ?? attachmentId,
    name: json.name ?? "(unnamed)",
    contentType: json.contentType ?? "application/octet-stream",
    size: json.size ?? 0,
    contentBytes: Buffer.from(json.contentBytes, "base64"),
  }
}
