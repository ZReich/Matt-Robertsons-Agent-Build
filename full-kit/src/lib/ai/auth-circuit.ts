import { db } from "@/lib/prisma"

const CIRCUIT_KEY = "scrub-circuit-auth"
const CIRCUIT_MS = 5 * 60 * 1000

export class ScrubAuthCircuitOpenError extends Error {
  code = "SCRUB_AUTH_CIRCUIT_OPEN" as const

  constructor(
    readonly until: string,
    reason?: string
  ) {
    super(
      `Scrub auth circuit open until ${until}${reason ? `: ${reason}` : ""}`
    )
  }
}

type CircuitValue = {
  trippedAt?: string
  until?: string
  reason?: string
}

export async function tripAuthCircuit(reason: string): Promise<void> {
  const now = new Date()
  const value = {
    trippedAt: now.toISOString(),
    until: new Date(now.getTime() + CIRCUIT_MS).toISOString(),
    reason,
  }

  await db.systemState.upsert({
    where: { key: CIRCUIT_KEY },
    create: { key: CIRCUIT_KEY, value },
    update: { value },
  })
}

export async function assertAuthCircuitClosed(): Promise<void> {
  const row = await db.systemState.findUnique({ where: { key: CIRCUIT_KEY } })
  if (!row) return

  const value = row.value as CircuitValue
  if (value.until && new Date(value.until).getTime() > Date.now()) {
    throw new ScrubAuthCircuitOpenError(value.until, value.reason)
  }

  try {
    await db.systemState.delete({ where: { key: CIRCUIT_KEY } })
  } catch {
    // Another invocation may have cleared it first.
  }
}
