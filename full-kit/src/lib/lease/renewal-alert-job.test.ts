import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { runRenewalAlertSweep } from "./renewal-alert-job"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    leaseRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    todo: {
      create: vi.fn(),
    },
    calendarEvent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(),
    },
    pendingReply: {
      create: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
    },
    communication: {
      findUnique: vi.fn(),
    },
    systemState: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/msgraph/send-mail", () => ({
  sendMailAsMatt: vi.fn(async () => ({ ok: true, messageId: "stub" })),
}))

const mockedDb = db as unknown as {
  leaseRecord: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  todo: { create: ReturnType<typeof vi.fn> }
  calendarEvent: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  pendingReply: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  property: { findUnique: ReturnType<typeof vi.fn> }
  contact: { findUnique: ReturnType<typeof vi.fn> }
  communication: { findUnique: ReturnType<typeof vi.fn> }
  systemState: { findUnique: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

const NOW = new Date("2026-05-01T12:00:00.000Z")

function months(d: Date, n: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + n)
  return out
}
function days(d: Date, n: number): Date {
  const out = new Date(d.getTime())
  out.setUTCDate(out.getUTCDate() + n)
  return out
}

function makeLease(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lease-1",
    contactId: "contact-1",
    propertyId: "property-1",
    dealId: null,
    sourceCommunicationId: null,
    closeDate: new Date("2021-05-01T00:00:00.000Z"),
    leaseStartDate: new Date("2021-05-01T00:00:00.000Z"),
    leaseEndDate: months(NOW, 6), // exactly at the lookahead boundary
    leaseTermMonths: 60,
    rentAmount: null,
    rentPeriod: null,
    mattRepresented: "tenant",
    dealKind: "lease",
    extractionConfidence: 0.95,
    status: "active",
    notes: null,
    metadata: {},
    archivedAt: null,
    contact: {
      id: "contact-1",
      name: "Jane Doe",
      email: "jane@example.com",
    },
    property: {
      id: "property-1",
      address: "123 Main St",
    },
    ...overrides,
  }
}

function setupSettings(
  overrides: Partial<Record<string, unknown>> = {}
): void {
  mockedDb.systemState.findUnique.mockResolvedValue({
    key: "app.automation_settings",
    value: {
      autoSendNewLeadReplies: false,
      autoSendDailyMatchReplies: false,
      autoMatchScoreThreshold: 80,
      dailyMatchPerContactCap: 2,
      leaseRenewalLookaheadMonths: 6,
      autoSendLeaseRenewalReplies: false,
      ...overrides,
    },
  })
}

function setupTransaction(): void {
  // Re-read inside the txn returns "active", then the txn body runs the
  // create + update calls against the same `tx` object (= db here).
  mockedDb.leaseRecord.findUnique.mockResolvedValue({ status: "active" })
  mockedDb.todo.create.mockResolvedValue({ id: "todo-1" })
  mockedDb.calendarEvent.create.mockResolvedValue({ id: "event-1" })
  mockedDb.leaseRecord.update.mockResolvedValue({})
  mockedDb.$transaction.mockImplementation(
    async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
  )
}

