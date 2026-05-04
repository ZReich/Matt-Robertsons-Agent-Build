import { beforeEach, describe, expect, it, vi } from "vitest"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import { processBuildoutStageUpdate } from "./buildout-stage-action"

vi.mock("@/lib/prisma", () => {
  const tx = {
    communication: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    deal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      create: vi.fn(),
    },
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => []),
  }
  return {
    db: {
      ...tx,
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
  }
})

vi.mock("@/lib/contacts/sync-contact-role", () => ({
  syncContactRoleFromDeals: vi.fn(async () => ({
    contactId: "contact-1",
    fromClientType: null,
    toClientType: null,
    changed: false,
    actionId: null,
  })),
}))

const dbAny = db as unknown as {
  communication: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  deal: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  agentAction: { create: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  $queryRaw: ReturnType<typeof vi.fn>
}

const syncMock = syncContactRoleFromDeals as unknown as ReturnType<typeof vi.fn>

const STAGE_BODY_MARKETING_TO_SHOWINGS =
  "303 N Broadway was updated from Marketing to Showings.\nGood luck!"
const STAGE_BODY_TRANSACTING_TO_CLOSED =
  "Alpenglow Healthcare LLC Lease was updated from Transacting to Closed.\nNice work!"

function commRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comm-1",
    subject: "Deal stage updated on 303 N Broadway",
    body: STAGE_BODY_MARKETING_TO_SHOWINGS,
    metadata: {
      classification: "signal",
      source: "buildout-event",
      tier1Rule: "buildout-notification",
    },
    ...overrides,
  }
}

