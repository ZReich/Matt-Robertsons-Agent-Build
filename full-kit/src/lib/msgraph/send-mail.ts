import "server-only"

import { graphFetch } from "./client"
import { loadMsgraphConfig } from "./config"
import { GraphError } from "./errors"

export interface SendMailRecipient {
  address: string
  name?: string
}

export interface SendMailInput {
  subject: string
  body: string
  /** "Text" preserves line breaks as-is; "HTML" runs through the Graph HTML
   * sanitizer. Default Text — Matt's outbound voice is plain prose. */
  contentType?: "Text" | "HTML"
  toRecipients: SendMailRecipient[]
  ccRecipients?: SendMailRecipient[]
  bccRecipients?: SendMailRecipient[]
  /** Save to Matt's Sent Items so it appears in his inbox sync naturally
   * and our Communication row gets linked on the next email-sync delta. */
  saveToSentItems?: boolean
}

export interface SendMailResult {
  ok: true
  /** Graph does not return a Sent message ID for /sendMail (it queues async).
   * The actual Communication row appears when email-sync picks up the new
   * Sent Items message on the next delta. We surface this flag for callers
   * that want to know whether to log a synthetic outbound row or wait. */
  immediateMessageId: null
}

export interface SendMailFailure {
  ok: false
  reason:
    | "no_recipients"
    | "subject_required"
    | "body_required"
    | "permission_denied"
    | "auth_failed"
    | "network"
    | "unknown"
  status?: number
  details?: string
}

const MAX_RECIPIENTS = 50

function toGraphRecipients(
  list: SendMailRecipient[] | undefined
): Array<{ emailAddress: { address: string; name?: string } }> {
  if (!list) return []
  return list.slice(0, MAX_RECIPIENTS).map((r) => ({
    emailAddress: {
      address: r.address,
      ...(r.name ? { name: r.name } : {}),
    },
  }))
}

/**
 * Send an email via Microsoft Graph as Matt (the configured target UPN).
 *
 * Uses POST /users/{upn}/sendMail. Mail.Send permission MUST be granted on
 * the Azure app registration. If you get a 403, check Entra admin consent.
 *
 * The send is fire-and-forget at the Graph level: the Sent Items copy
 * appears on Matt's mailbox once the Graph queue processes it. The next
 * email-sync delta pulls it back as a real Communication row, so we don't
 * need to optimistically create one here.
 */
export async function sendMailAsMatt(
  input: SendMailInput
): Promise<SendMailResult | SendMailFailure> {
  const subject = input.subject?.trim()
  const body = input.body?.trim()
  if (!subject) return { ok: false, reason: "subject_required" }
  if (!body) return { ok: false, reason: "body_required" }
  if (!input.toRecipients || input.toRecipients.length === 0) {
    return { ok: false, reason: "no_recipients" }
  }

  const config = loadMsgraphConfig()
  const path = `/users/${encodeURIComponent(config.targetUpn)}/sendMail`

  const payload = {
    message: {
      subject,
      body: {
        contentType: input.contentType ?? "Text",
        content: body,
      },
      toRecipients: toGraphRecipients(input.toRecipients),
      ccRecipients: toGraphRecipients(input.ccRecipients),
      bccRecipients: toGraphRecipients(input.bccRecipients),
    },
    saveToSentItems: input.saveToSentItems ?? true,
  }

  try {
    await graphFetch<unknown>(path, {
      method: "POST",
      body: payload,
    })
    return { ok: true, immediateMessageId: null }
  } catch (error: unknown) {
    if (error instanceof GraphError) {
      const status = error.status
      if (status === 401) {
        return {
          ok: false,
          reason: "auth_failed",
          status,
          details: error.message,
        }
      }
      if (status === 403) {
        return {
          ok: false,
          reason: "permission_denied",
          status,
          details:
            "Graph returned 403. The Azure app registration likely does not have Mail.Send delegated/application permission, or admin consent has not been granted. " +
            error.message,
        }
      }
      return {
        ok: false,
        reason: "unknown",
        status,
        details: error.message,
      }
    }
    return {
      ok: false,
      reason: "network",
      details: error instanceof Error ? error.message : "unknown error",
    }
  }
}
