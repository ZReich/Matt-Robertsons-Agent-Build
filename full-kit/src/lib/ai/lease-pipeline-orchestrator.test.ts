import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  CLOSED_DEAL_CLASSIFIER_VERSION,
} from "./closed-deal-classifier"
import { LEASE_EXTRACTOR_VERSION } from "./lease-extractor"
import type {
  ClosedDealClassification,
  LeaseExtraction,
} from "./lease-types"

// ---------------------------------------------------------------------------
// In-memory fake DB layer.
// ---------------------------------------------------------------------------
//
// The orchestrator exercises a fairly wide surface (Communication,
// Contact, Property, LeaseRecord, CalendarEvent, SystemState) so a
// per-test mock matrix is unwieldy. This fake captures rows in
// dictionaries and supports the queries the orchestrator actually runs:
// findUnique, findFirst, findMany (with `take`/`orderBy`), create,
// update, upsert, and `$transaction(async (tx) => ...)`.
//
// We deliberately keep the where-clause matcher narrow — only the fields
// the orchestrator queries on. If the orchestrator grows new query
// shapes, this fake needs an update.

// Shared mutable state that vi.mock factories close over. vi.hoisted
// runs before any other top-level statement so the mock factories can
// safely reference STATE via the hoisted closure.
const { STATE, dbMock } = vi.hoisted(() => {
  type RowH = Record<string, unknown> & { id: string }
  type DbStateH = {
    communications: Map<string, RowH>
    contacts: Map<string, RowH>
    properties: Map<string, RowH>
    leaseRecords: Map<string, RowH>
    calendarEvents: Map<string, RowH>
    systemStates: Map<string, { key: string; value: unknown }>
    nextId: number
  }
  const newState = (): DbStateH => ({
    communications: new Map(),
    contacts: new Map(),
    properties: new Map(),
    leaseRecords: new Map(),
    calendarEvents: new Map(),
    systemStates: new Map(),
    nextId: 1,
  })

  const STATE: { current: DbStateH; reset: () => void } = {
    current: newState(),
    reset: () => {
      STATE.current = newState()
    },
  }

  function genIdH(prefix: string): string {
    STATE.current.nextId += 1
    return `${prefix}-${STATE.current.nextId}`
  }

  function deepCloneH<T>(v: T): T {
    return v == null ? v : (JSON.parse(JSON.stringify(v)) as T)
  }

  function matchInsensitiveH(
    field: unknown,
    filter: { equals: string; mode?: string }
  ): boolean {
    if (typeof field !== "string") return false
    const target = filter.equals
    if (filter.mode === "insensitive") {
      return field.toLowerCase() === target.toLowerCase()
    }
    return field === target
  }

  function matchesContactWhereH(
    row: RowH,
    where: Record<string, unknown>
  ): boolean {
    if (where.archivedAt === null && row.archivedAt != null) return false
    if (where.email && typeof where.email === "object") {
      const f = where.email as { equals: string; mode?: string }
      if (!matchInsensitiveH(row.email, f)) return false
    }
    if (where.name && typeof where.name === "object") {
      const f = where.name as { equals: string; mode?: string }
      if (!matchInsensitiveH(row.name, f)) return false
    }
    return true
  }

  function matchesPropertyWhereH(
    row: RowH,
    where: Record<string, unknown>
  ): boolean {
    if (where.archivedAt === null && row.archivedAt != null) return false
    if (
      typeof where.propertyKey === "string" &&
      row.propertyKey !== where.propertyKey
    ) {
      return false
    }
    if (where.address && typeof where.address === "object") {
      const f = where.address as { equals: string; mode?: string }
      if (!matchInsensitiveH(row.address, f)) return false
    }
    return true
  }

  function matchesLeaseWhereH(
    row: RowH,
    where: Record<string, unknown>
  ): boolean {
    for (const [k, v] of Object.entries(where)) {
      if (k === "archivedAt" && v === null) {
        if (row.archivedAt != null) return false
        continue
      }
      if (v instanceof Date) {
        const rv = row[k] as Date | null
        if (!rv) return false
        if (rv.getTime() !== v.getTime()) return false
        continue
      }
      if (v === null) {
        if (row[k] !== null && row[k] !== undefined) return false
        continue
      }
      if (row[k] !== v) return false
    }
    return true
  }

  function matchesEventWhereH(
    row: RowH,
    where: Record<string, unknown>
  ): boolean {
    for (const [k, v] of Object.entries(where)) {
      if (row[k] !== v) return false
    }
    return true
  }

  function makeTxClient(state: DbStateH) {
    return {
      communication: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const row = state.communications.get(where.id)
          return row ? deepCloneH(row) : null
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string }
          data: Record<string, unknown>
        }) => {
          const row = state.communications.get(where.id)
          if (!row) throw new Error(`communication not found: ${where.id}`)
          Object.assign(row, data)
          return deepCloneH(row)
        },
      },
      contact: {
        findFirst: async ({
          where,
        }: {
          where: Record<string, unknown>
        }) => {
          for (const row of state.contacts.values()) {
            if (matchesContactWhereH(row as RowH, where)) return deepCloneH(row)
          }
          return null
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = genIdH("contact")
          const row: RowH = {
            id,
            archivedAt: null,
            clientType: null,
            ...data,
          }
          state.contacts.set(id, row)
          return deepCloneH(row)
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string }
          data: Record<string, unknown>
        }) => {
          const row = state.contacts.get(where.id)
          if (!row) throw new Error(`contact not found: ${where.id}`)
          Object.assign(row, data)
          return deepCloneH(row)
        },
      },
      property: {
        findFirst: async ({
          where,
        }: {
          where: Record<string, unknown>
        }) => {
          for (const row of state.properties.values()) {
            if (matchesPropertyWhereH(row as RowH, where)) return deepCloneH(row)
          }
          return null
        },
      },
      leaseRecord: {
        findFirst: async ({
          where,
        }: {
          where: Record<string, unknown>
        }) => {
          for (const row of state.leaseRecords.values()) {
            if (matchesLeaseWhereH(row as RowH, where)) return deepCloneH(row)
          }
          return null
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = genIdH("lease")
          const row: RowH = { id, archivedAt: null, ...data }
          state.leaseRecords.set(id, row)
          return deepCloneH(row)
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string }
          data: Record<string, unknown>
        }) => {
          const row = state.leaseRecords.get(where.id)
          if (!row) throw new Error(`leaseRecord not found: ${where.id}`)
          Object.assign(row, data)
          return deepCloneH(row)
        },
      },
      calendarEvent: {
        findFirst: async ({
          where,
        }: {
          where: Record<string, unknown>
        }) => {
          for (const row of state.calendarEvents.values()) {
            if (matchesEventWhereH(row as RowH, where)) return deepCloneH(row)
          }
          return null
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = genIdH("event")
          const row: RowH = { id, ...data }
          state.calendarEvents.set(id, row)
          return deepCloneH(row)
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string }
          data: Record<string, unknown>
        }) => {
          const row = state.calendarEvents.get(where.id)
          if (!row) throw new Error(`calendarEvent not found: ${where.id}`)
          Object.assign(row, data)
          return deepCloneH(row)
        },
      },
    }
  }

  const dbMock = {
    communication: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = STATE.current.communications.get(where.id)
        return row ? deepCloneH(row) : null
      },
      findMany: async ({ take }: { take?: number } = {}) => {
        const rows = Array.from(STATE.current.communications.values())
          .sort((a, b) => {
            const ad = (a.date as Date).getTime()
            const bd = (b.date as Date).getTime()
            if (ad !== bd) return ad - bd
            return (a.id as string).localeCompare(b.id as string)
          })
          .filter((r) => {
            const m = r.metadata as
              | Record<string, unknown>
              | null
              | undefined
            const slot = m?.closedDealClassification as
              | Record<string, unknown>
              | undefined
            return slot?.version !== CLOSED_DEAL_CLASSIFIER_VERSION
          })
          // Reflect just the fields the caller `select`s. Preserve real
          // Date instances (deepCloneH would JSON-stringify them).
          .map((r) => ({ id: r.id as string, date: r.date as Date }))
        return take ? rows.slice(0, take) : rows
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Record<string, unknown>
      }) => {
        const row = STATE.current.communications.get(where.id)
        if (!row) throw new Error(`communication not found: ${where.id}`)
        Object.assign(row, data)
        return deepCloneH(row)
      },
    },
    systemState: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const row = STATE.current.systemStates.get(where.key)
        return row ? deepCloneH(row) : null
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { key: string }
        create: { key: string; value: unknown }
        update: { value: unknown }
      }) => {
        const existing = STATE.current.systemStates.get(where.key)
        if (existing) {
          existing.value = update.value
        } else {
          STATE.current.systemStates.set(create.key, {
            key: create.key,
            value: create.value,
          })
        }
        return STATE.current.systemStates.get(where.key)!
      },
    },
    $transaction: async <T>(
      fn: (tx: ReturnType<typeof makeTxClient>) => Promise<T>
    ): Promise<T> => {
      const tx = makeTxClient(STATE.current)
      return fn(tx)
    },
  }

  return { STATE, dbMock }
})

