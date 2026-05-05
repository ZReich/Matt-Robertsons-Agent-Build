import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM authenticated encryption for small JSON token blobs at rest.
 *
 * Why GCM: provides both confidentiality and integrity (auth tag) so a
 * tampered ciphertext fails to decrypt rather than silently producing
 * attacker-controlled plaintext.
 *
 * Why 12-byte IV: NIST SP 800-38D recommended length for GCM — pairs with
 * `randomBytes(12)` to keep the IV-reuse probability negligible at our
 * volume (a few writes per day).
 *
 * Layout: base64( iv (12 bytes) || ciphertext (n bytes) || tag (16 bytes) ).
 * Self-contained — no separate "version byte" since we have only one
 * algorithm and changing it would require key rotation anyway.
 */

const ALG = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/
// Strict base64 regex (with optional padding). Buffer.from is permissive and
// silently drops non-base64 chars; we want malformed input to fail loudly.
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

function keyBuffer(keyHex: string): Buffer {
  if (!KEY_HEX_RE.test(keyHex)) {
    throw new Error(
      "encryption key must be 32 bytes hex (64 hex chars). Generate with: openssl rand -hex 32"
    )
  }
  return Buffer.from(keyHex, "hex")
}

export function encryptJson(value: unknown, keyHex: string): string {
  // JSON.stringify returns `undefined` for `undefined`, functions, and
  // symbols — passing those to Buffer.from(undefined, "utf8") throws a
  // confusing TypeError. Reject up-front with a clear message.
  const serialized = JSON.stringify(value)
  if (typeof serialized !== "string") {
    throw new Error("encryptJson: value is not JSON-serializable")
  }
  const key = keyBuffer(keyHex)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALG, key, iv)
  const plaintext = Buffer.from(serialized, "utf8")
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, ciphertext, tag]).toString("base64")
}

export function decryptJson<T>(encoded: string, keyHex: string): T {
  if (typeof encoded !== "string" || !BASE64_RE.test(encoded)) {
    throw new Error("malformed base64")
  }
  const key = keyBuffer(keyHex)
  const buf = Buffer.from(encoded, "base64")
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encrypted blob too short")
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH)
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  // JSON.parse failure means the (authenticated) plaintext is corrupt or
  // produced by code with a different schema. Throw a generic message so
  // partial plaintext bytes don't end up in error logs.
  try {
    return JSON.parse(plaintext.toString("utf8")) as T
  } catch {
    throw new Error("decrypted payload is not valid JSON")
  }
}