describe("processBuildoutStageUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbAny.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          communication: dbAny.communication,
          deal: dbAny.deal,
          agentAction: dbAny.agentAction,
          $executeRaw: dbAny.$executeRaw,
          $queryRaw: dbAny.$queryRaw,
        })
    )
    syncMock.mockResolvedValue({
      contactId: "contact-1",
      fromClientType: null,
      toClientType: null,
      changed: false,
      actionId: null,
    })
  })

  it("happy path: writes executed AgentAction, updates Deal, stamps idempotency, calls role sync", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.deal.findFirst.mockResolvedValue({
      id: "deal-1",
      stage: "marketing",
      contactId: "contact-1",
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("executed")
    if (result.status !== "executed") return
    expect(result.actionId).toBe("action-1")
    expect(result.dealId).toBe("deal-1")
    expect(result.fromStage).toBe("marketing")
    expect(result.toStage).toBe("showings")

    expect(dbAny.agentAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "move-deal-stage",
          tier: "auto",
          status: "executed",
          sourceCommunicationId: "comm-1",
          payload: expect.objectContaining({
            dealId: "deal-1",
            fromStage: "marketing",
            toStage: "showings",
            reason: "Buildout deal-stage update",
          }),
        }),
      })
    )

    const updateCall = dbAny.deal.update.mock.calls[0][0]
    expect(updateCall.where).toEqual({ id: "deal-1" })
    expect(updateCall.data.stage).toBe("showings")
    expect(updateCall.data.stageChangedAt).toBeInstanceOf(Date)

    const commUpdate = dbAny.communication.update.mock.calls[0][0]
    expect(commUpdate.where).toEqual({ id: "comm-1" })
    expect(commUpdate.data.metadata).toMatchObject({
      classification: "signal",
      buildoutStageUpdate: expect.objectContaining({
        dealId: "deal-1",
        oldStage: "marketing",
        newStage: "showings",
      }),
    })

    expect(syncMock).toHaveBeenCalledWith(
      "contact-1",
      expect.objectContaining({
        trigger: "deal_stage_change",
        dealId: "deal-1",
        sourceAgentActionId: "action-1",
      }),
      expect.anything()
    )
  })

  it("closed stage: stamps closedAt + outcome=won", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        subject: "Deal stage updated on Alpenglow Healthcare",
        body: STAGE_BODY_TRANSACTING_TO_CLOSED,
      })
    )
    dbAny.deal.findFirst.mockResolvedValue({
      id: "deal-2",
      stage: "under_contract",
      contactId: "contact-2",
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-2" })

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("executed")
    const updateCall = dbAny.deal.update.mock.calls[0][0]
    expect(updateCall.data.stage).toBe("closed")
    expect(updateCall.data.closedAt).toBeInstanceOf(Date)
    expect(updateCall.data.outcome).toBe("won")

    const payload = dbAny.agentAction.create.mock.calls[0][0].data.payload
    expect(payload.outcome).toBe("won")
  })

  it("Dead toStage: stamps closedAt + outcome=lost", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        body: "Valley Commons was updated from Sourcing to Dead.\n",
      })
    )
    dbAny.deal.findFirst.mockResolvedValue({
      id: "deal-3",
      stage: "prospecting",
      contactId: "contact-3",
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-3" })

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("executed")
    const updateCall = dbAny.deal.update.mock.calls[0][0]
    expect(updateCall.data.stage).toBe("closed")
    expect(updateCall.data.closedAt).toBeInstanceOf(Date)
    expect(updateCall.data.outcome).toBe("lost")
    const payload = dbAny.agentAction.create.mock.calls[0][0].data.payload
    expect(payload.outcome).toBe("lost")
  })

  it("returns sensitive-filtered when body trips the filter", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        body:
          STAGE_BODY_MARKETING_TO_SHOWINGS +
          "\nWire instructions attached. Routing number 123456789. ABA routing.",
      })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("sensitive-filtered")
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
    // Stamps idempotency so re-runs no-op.
    expect(dbAny.communication.update).toHaveBeenCalled()
    const stamped =
      dbAny.communication.update.mock.calls[0][0].data.metadata
        .buildoutStageUpdate
    expect(stamped.skippedReason).toBe("sensitive-filter")
  })

  it("returns not-a-stage-update when parser returns null", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({ body: "irrelevant body without transition" })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("not-a-stage-update")
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
  })

  it("returns not-a-stage-update when stage names are unmappable", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        body: "303 N Broadway was updated from Marketing to FrobnicatingStage.",
      })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("not-a-stage-update")
  })

  it("returns deal-not-found and stamps idempotency when no Deal matches", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.deal.findFirst.mockResolvedValue(null)

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("deal-not-found")
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
    const stamped =
      dbAny.communication.update.mock.calls[0][0].data.metadata
        .buildoutStageUpdate
    expect(stamped.skippedReason).toBe("deal-not-found")
  })

  it("returns stage-divergence when current stage != parsed fromStage", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.deal.findFirst.mockResolvedValue({
      id: "deal-1",
      stage: "offer",
      contactId: "contact-1",
    })

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("stage-divergence")
    if (result.status !== "stage-divergence") return
    expect(result.currentStage).toBe("offer")
    expect(result.expectedFromStage).toBe("marketing")
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
    const stamped =
      dbAny.communication.update.mock.calls[0][0].data.metadata
        .buildoutStageUpdate
    expect(stamped.skippedReason).toBe("stage-divergence")
  })

  it("is idempotent: returns already-processed when comm.metadata.buildoutStageUpdate is set", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        metadata: {
          classification: "signal",
          buildoutStageUpdate: {
            processedAt: "2026-05-02T12:00:00Z",
            dealId: "deal-1",
            oldStage: "marketing",
            newStage: "showings",
          },
        },
      })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("already-processed")
    expect(dbAny.deal.findFirst).not.toHaveBeenCalled()
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
    expect(dbAny.communication.update).not.toHaveBeenCalled()
  })

  it("returns non-buildout-source when metadata.source != buildout-event (defense in depth)", async () => {
    // Subject + body match the Buildout deal-stage pattern, but the upstream
    // filter never tagged this as a buildout-event source. Could be a forged
    // or misclassified inbound row. We must NOT process it.
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        metadata: {
          classification: "signal",
          source: "matt-outbound",
          tier1Rule: "sent-items",
        },
      })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("non-buildout-source")
    expect(dbAny.deal.findFirst).not.toHaveBeenCalled()
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    expect(dbAny.deal.update).not.toHaveBeenCalled()
    // Idempotency-stamps so re-runs short-circuit on the already-processed
    // path rather than hitting the source check again.
    expect(dbAny.communication.update).toHaveBeenCalled()
    const stamped =
      dbAny.communication.update.mock.calls[0][0].data.metadata
        .buildoutStageUpdate
    expect(stamped.skippedReason).toBe("non-buildout-source")
    expect(stamped.observedSource).toBe("matt-outbound")
  })

  it("returns non-buildout-source when metadata is missing entirely", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({ metadata: null })
    )

    const result = await processBuildoutStageUpdate("comm-1")

    expect(result.status).toBe("non-buildout-source")
    expect(dbAny.deal.findFirst).not.toHaveBeenCalled()
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    const stamped =
      dbAny.communication.update.mock.calls[0][0].data.metadata
        .buildoutStageUpdate
    expect(stamped.skippedReason).toBe("non-buildout-source")
  })

  it("returns comm-not-found when Communication does not exist", async () => {
    dbAny.communication.findUnique.mockResolvedValue(null)

    const result = await processBuildoutStageUpdate("comm-missing")

    expect(result.status).toBe("comm-not-found")
  })

  it("looks up Deal by propertyKey + dealType=seller_rep + archivedAt null", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.deal.findFirst.mockResolvedValue({
      id: "deal-1",
      stage: "marketing",
      contactId: "contact-1",
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

    await processBuildoutStageUpdate("comm-1")

    const call = dbAny.deal.findFirst.mock.calls[0][0]
    expect(call.where.dealType).toBe("seller_rep")
    expect(call.where.archivedAt).toBe(null)
    // propertyKey looked up via normalizeBuildoutProperty("303 N Broadway")
    // → "303 n broadway"
    expect(call.where.propertyKey).toBe("303 n broadway")
  })

  describe("stage-collapse guard (Sourcing → Evaluating both map to prospecting)", () => {
    it("returns stage-collapsed and writes no AgentAction / no Deal update for Sourcing → Evaluating", async () => {
      dbAny.communication.findUnique.mockResolvedValue(
        commRow({
          subject: "Deal stage updated on Valley Commons",
          body: "Valley Commons was updated from Sourcing to Evaluating.\nGood luck!",
        })
      )
      // Even if a Deal exists at prospecting, the collapsed mapping must
      // short-circuit *before* we even hit the deal lookup.
      dbAny.deal.findFirst.mockResolvedValue({
        id: "deal-collapsed",
        stage: "prospecting",
        contactId: "contact-1",
      })

      const result = await processBuildoutStageUpdate("comm-1")

      expect(result.status).toBe("stage-collapsed")
      if (result.status !== "stage-collapsed") return
      expect(result.collapsedTo).toBe("prospecting")
      expect(result.fromStageRaw).toBe("Sourcing")
      expect(result.toStageRaw).toBe("Evaluating")

      expect(dbAny.agentAction.create).not.toHaveBeenCalled()
      expect(dbAny.deal.update).not.toHaveBeenCalled()
      // Idempotency stamp written so re-runs short-circuit on already-processed.
      expect(dbAny.communication.update).toHaveBeenCalled()
      const stamped =
        dbAny.communication.update.mock.calls[0][0].data.metadata
          .buildoutStageUpdate
      expect(stamped.skippedReason).toBe("stage-collapsed")
    })

    it("does not collapse genuine moves like Marketing → Showings", async () => {
      dbAny.communication.findUnique.mockResolvedValue(commRow())
      dbAny.deal.findFirst.mockResolvedValue({
        id: "deal-1",
        stage: "marketing",
        contactId: "contact-1",
      })
      dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

      const result = await processBuildoutStageUpdate("comm-1")

      expect(result.status).toBe("executed")
    })
  })

  describe("concurrent-execution race (Finding 1)", () => {
    it("acquires a pg advisory lock inside the transaction before mutating", async () => {
      dbAny.communication.findUnique.mockResolvedValue(commRow())
      dbAny.deal.findFirst.mockResolvedValue({
        id: "deal-1",
        stage: "marketing",
        contactId: "contact-1",
      })
      dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

      await processBuildoutStageUpdate("comm-1")

      // The advisory lock must have been issued at least once inside the tx.
      expect(dbAny.$executeRaw).toHaveBeenCalled()
    })

    it("re-reads metadata inside the tx and short-circuits when a concurrent run already stamped", async () => {
      // First findUnique (pre-tx) returns no stamp — would normally proceed.
      // Second findUnique (in-tx, after the lock) returns a stamp written by
      // a concurrent caller. The second call MUST observe and bail.
      dbAny.communication.findUnique
        .mockResolvedValueOnce(commRow())
        .mockResolvedValueOnce({
          metadata: {
            classification: "signal",
            source: "buildout-event",
            buildoutStageUpdate: {
              processedAt: "2026-05-02T12:00:00Z",
              dealId: "deal-1",
              actionId: "action-concurrent",
              oldStage: "marketing",
              newStage: "showings",
            },
          },
        })

      const result = await processBuildoutStageUpdate("comm-1")

      expect(result.status).toBe("already-processed")
      if (result.status !== "already-processed") return
      expect(result.previous).toMatchObject({ actionId: "action-concurrent" })
      expect(dbAny.agentAction.create).not.toHaveBeenCalled()
      expect(dbAny.deal.update).not.toHaveBeenCalled()
      // No write should occur — the stamp is already there.
      expect(dbAny.communication.update).not.toHaveBeenCalled()
    })

    it("preserves concurrent metadata writes by spreading freshMeta into the stamp", async () => {
      // Pre-tx read: original meta. In-tx read: same meta plus a key set by
      // some concurrent unrelated write (e.g. another worker added foo:1).
      // The final stamp must spread the *fresh* meta, not the stale one.
      dbAny.communication.findUnique
        .mockResolvedValueOnce(commRow())
        .mockResolvedValueOnce({
          metadata: {
            classification: "signal",
            source: "buildout-event",
            tier1Rule: "buildout-notification",
            unrelatedConcurrentKey: "preserve-me",
          },
        })
      dbAny.deal.findFirst.mockResolvedValue({
        id: "deal-1",
        stage: "marketing",
        contactId: "contact-1",
      })
      dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

      await processBuildoutStageUpdate("comm-1")

      const finalMeta =
        dbAny.communication.update.mock.calls[0][0].data.metadata
      expect(finalMeta.unrelatedConcurrentKey).toBe("preserve-me")
      expect(finalMeta.buildoutStageUpdate).toBeDefined()
    })

    it("sequential back-to-back invocations: second call returns already-processed", async () => {
      // In-memory metadata shim: after the first call writes a stamp, the
      // second call's pre-tx findUnique sees that stamp and returns
      // already-processed without entering the tx.
      let stored: Record<string, unknown> = {
        classification: "signal",
        source: "buildout-event",
        tier1Rule: "buildout-notification",
      }
      dbAny.communication.findUnique.mockImplementation(async () => ({
        id: "comm-1",
        subject: "Deal stage updated on 303 N Broadway",
        body: STAGE_BODY_MARKETING_TO_SHOWINGS,
        metadata: stored,
      }))
      dbAny.communication.update.mockImplementation(
        async (args: { data: { metadata: Record<string, unknown> } }) => {
          stored = args.data.metadata
          return {}
        }
      )
      dbAny.deal.findFirst.mockResolvedValue({
        id: "deal-1",
        stage: "marketing",
        contactId: "contact-1",
      })
      dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })

      const first = await processBuildoutStageUpdate("comm-1")
      const second = await processBuildoutStageUpdate("comm-1")

      expect(first.status).toBe("executed")
      expect(second.status).toBe("already-processed")
      expect(dbAny.agentAction.create).toHaveBeenCalledTimes(1)
      expect(dbAny.deal.update).toHaveBeenCalledTimes(1)
    })
  })
})
