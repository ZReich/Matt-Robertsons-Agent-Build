import { randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import { decryptJson, encryptJson } from "./at-rest"

const KEY_HEX = randomBytes(32).toString("hex")
const OTHER_KEY_HEX = randomBytes(32).toString("hex")

describe("at-rest crypto", () => {
  it("round-trips a JSON value", () => {
    const payload = { token: "abc123", expiresAt: 1234567890 }
    const encrypted = encryptJson(payload, KEY_HEX)
    const decrypted = decryptJson<typeof payload>(encrypted, KEY_HEX)
    expect(decrypted).toEqual(payload)
  })

  it("produces a different ciphertext each call (unique IV)", () => {
    const a = encryptJson({ x: 1 }, KEY_HEX)
    const b = encryptJson({ x: 1 }, KEY_HEX)
    expect(a).not.toBe(b)
  })

  it("rejects mid-ciphertext bit-flip", () => {
    const encrypted = encryptJson({ x: 1 }, KEY_HEX)
    const buf = Buffer.from(encrypted, "base64")
    buf[buf.length - 17] ^= 0x01
    expect(() => decryptJson(buf.toString("base64"), KEY_HEX)).toThrow()
  })

  it("rejects IV byte tampering", () => {
    const encrypted = encryptJson({ x: 1 }, KEY_HEX)
    const buf = Buffer.from(encrypted, "base64")
    buf[0] ^= 0x01
    expect(() => decryptJson(buf.toString("base64"), KEY_HEX)).toThrow()
  })

  it("rejects truncated tag", () => {
    const encrypted = encryptJson({ x: 1 }, KEY_HEX)
    const buf = Buffer.from(encrypted, "base64")
    // Drop one byte from the end so the auth tag length is wrong.
    expect(() =>
      decryptJson(buf.subarray(0, buf.length - 1).toString("base64"), KEY_HEX)
    ).toThrow()
  })

  it("rejects a wrong key (auth tag mismatch)", () => {
    const encrypted = encryptJson({ x: 1 }, KEY_HEX)
    expect(() => decryptJson(encrypted, OTHER_KEY_HEX)).toThrow()
  })

  it("rejects a key that is not 32 bytes hex", () => {
    expect(() => encryptJson({ x: 1 }, "deadbeef")).toThrow(/must be 32 bytes/i)
  })

  it("rejects an empty / non-hex key", () => {
    expect(() => encryptJson({ x: 1 }, "")).toThrow(/must be 32 bytes/i)
    expect(() => encryptJson({ x: 1 }, "g".repeat(64))).toThrow(
      /must be 32 bytes/i
    )
  })

  it("rejects ciphertext that is too short to contain IV + tag", () => {
    expect(() => decryptJson("Zm9v", KEY_HEX)).toThrow(/too short/i)
  })

  it("rejects malformed base64", () => {
    expect(() => decryptJson("!!!not base64!!!", KEY_HEX)).toThrow(
      /malformed base64/i
    )
  })

  it("rejects a non-string encoded input", () => {
    // Caller typing should prevent this, but be defensive.
    expect(() =>
      decryptJson(123 as unknown as string, KEY_HEX)
    ).toThrow(/malformed base64/i)
  })

  it("rejects undefined / function values at encrypt", () => {
    expect(() => encryptJson(undefined, KEY_HEX)).toThrow(/JSON-serializable/)
    expect(() => encryptJson(() => 1, KEY_HEX)).toThrow(/JSON-serializable/)
    // Symbols aren't serializable either.
    expect(() => encryptJson(Symbol("x"), KEY_HEX)).toThrow(/JSON-serializable/)
  })

  it("error messages do not leak key or plaintext bytes", () => {
    const secretPayload = { token: "SUPER-SECRET-VALUE-12345" }
    const encrypted = encryptJson(secretPayload, KEY_HEX)
    let caught: unknown
    try {
      decryptJson(encrypted, OTHER_KEY_HEX)
    } catch (err) {
      caught = err
    }
    const msg = (caught as Error)?.message ?? ""
    expect(msg).not.toContain("SUPER-SECRET")
    expect(msg).not.toContain(KEY_HEX)
    expect(msg).not.toContain(OTHER_KEY_HEX)
  })

  it("round-trips strings, numbers, arrays, and nested objects", () => {
    const payload = {
      s: "hello",
      n: 42,
      arr: [1, "two", { three: 3 }],
      nested: { a: { b: { c: "deep" } } },
    }
    const encrypted = encryptJson(payload, KEY_HEX)
    expect(decryptJson(encrypted, KEY_HEX)).toEqual(payload)
  })

  it("round-trips a 1 MiB payload", () => {
    const big = "x".repeat(1024 * 1024)
    const encrypted = encryptJson({ big }, KEY_HEX)
    const out = decryptJson<{ big: string }>(encrypted, KEY_HEX)
    expect(out.big.length).toBe(big.length)
  })

  it("rejects ciphertext that is valid base64 but auth-fails", () => {
    // Random 28+ bytes (IV + empty ct + 16 tag) — auth tag will not match.
    const fake = Buffer.concat([
      randomBytes(12),
      Buffer.alloc(0),
      randomBytes(16),
    ]).toString("base64")
    expect(() => decryptJson(fake, KEY_HEX)).toThrow()
  })
})