function setupAiFetch(): ReturnType<typeof vi.fn> {
  // Stub the model HTTP roundtrip — generatePendingReply itself runs.
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: "function",
                function: {
                  name: "draft_reply",
                  arguments: JSON.stringify({
                    subject: "Checking in on your lease",
                    body: "Hi Jane,\n\n...\n\nMatt Robertson",
                    reasoning: "warm renewal touchpoint",
                  }),
                },
              },
            ],
          },
        },
      ],
    }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("runRenewalAlertSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = "test-key"
    setupSettings()
    setupTransaction()
    // Default: generatePendingReply's downstream lookups all succeed.
    mockedDb.property.findUnique.mockResolvedValue({
      id: "property-1",
      address: "123 Main St",
      name: "Main St Building",
      unit: null,
      city: "Billings",
      state: "MT",
      propertyType: "office",
      status: "active",
      squareFeet: 5000,
      listPrice: null,
      capRate: null,
      listingUrl: null,
      flyerUrl: null,
      description: null,
    })
    mockedDb.contact.findUnique.mockResolvedValue({
      id: "contact-1",
      name: "Jane Doe",
      email: "jane@example.com",
      company: null,
      role: null,
    })
    mockedDb.communication.findUnique.mockResolvedValue(null)
    mockedDb.pendingReply.create.mockResolvedValue({ id: "pending-1" })
    mockedDb.pendingReply.update.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fires for a lease ending exactly at the lookahead boundary", async () => {
    const lease = makeLease({ leaseEndDate: months(NOW, 6) })
    mockedDb.leaseRecord.findMany.mockResolvedValue([lease])
    setupAiFetch()

    const result = await runRenewalAlertSweep({ now: NOW })

    expect(result.candidatesFound).toBe(1)
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]?.todoId).toBe("todo-1")
    expect(result.outcomes[0]?.calendarEventId).toBe("event-1")
  })

  it("does not fire for a lease ending well past the lookahead window", async () => {
    // findMany would normally not return a 12-month-out lease; we ASSERT
    // the WHERE predicate by inspecting the call args.
    mockedDb.leaseRecord.findMany.mockResolvedValue([])

    const result = await runRenewalAlertSweep({ now: NOW })

    expect(result.candidatesFound).toBe(0)
    const call = mockedDb.leaseRecord.findMany.mock.calls[0]?.[0] as {
      where?: { leaseEndDate?: { gte?: Date; lte?: Date } }
    }
    const lte = call?.where?.leaseEndDate?.lte
    const gte = call?.where?.leaseEndDate?.gte
    expect(lte).toBeInstanceOf(Date)
    expect(gte).toBeInstanceOf(Date)
    // A lease 12 months out is NOT in the [now+6m-7d, now+6m] window.
    const farFuture = months(NOW, 12)
    expect(farFuture.getTime()).toBeGreaterThan((lte as Date).getTime())
  })

  it("does not fire for a lease that already ended (it's expired, not expiring)", async () => {
    mockedDb.leaseRecord.findMany.mockResolvedValue([])

    const result = await runRenewalAlertSweep({ now: NOW })

    expect(result.candidatesFound).toBe(0)
    const call = mockedDb.leaseRecord.findMany.mock.calls[0]?.[0] as {
      where?: { leaseEndDate?: { gte?: Date } }
    }
    const gte = call?.where?.leaseEndDate?.gte as Date
    // A lease that ended yesterday is BEFORE the gte cutoff.
    const yesterday = days(NOW, -1)
    expect(yesterday.getTime()).toBeLessThan(gte.getTime())
  })

  it("does not re-process a lease already in expiring_soon status", async () => {
    // The query scopes to status="active", so an "expiring_soon" lease
    // is filtered out at the DB layer. Verify the WHERE clause asks for
    // status === "active".
    mockedDb.leaseRecord.findMany.mockResolvedValue([])

    await runRenewalAlertSweep({ now: NOW })

    const call = mockedDb.leaseRecord.findMany.mock.calls[0]?.[0] as {
      where?: { status?: string }
    }
    expect(call?.where?.status).toBe("active")
  })

  it("creates a Todo + CalendarEvent + PendingReply per match", async () => {
    const lease = makeLease()
    mockedDb.leaseRecord.findMany.mockResolvedValue([lease])
    const fetchMock = setupAiFetch()

    const result = await runRenewalAlertSweep({ now: NOW })

    expect(result.outcomes).toHaveLength(1)
    expect(mockedDb.todo.create).toHaveBeenCalledTimes(1)
    expect(mockedDb.calendarEvent.create).toHaveBeenCalledTimes(1)
    expect(mockedDb.pendingReply.create).toHaveBeenCalledTimes(1)
    expect(mockedDb.leaseRecord.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: { status: "expiring_soon" },
    })

    // Todo data
    const todoArg = mockedDb.todo.create.mock.calls[0]?.[0]
    expect(todoArg.data.contactId).toBe("contact-1")
    expect(todoArg.data.priority).toBe("medium")
    expect(todoArg.data.dedupeKey).toBe("lease-renewal:lease-1")
    expect(todoArg.data.title).toContain("Jane Doe")
    expect(todoArg.data.title).toContain("123 Main St")

    // CalendarEvent data
    const eventArg = mockedDb.calendarEvent.create.mock.calls[0]?.[0]
    expect(eventArg.data.eventKind).toBe("lease_renewal_outreach")
    expect(eventArg.data.leaseRecordId).toBe("lease-1")
    expect(eventArg.data.contactId).toBe("contact-1")

    // PendingReply linkage
    const prArg = mockedDb.pendingReply.create.mock.calls[0]?.[0]
    expect(prArg.data.leaseRecordId).toBe("lease-1")
    expect(prArg.data.contactId).toBe("contact-1")

    // AI roundtrip happened
    expect(fetchMock).toHaveBeenCalledOnce()

    // No auto-send (settings flag is off by default)
    expect(result.outcomes[0]?.draftSent).toBe(false)
  })

  it("skips the email-draft when the source communication trips the strict sensitive filter", async () => {
    const lease = makeLease({
      sourceCommunicationId: "comm-sensitive",
    })
    mockedDb.leaseRecord.findMany.mockResolvedValue([lease])
    mockedDb.communication.findUnique.mockResolvedValue({
      id: "comm-sensitive",
      subject: "Wire instructions for closing",
      body: "Please use the wire instructions below: routing number 123456789, bank account 987654321.",
    })
    const fetchMock = setupAiFetch()

    const result = await runRenewalAlertSweep({ now: NOW })

    // Side effects (Todo + Event + status flip) still happen — the lease
    // is a real renewal candidate; only the AI draft is gated.
    expect(mockedDb.todo.create).toHaveBeenCalledTimes(1)
    expect(mockedDb.calendarEvent.create).toHaveBeenCalledTimes(1)

    // No AI roundtrip and no PendingReply persisted.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockedDb.pendingReply.create).not.toHaveBeenCalled()

    expect(result.outcomes[0]?.pendingReplyId).toBeNull()
    expect(result.outcomes[0]?.draftSkippedReason).toBe("sensitive_content")
  })
})
