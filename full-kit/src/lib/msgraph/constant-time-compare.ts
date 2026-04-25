import { timingSafeEqual } from "node:crypto"

/**
 * Compare two strings in a way that doesn't leak their contents via timing.
 * Always runs the timing-safe path; returns false immediately on length mismatch.
 *
 * Why not just call crypto.timingSafeEqual directly? It throws if the two
 * Buffers have different lengths — both a footgun (unhandled exception) and
 * a subtle length-leak (the throw itself is observable). Checking length
 * first is the standard workaround.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
