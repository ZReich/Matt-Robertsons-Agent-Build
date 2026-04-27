import { createHash } from "node:crypto"

import type { GraphEmailBody, GraphEmailMessage } from "./email-types"

export const EMAIL_REDACTION_VERSION = "email-redaction-2026-04-26.1"

export interface RedactedBodyArtifact {
  bodyHash: string | null
  bodyLength: number
  bodyContentType: GraphEmailBody["contentType"] | null
  redactedContent: string | null
  redactionVersion: string
  redactionStatus: "redacted" | "empty" | "failed"
  redactionError?: string
}

export function hashBody(content: string | undefined | null): string | null {
  if (!content) return null
  return createHash("sha256").update(content).digest("hex")
}

export function redactEmailBody(
  body: GraphEmailBody | undefined
): RedactedBodyArtifact {
  if (!body?.content) {
    return {
      bodyHash: null,
      bodyLength: 0,
      bodyContentType: body?.contentType ?? null,
      redactedContent: null,
      redactionVersion: EMAIL_REDACTION_VERSION,
      redactionStatus: "empty",
    }
  }
  try {
    let content = body.content
    content = content.replace(
      /https?:\/\/\S*(?:token|sig|signature|code|auth|password|reset)\S*/gi,
      "[REDACTED_LINK]"
    )
    content = content.replace(
      /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)\s*[:=]\s*\S+/gi,
      "[REDACTED_SECRET]"
    )
    content = content.replace(
      /\b\d{3}[-.)\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[REDACTED_PHONE]"
    )
    content = content.replace(
      /\b(?:\d[ -]*?){13,19}\b/g,
      "[REDACTED_PAYMENT_LIKE]"
    )
    return {
      bodyHash: hashBody(body.content),
      bodyLength: body.content.length,
      bodyContentType: body.contentType,
      redactedContent: content,
      redactionVersion: EMAIL_REDACTION_VERSION,
      redactionStatus: "redacted",
    }
  } catch (err) {
    return {
      bodyHash: hashBody(body.content),
      bodyLength: body.content.length,
      bodyContentType: body.contentType,
      redactedContent: null,
      redactionVersion: EMAIL_REDACTION_VERSION,
      redactionStatus: "failed",
      redactionError: err instanceof Error ? err.message : String(err),
    }
  }
}

export function pruneGraphSnapshot(
  message: GraphEmailMessage,
  options: { retainBody?: boolean; retainBodyPreview?: boolean } = {}
): GraphEmailMessage {
  const snapshot: GraphEmailMessage = { ...message }
  if (!options.retainBody) delete snapshot.body
  if (!options.retainBodyPreview) delete snapshot.bodyPreview
  return snapshot
}

export function assertRawBodyRetentionPolicy(input: {
  rawBodyRetained: boolean
  rawBodyRetentionExpiresAt?: Date | null
  accessPolicy?: string | null
}): void {
  if (
    input.rawBodyRetained &&
    (!input.rawBodyRetentionExpiresAt || !input.accessPolicy)
  ) {
    throw new Error("raw body retention requires expiry and access policy")
  }
}
