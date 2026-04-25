/**
 * Parse an HTTP `Retry-After` header value. The header may be either:
 *   - a non-negative integer of seconds ("30"), or
 *   - an HTTP-date ("Thu, 16 Apr 2026 12:00:20 GMT")
 *
 * Returns the number of milliseconds to wait before retrying, clamped to
 * [0, maxMs]. Returns `fallbackMs` if the header is null, empty, or unparseable.
 *
 * Graph typically uses delta-seconds for 429 throttling; HTTP-date form is
 * included for robustness against other 5xx/proxy responses.
 */
export function parseRetryAfter(
  headerValue: string | null | undefined,
  fallbackMs: number,
  maxMs: number
): number {
  if (!headerValue) return fallbackMs

  const trimmed = headerValue.trim()
  if (trimmed === "") return fallbackMs

  // Try delta-seconds first (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed)
    if (Number.isFinite(seconds)) {
      const ms = seconds * 1000
      return clamp(ms, 0, maxMs)
    }
  }

  // Fall back to HTTP-date
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    const deltaMs = dateMs - Date.now()
    return clamp(deltaMs, 0, maxMs)
  }

  return fallbackMs
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}
