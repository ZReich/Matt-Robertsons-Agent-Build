import { z } from "zod"

import type { PlaudRegion } from "./types"

const HEX64 = /^[0-9a-fA-F]{64}$/

/**
 * For an optional credential field, treat unset / empty / whitespace-only
 * all as "not provided." Template-style `.env.local` files ship with
 * empty `KEY=` lines as placeholders; rejecting those would force the
 * operator to delete or comment them out, which is friction we don't
 * need.
 */
const optionalCredential = z
  .string()
  .optional()
  .transform((s) => (s ? s.trim() : undefined))
  .transform((s) => (s && s.length > 0 ? s : undefined))

const requiredString = (minLen: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .transform((s) => s.trim())
    .refine((s) => s.length >= minLen, {
      message: `${label} must be at least ${minLen} characters (after trimming)`,
    })

const schema = z
  .object({
    PLAUD_BEARER_TOKEN: optionalCredential,
    PLAUD_EMAIL: optionalCredential,
    PLAUD_PASSWORD: optionalCredential,
    PLAUD_CREDENTIAL_KEY: requiredString(64, "PLAUD_CREDENTIAL_KEY").refine(
      (s) => HEX64.test(s),
      {
        message:
          "PLAUD_CREDENTIAL_KEY must be 32 bytes hex (64 hex chars). Generate with: openssl rand -hex 32",
      }
    ),
    PLAUD_CRON_SECRET: requiredString(32, "PLAUD_CRON_SECRET"),
    PLAUD_REGION: z
      .string()
      .optional()
      .superRefine((s, ctx) => {
        if (s !== undefined && s !== "us" && s !== "eu" && s !== "ap") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "PLAUD_REGION must be 'us', 'eu', or 'ap'",
          })
        }
      })
      .transform((s) => (s as PlaudRegion | undefined) ?? undefined),
  })
  .superRefine((env, ctx) => {
    const hasBearer = Boolean(env.PLAUD_BEARER_TOKEN)
    const hasEmail = Boolean(env.PLAUD_EMAIL)
    const hasPassword = Boolean(env.PLAUD_PASSWORD)

    // At least one auth source must be present.
    if (!hasBearer && !hasEmail && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Either PLAUD_BEARER_TOKEN, or both PLAUD_EMAIL and PLAUD_PASSWORD, must be set",
      })
      return
    }

    // If a bearer token IS present, stray email-only or password-only is OK
    // (just unused). The half-credential rule only matters when there's no
    // bearer to fall back on.
    if (!hasBearer && hasEmail !== hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "PLAUD_EMAIL and PLAUD_PASSWORD must be set together (or set PLAUD_BEARER_TOKEN instead)",
      })
    }
  })

export interface PlaudConfig {
  bearerToken?: string
  email?: string
  password?: string
  credentialKey: string
  cronSecret: string
  region: PlaudRegion
}

export function loadPlaudConfig(): PlaudConfig {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((i) => {
        const path = i.path.length > 0 ? i.path.join(".") : "(root)"
        return `${path}: ${i.message}`
      })
      .join("; ")
    throw new Error(`Invalid Plaud config: ${messages}`)
  }
  const env = parsed.data
  return {
    bearerToken: env.PLAUD_BEARER_TOKEN,
    email: env.PLAUD_EMAIL,
    password: env.PLAUD_PASSWORD,
    credentialKey: env.PLAUD_CREDENTIAL_KEY,
    cronSecret: env.PLAUD_CRON_SECRET,
    region: env.PLAUD_REGION ?? "us",
  }
}