function genId(prefix: string): string {
  STATE.current.nextId += 1
  return `${prefix}-${STATE.current.nextId}`
}

vi.mock("@/lib/prisma", () => ({
  db: dbMock,
}))

// Don't actually load the real settings (it would hit the DB) — we
// inject `options.settings` on every call.
vi.mock("@/lib/system-state/automation-settings", () => ({
  getAutomationSettings: vi.fn(async () => ({
    leaseExtractorMinConfidence: 0.6,
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedCommunication(opts?: {
  id?: string
  metadata?: unknown
  date?: Date
}): string {
  const id = opts?.id ?? genId("comm")
  STATE.current.communications.set(id, {
    id,
    subject: "Lease executed",
    body: "Lease finalized.",
    date: opts?.date ?? new Date("2026-01-01T00:00:00Z"),
    archivedAt: null,
    metadata: opts?.metadata ?? null,
  })
  return id
}

function seedProperty(opts: {
  address: string
  propertyKey: string
  id?: string
}): string {
  const id = opts.id ?? genId("prop")
  STATE.current.properties.set(id, {
    id,
    address: opts.address,
    propertyKey: opts.propertyKey,
    archivedAt: null,
  })
  return id
}

const VALID_LEASE_EXTRACTION: LeaseExtraction = {
  contactName: "Brandon Miller",
  contactEmail: "brandon@example.com",
  propertyAddress: "303 N Broadway",
  closeDate: "2026-01-15",
  leaseStartDate: "2026-02-01",
  leaseEndDate: "2031-01-31",
  leaseTermMonths: 60,
  rentAmount: 4500,
  rentPeriod: "monthly",
  mattRepresented: "owner",
  dealKind: "lease",
  confidence: 0.88,
  reasoning: "Subject line says 'Lease fully executed'.",
}

const VALID_CLASSIFICATION: ClosedDealClassification = {
  classification: "closed_lease",
  confidence: 0.92,
  signals: ["fully executed"],
}

function classifierStub(result: ClosedDealClassification = VALID_CLASSIFICATION) {
  return vi.fn(async (..._args: unknown[]) => ({
    ok: true as const,
    result,
    modelUsed: "deepseek-chat",
  }))
}

function extractorStub(result: LeaseExtraction = VALID_LEASE_EXTRACTION) {
  return vi.fn(async (..._args: unknown[]) => ({
    ok: true as const,
    result,
    modelUsed: "claude-haiku-4-5-20251001",
  }))
}

beforeEach(() => {
  STATE.reset()
  vi.clearAllMocks()
})

// Import AFTER all the vi.mock calls above are hoisted-applied.
import {
  processBacklogClosedDeals,
  processCommunicationForLease,
} from "./lease-pipeline-orchestrator"

// ---------------------------------------------------------------------------
// TODO (M7): Phase 1 acceptance criterion — wire a real-Prisma integration
// test that exercises processCommunicationForLease against the shadow DB
// (SHADOW_DATABASE_URL = local Postgres on localhost:5433 per CLAUDE.md).
// Requirements:
//   1. Construct a SECOND PrismaClient pointing at SHADOW_DATABASE_URL
//      (NEVER reuse DATABASE_URL/DIRECT_URL — that would hit production).
//      Skip the test with a clear message if the shadow DB is unreachable
//      (e.g. `await client.$queryRaw\`SELECT 1\`` in beforeAll inside a
//      try/catch; on failure, `it.skip` the suite).
//   2. Sync the schema to the shadow DB once at startup
//      (`prisma db push --schema ./prisma/schema.prisma --skip-generate`
//      against SHADOW_DATABASE_URL — or pre-flight that the migrations
//      are applied).
//   3. Seed a synthetic Communication row.
//   4. Call processCommunicationForLease(commId, {classifierFn,
//      extractorFn}) with hardcoded mock AI hooks returning known-good
//      LeaseExtraction.
//   5. Read back the resulting LeaseRecord, CalendarEvent, and Contact
//      rows directly via the shadow PrismaClient and assert:
//        - Decimal coercion (rentAmount, extractionConfidence) round-trips
//          through PrismaNS.Decimal correctly.
//        - JSON metadata shape matches (closedDealClassification +
//          leaseExtractionAttempt slots).
//        - Datetime values are stored as UTC midnight (the orchestrator
//          uses `new Date('YYYY-MM-DDT00:00:00Z')`).
//   6. Cleanup via either `db.$transaction(async (tx) => { ...; throw
//      'ROLLBACK' })` or truncate the affected tables in afterEach. DO
//      NOT leave test rows in the shadow DB.
// Estimated effort: ~30-60 min plus debugging the schema-sync handshake.
// Deferred from this fix-pack because wiring the second Prisma client +
// schema-sync mechanism is a test-harness change that exceeded the scope
// budget; tracked as Phase 1 acceptance follow-up.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// processCommunicationForLease — happy path
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — happy path", () => {
  it("classifies, extracts, upserts LeaseRecord + CalendarEvent, transitions Contact", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    expect(out.leaseRecordId).toMatch(/^lease-/)
    expect(out.calendarEventId).toMatch(/^event-/)
    expect(out.contactId).toMatch(/^contact-/)
    expect(out.propertyId).toMatch(/^prop-/)

    // Contact.clientType — close date is past (2026-01-15 < 2026-01-20),
    // owner-side lease → past_listing_client.
    const contact = STATE.current.contacts.get(out.contactId)!
    expect(contact.clientType).toBe("past_listing_client")
    expect(out.contactClientTypeChanged).toBe(true)

    // CalendarEvent — leaseEndDate 2031-01-31 is in the future.
    const event = STATE.current.calendarEvents.get(out.calendarEventId!)!
    expect(event.eventKind).toBe("lease_renewal")
    expect((event.startDate as Date).toISOString()).toBe(
      "2031-01-31T00:00:00.000Z"
    )

    // Communication.metadata stamped with the classifier outcome.
    const comm = STATE.current.communications.get(commId)!
    const metadata = comm.metadata as Record<string, unknown>
    const stamp = metadata.closedDealClassification as Record<string, unknown>
    expect(stamp.version).toBe(CLOSED_DEAL_CLASSIFIER_VERSION)
    expect(stamp.classification).toBe("closed_lease")
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — already-processed shortcut
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — already-processed shortcut", () => {
  it("returns reason already_processed and skips both AI calls", async () => {
    const commId = seedCommunication({
      metadata: {
        closedDealClassification: {
          version: CLOSED_DEAL_CLASSIFIER_VERSION,
          classification: "closed_lease",
        },
      },
    })

    const classifierFn = classifierStub()
    const extractorFn = extractorStub()

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierFn,
      runLeaseExtractionFn: extractorFn,
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(false)
    if (out.ok) throw new Error("expected not ok")
    expect(out.reason).toBe("already_processed")
    expect(classifierFn).not.toHaveBeenCalled()
    expect(extractorFn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — not-a-deal classification
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — not_a_deal", () => {
  it("stamps metadata, does not run extractor, returns not_a_closed_deal", async () => {
    const commId = seedCommunication()

    const extractorFn = extractorStub()
    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub({
        classification: "not_a_deal",
        confidence: 0.95,
        signals: [],
      }),
      runLeaseExtractionFn: extractorFn,
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(false)
    if (out.ok) throw new Error("expected not ok")
    expect(out.reason).toBe("not_a_closed_deal")
    expect(extractorFn).not.toHaveBeenCalled()

    const comm = STATE.current.communications.get(commId)!
    const stamp = (comm.metadata as Record<string, unknown>)
      .closedDealClassification as Record<string, unknown>
    expect(stamp.classification).toBe("not_a_deal")
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — low-confidence extraction
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — low confidence", () => {
  it("stamps leaseExtractionAttempt and returns low_confidence", async () => {
    const commId = seedCommunication()

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub({
        ...VALID_LEASE_EXTRACTION,
        confidence: 0.5, // below 0.6 threshold
      }),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(false)
    if (out.ok) throw new Error("expected not ok")
    expect(out.reason).toBe("low_confidence")

    expect(STATE.current.leaseRecords.size).toBe(0)

    const comm = STATE.current.communications.get(commId)!
    const meta = comm.metadata as Record<string, unknown>
    const attempt = meta.leaseExtractionAttempt as Record<string, unknown>
    expect(attempt.failedReason).toBe("low_confidence")
    expect(attempt.version).toBe(LEASE_EXTRACTOR_VERSION)
    expect(attempt.confidence).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — missing property fallback
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — missing property", () => {
  it("creates LeaseRecord with propertyId: null when address has no match", async () => {
    const commId = seedCommunication()
    // No properties seeded.

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    expect(out.propertyId).toBeNull()
    const lease = STATE.current.leaseRecords.get(out.leaseRecordId)!
    expect(lease.propertyId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — past-dated close, no future end date
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — already-expired lease", () => {
  it("does NOT create a calendar event when leaseEndDate is in the past", async () => {
    const commId = seedCommunication()

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub({
        ...VALID_LEASE_EXTRACTION,
        leaseEndDate: "2020-01-31",
        leaseStartDate: "2015-02-01",
        closeDate: "2015-01-15",
      }),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    expect(out.calendarEventId).toBeNull()
    expect(STATE.current.calendarEvents.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — close-today / start-tomorrow
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — close today, start tomorrow", () => {
  it("keeps Contact in active_* state when closeDate is today", async () => {
    const commId = seedCommunication()
    const today = new Date("2026-05-02T00:00:00Z")

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub({
        ...VALID_LEASE_EXTRACTION,
        // closeDate equals today — NOT strictly less than now, so not "past".
        closeDate: "2026-05-02",
        leaseStartDate: "2026-05-03",
        leaseEndDate: "2031-05-02",
        mattRepresented: "owner",
      }),
      now: today,
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    const contact = STATE.current.contacts.get(out.contactId)!
    expect(contact.clientType).toBe("active_listing_client")
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — atomicity of the two-transaction split
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — atomicity", () => {
  it("classifier-stamp from txn-1 persists when LeaseRecord create throws in txn-2", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    // Force tx.leaseRecord.create to throw on the FIRST invocation only,
    // so that we trigger the rollback inside txn-2. The classifier-stamp
    // write in txn-1 must remain durable.
    const originalLeaseCreate = (
      dbMock as unknown as {
        $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>
      }
    )
    // We patch by intercepting the makeTxClient via a wrapped $transaction.
    // Easier: monkey-patch the $transaction temporarily to inject a tx
    // whose leaseRecord.create throws.
    const realTxn = dbMock.$transaction
    let firstTxnDone = false
    dbMock.$transaction = (async <T>(
      fn: (tx: unknown) => Promise<T>
    ): Promise<T> => {
      return realTxn(async (tx: unknown) => {
        const t = tx as { leaseRecord?: { create?: (...args: unknown[]) => unknown } }
        if (firstTxnDone && t.leaseRecord?.create) {
          // Second txn (the persistence one): make leaseRecord.create throw.
          t.leaseRecord.create = async () => {
            throw new Error("simulated DB failure inside txn-2")
          }
        }
        const out = await fn(tx as Parameters<typeof fn>[0])
        firstTxnDone = true
        return out
      })
    }) as typeof dbMock.$transaction

    try {
      await expect(
        processCommunicationForLease(commId, {
          runClosedDealClassifierFn: classifierStub(),
          runLeaseExtractionFn: extractorStub(),
          now: new Date("2026-01-20T00:00:00Z"),
          settings: { leaseExtractorMinConfidence: 0.6 },
        })
      ).rejects.toThrow("simulated DB failure inside txn-2")

      // The classifier-stamp from txn-1 SHOULD be persisted (txn-1 closed
      // cleanly before the AI call).
      const comm = STATE.current.communications.get(commId)!
      const meta = comm.metadata as Record<string, unknown>
      const stamp = meta.closedDealClassification as Record<string, unknown>
      expect(stamp).toBeDefined()
      expect(stamp.version).toBe(CLOSED_DEAL_CLASSIFIER_VERSION)

      // The leaseExtractionAttempt stamp + LeaseRecord side effects all
      // happened INSIDE txn-2 which rolled back, so neither should be
      // visible. (Our in-memory mock doesn't model transactional rollback,
      // but the leaseRecord.create throw means no LeaseRecord was created
      // and the leaseExtractionAttempt stamp write happened BEFORE the
      // throw so in a real DB it would be rolled back too. We still assert
      // that no LeaseRecord exists — the load-bearing post-condition.)
      expect(STATE.current.leaseRecords.size).toBe(0)
    } finally {
      dbMock.$transaction = realTxn
      void originalLeaseCreate
    }
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — idempotent re-run on a fresh stamp
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — idempotency", () => {
  it("re-running on the same Communication does not create duplicate rows", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    // First run.
    const first = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })
    expect(first.ok).toBe(true)

    // Second run — should hit the already_processed shortcut.
    const second = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error("unreachable")
    expect(second.reason).toBe("already_processed")

    expect(STATE.current.leaseRecords.size).toBe(1)
    expect(STATE.current.calendarEvents.size).toBe(1)
  })

  it("clearing the stamp and re-running upserts in place rather than appending", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    // Forcibly drop the version stamp to simulate reprocessing.
    const comm = STATE.current.communications.get(commId)!
    const meta = comm.metadata as Record<string, unknown>
    delete meta.closedDealClassification

    await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(STATE.current.leaseRecords.size).toBe(1)
    expect(STATE.current.calendarEvents.size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// processBacklogClosedDeals
// ---------------------------------------------------------------------------

describe("processBacklogClosedDeals", () => {
  it("processes pending Communications, persists cursor, returns complete", async () => {
    const c1 = seedCommunication({ id: "c-aaa", date: new Date("2025-01-01") })
    const c2 = seedCommunication({ id: "c-bbb", date: new Date("2025-02-01") })
    const c3 = seedCommunication({ id: "c-ccc", date: new Date("2025-03-01") })

    const processFn = vi.fn(async (commId: string) => {
      // Simulate the orchestrator stamping the metadata so the next
      // findMany doesn't return this Communication again.
      const row = STATE.current.communications.get(commId)!
      row.metadata = {
        closedDealClassification: { version: CLOSED_DEAL_CLASSIFIER_VERSION },
      }
      return {
        ok: true as const,
        leaseRecordId: `lease-${commId}`,
        calendarEventId: null,
        contactId: `contact-${commId}`,
        propertyId: null,
        classification: VALID_CLASSIFICATION,
        extraction: VALID_LEASE_EXTRACTION,
        contactClientTypeChanged: true,
      }
    })

    const result = await processBacklogClosedDeals({
      batchSize: 2,
      throttleMs: 0,
      processFn,
      assertBudgetFn: async () => {},
      sleepFn: async () => {},
    })

    expect(result.stoppedReason).toBe("complete")
    expect(result.processed).toBe(3)
    expect(result.leaseRecordsCreated).toBe(3)
    expect(processFn).toHaveBeenCalledTimes(3)

    // Cursor advanced to the last processed row.
    expect(result.cursor?.lastProcessedCommunicationId).toBe(c3)
    expect(result.cursor?.lastProcessedReceivedAt).toBe(
      new Date("2025-03-01").toISOString()
    )

    // SystemState was persisted under the default key.
    const cursor = STATE.current.systemStates.get("closed-deal-backlog-cursor")
    expect(cursor).toBeDefined()
    expect(processFn.mock.calls.map((c) => c[0])).toEqual([c1, c2, c3])
  })

  it("stops with reason budget when assertBudgetFn throws ScrubBudgetError", async () => {
    seedCommunication({ id: "c-1", date: new Date("2025-01-01") })
    seedCommunication({ id: "c-2", date: new Date("2025-02-01") })

    const { ScrubBudgetError } = await import("@/lib/ai/budget-tracker")
    let calls = 0
    const assertBudgetFn = vi.fn(async () => {
      calls += 1
      if (calls > 1) throw new ScrubBudgetError(10, 5)
    })

    const processFn = vi.fn(async (commId: string) => {
      const row = STATE.current.communications.get(commId)!
      row.metadata = {
        closedDealClassification: { version: CLOSED_DEAL_CLASSIFIER_VERSION },
      }
      return {
        ok: true as const,
        leaseRecordId: `lease-${commId}`,
        calendarEventId: null,
        contactId: `contact-${commId}`,
        propertyId: null,
        classification: VALID_CLASSIFICATION,
        extraction: VALID_LEASE_EXTRACTION,
        contactClientTypeChanged: false,
      }
    })

    const result = await processBacklogClosedDeals({
      batchSize: 5,
      throttleMs: 0,
      processFn,
      assertBudgetFn,
      sleepFn: async () => {},
    })

    expect(result.stoppedReason).toBe("budget")
    expect(result.processed).toBe(1)
  })

  it("stops with reason max_batches when limit is reached", async () => {
    // Three rows, batchSize 1, maxBatches 2 → process only 2.
    seedCommunication({ id: "c-1", date: new Date("2025-01-01") })
    seedCommunication({ id: "c-2", date: new Date("2025-02-01") })
    seedCommunication({ id: "c-3", date: new Date("2025-03-01") })

    const processFn = vi.fn(async (commId: string) => {
      const row = STATE.current.communications.get(commId)!
      row.metadata = {
        closedDealClassification: { version: CLOSED_DEAL_CLASSIFIER_VERSION },
      }
      return {
        ok: true as const,
        leaseRecordId: `lease-${commId}`,
        calendarEventId: null,
        contactId: `contact-${commId}`,
        propertyId: null,
        classification: VALID_CLASSIFICATION,
        extraction: VALID_LEASE_EXTRACTION,
        contactClientTypeChanged: false,
      }
    })

    const result = await processBacklogClosedDeals({
      batchSize: 1,
      throttleMs: 0,
      maxBatches: 2,
      processFn,
      assertBudgetFn: async () => {},
      sleepFn: async () => {},
    })

    expect(result.stoppedReason).toBe("max_batches")
    expect(result.processed).toBe(2)
  })

  it("stops with reason error after 5 consecutive per-Communication exceptions", async () => {
    // Seed 10 — driver should stop after the 5th consecutive failure,
    // not on the very first one (that was the old fragile behavior).
    for (let i = 1; i <= 10; i++) {
      seedCommunication({
        id: `c-${i.toString().padStart(2, "0")}`,
        date: new Date(`2025-01-${i.toString().padStart(2, "0")}T00:00:00Z`),
      })
    }

    const processFn = vi.fn(async () => {
      throw new Error("boom")
    })

    const result = await processBacklogClosedDeals({
      batchSize: 20,
      throttleMs: 0,
      processFn,
      assertBudgetFn: async () => {},
      sleepFn: async () => {},
    })

    expect(result.stoppedReason).toBe("error")
    expect(result.errors).toHaveLength(5)
    expect(result.errors[0].message).toBe("boom")
    expect(result.processed).toBe(0)
  })

  it("tolerates a single bad row in a batch and processes the rest", async () => {
    // 10 rows, the 3rd one throws. Driver should log it, advance the
    // cursor, process the other 9, finish "complete".
    for (let i = 1; i <= 10; i++) {
      seedCommunication({
        id: `c-${i.toString().padStart(2, "0")}`,
        date: new Date(`2025-01-${i.toString().padStart(2, "0")}T00:00:00Z`),
      })
    }

    let calls = 0
    const processFn = vi.fn(async (commId: string) => {
      calls += 1
      if (calls === 3) {
        throw new Error("transient blip on row 3")
      }
      const row = STATE.current.communications.get(commId)!
      row.metadata = {
        closedDealClassification: { version: CLOSED_DEAL_CLASSIFIER_VERSION },
      }
      return {
        ok: true as const,
        leaseRecordId: `lease-${commId}`,
        calendarEventId: null,
        contactId: `contact-${commId}`,
        propertyId: null,
        classification: VALID_CLASSIFICATION,
        extraction: VALID_LEASE_EXTRACTION,
        contactClientTypeChanged: true,
      }
    })

    const result = await processBacklogClosedDeals({
      batchSize: 20,
      throttleMs: 0,
      // Single batch — the test's findMany mock doesn't honor the cursor's
      // date-based pagination, so without this the still-unstamped failed
      // row would re-appear in the next batch and inflate the count.
      maxBatches: 1,
      processFn,
      assertBudgetFn: async () => {},
      sleepFn: async () => {},
    })

    expect(result.processed).toBe(9)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].communicationId).toBe("c-03")
    // Cursor advanced past all 10 rows including the failed one.
    expect(result.cursor?.lastProcessedCommunicationId).toBe("c-10")
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — contact-name validation (I7)
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — contact name validation", () => {
  it("happy path: a valid name still creates the Contact + LeaseRecord", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub(),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    const contact = STATE.current.contacts.get(out.contactId)!
    expect(contact.name).toBe("Brandon Miller")
  })

  it('falls back to email when contactName looks like "Re: ..." subject prefix', async () => {
    const commId = seedCommunication()

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub({
        ...VALID_LEASE_EXTRACTION,
        contactName: "Re: closed lease",
        contactEmail: "real@example.com",
      }),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    const contact = STATE.current.contacts.get(out.contactId)!
    // Display name fell back to lowercased email.
    expect(contact.name).toBe("real@example.com")
    expect(contact.email).toBe("real@example.com")
  })

  it("returns low_confidence and writes no rows when name is whitespace and email is null", async () => {
    const commId = seedCommunication()

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorStub({
        ...VALID_LEASE_EXTRACTION,
        contactName: "   ",
        contactEmail: null,
      }),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(false)
    if (out.ok) throw new Error("expected not ok")
    expect(out.reason).toBe("low_confidence")

    expect(STATE.current.contacts.size).toBe(0)
    expect(STATE.current.leaseRecords.size).toBe(0)
    expect(STATE.current.calendarEvents.size).toBe(0)

    // metadata stamp recorded the unusable_contact_name failure.
    const comm = STATE.current.communications.get(commId)!
    const meta = comm.metadata as Record<string, unknown>
    const attempt = meta.leaseExtractionAttempt as Record<string, unknown>
    expect(attempt.failedReason).toBe("unusable_contact_name")
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — concurrent metadata writers (C1)
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — preserves concurrent metadata writes", () => {
  it("does not clobber metadata keys written by other workers (e.g. scrub-applier)", async () => {
    // Seed a Communication with metadata.scrub already populated (as if
    // scrub-applier had written before the orchestrator fired). This is
    // the input snapshot the outer `comm.metadata` would have captured.
    const commId = seedCommunication({
      metadata: {
        scrub: { existingResult: "preserved" },
      },
    })
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    // Simulate a CONCURRENT scrub-applier write that lands DURING the
    // orchestrator's extractor call (between txn-1 and txn-2). If the
    // orchestrator re-reads metadata inside each txn (C1 fix), this key
    // survives. If it merges against the stale outer snapshot, this key
    // would be wiped by the txn-2 metadata write.
    const extractorWithRaceWrite = vi.fn(async (..._args: unknown[]) => {
      const row = STATE.current.communications.get(commId)!
      const meta = (row.metadata as Record<string, unknown>) ?? {}
      row.metadata = {
        ...meta,
        scrub: {
          ...(meta.scrub as Record<string, unknown> | undefined),
          raceWriteFromScrubApplier: "must_survive",
        },
      }
      return {
        ok: true as const,
        result: VALID_LEASE_EXTRACTION,
        modelUsed: "claude-haiku-4-5-20251001",
      }
    })

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub(),
      runLeaseExtractionFn: extractorWithRaceWrite,
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)

    const comm = STATE.current.communications.get(commId)!
    const meta = comm.metadata as Record<string, unknown>
    const scrub = meta.scrub as Record<string, unknown>
    // Original outer-snapshot key — preserved through all merges.
    expect(scrub.existingResult).toBe("preserved")
    // Race-write key landing between txn-1 and txn-2 — must survive
    // txn-2's metadata write because the orchestrator re-reads metadata
    // inside the txn (C1 fix).
    expect(scrub.raceWriteFromScrubApplier).toBe("must_survive")
    expect(meta.closedDealClassification).toBeDefined()
    expect(meta.leaseExtractionAttempt).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// processCommunicationForLease — sale-side end-to-end (I8)
// ---------------------------------------------------------------------------

describe("processCommunicationForLease — sale path", () => {
  it("processes dealKind=sale end-to-end with no CalendarEvent", async () => {
    const commId = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })

    const SALE_EXTRACTION: LeaseExtraction = {
      contactName: "Sara Buyer",
      contactEmail: "sara@example.com",
      propertyAddress: "303 N Broadway",
      closeDate: "2026-01-15",
      // Lease-only fields all null on a sale.
      leaseStartDate: null,
      leaseEndDate: null,
      leaseTermMonths: null,
      rentAmount: null,
      rentPeriod: null,
      mattRepresented: "owner",
      dealKind: "sale",
      confidence: 0.91,
      reasoning: "Closing statement attached.",
    }

    const out = await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub({
        classification: "closed_sale",
        confidence: 0.9,
        signals: ["closing statement"],
      }),
      runLeaseExtractionFn: extractorStub(SALE_EXTRACTION),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error("expected ok")
    expect(out.calendarEventId).toBeNull() // sales do not get a renewal event
    expect(STATE.current.calendarEvents.size).toBe(0)

    const lease = STATE.current.leaseRecords.get(out.leaseRecordId)!
    expect(lease.dealKind).toBe("sale")
    expect(lease.contactId).toBe(out.contactId)
    expect((lease.closeDate as Date).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z"
    )
    expect(lease.leaseStartDate).toBeNull()
    expect(lease.leaseEndDate).toBeNull()
    expect(lease.rentAmount).toBeNull()

    // Idempotency: clearing the classifier stamp + re-running should
    // upsert into the same LeaseRecord (sale upsert key is now
    // contactId+propertyId+closeDate).
    const comm = STATE.current.communications.get(commId)!
    const meta = comm.metadata as Record<string, unknown>
    delete meta.closedDealClassification
    await processCommunicationForLease(commId, {
      runClosedDealClassifierFn: classifierStub({
        classification: "closed_sale",
        confidence: 0.9,
        signals: ["closing statement"],
      }),
      runLeaseExtractionFn: extractorStub(SALE_EXTRACTION),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })
    expect(STATE.current.leaseRecords.size).toBe(1)
  })

  it("does NOT collapse two sales of DIFFERENT properties closed on the same day", async () => {
    // Regression for the original sale-side dedupe bug: two sales sharing
    // (contactId, closeDate) but on different properties must be two
    // distinct LeaseRecords. Real-world case: a broker closing two
    // adjacent units on the same day.
    const comm1 = seedCommunication()
    const comm2 = seedCommunication()
    seedProperty({ address: "303 N Broadway", propertyKey: "303 n broadway" })
    seedProperty({ address: "305 N Broadway", propertyKey: "305 n broadway" })

    const baseSale: LeaseExtraction = {
      contactName: "Sara Buyer",
      contactEmail: "sara@example.com",
      propertyAddress: "303 N Broadway",
      closeDate: "2026-01-15",
      leaseStartDate: null,
      leaseEndDate: null,
      leaseTermMonths: null,
      rentAmount: null,
      rentPeriod: null,
      mattRepresented: "owner",
      dealKind: "sale",
      confidence: 0.91,
      reasoning: "Sale 1.",
    }

    await processCommunicationForLease(comm1, {
      runClosedDealClassifierFn: classifierStub({
        classification: "closed_sale",
        confidence: 0.9,
        signals: [],
      }),
      runLeaseExtractionFn: extractorStub(baseSale),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    await processCommunicationForLease(comm2, {
      runClosedDealClassifierFn: classifierStub({
        classification: "closed_sale",
        confidence: 0.9,
        signals: [],
      }),
      runLeaseExtractionFn: extractorStub({
        ...baseSale,
        propertyAddress: "305 N Broadway",
        reasoning: "Sale 2.",
      }),
      now: new Date("2026-01-20T00:00:00Z"),
      settings: { leaseExtractorMinConfidence: 0.6 },
    })

    expect(STATE.current.leaseRecords.size).toBe(2)
    const allLeases = [...STATE.current.leaseRecords.values()]
    const propIds = new Set(allLeases.map((lr) => lr.propertyId))
    expect(propIds.size).toBe(2)
  })
})
