// lib/rateLimiter.ts

const RATE_LIMIT = 2 // Max requests per time window (2 requests per minute)
const TIME_WINDOW = 1 * 60 * 1000 // 1 minute in milliseconds

// In-memory store to track requests (temporary solution for small scale apps)
const requestCounts = new Map<string, number[]>()

// Helper to get current time in milliseconds
const now = () => Date.now()

interface RateLimiterResult {
  success: boolean
  message?: string
}

// Rate limiting function
export function rateLimiter(req: Request): RateLimiterResult {
  const ip = req.headers.get("x-forwarded-for")
  if (!ip) {
    return { success: false, message: "Unable to determine IP address" }
  }

  const currentTime = now()

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, [])
  }

  const timestamps = requestCounts.get(ip)!

  // Remove timestamps older than the time window
  const validTimestamps = timestamps.filter(
    (timestamp) => currentTime - timestamp < TIME_WINDOW
  )

  // Update the timestamps list
  requestCounts.set(ip, validTimestamps)

  // Check if request count exceeds the limit
  if (validTimestamps.length >= RATE_LIMIT) {
    return { success: false, message: "Rate limit exceeded" }
  }

  // Add the current timestamp to the list
  requestCounts.get(ip)!.push(currentTime)

  return { success: true }
}
