import { describe, expect, it, vi } from "vitest"

import {
  applyCoverageReviewAction,
  dedupeKey,
  listCoverageReviewItems,
  minimizeOperationalReviewMetadata,
  parseReviewActionPayload,
  parseReviewItemsQuery,
  reasonKey,
  upsertOperationalEmailReview,
} from "./communication-coverage"

describe("communication coverage service", () => {
  it("canonicalizes reason and dedupe keys for stable review rows", () => {
    expect(
      reasonKey(["noise_cre_terms", "noise_active_thread", "noise_cre_terms"])
    ).toBe("noise_active_thread|noise_cre_terms")
    expect(
      dedupeKey({
        communicationId: "comm-1",
        type: "pending_mark_done",
        reasonKey: "pending_mark_done",
        subjectEntityKind: "todo",
        subjectEntityId: "todo-1",
      })
    ).toBe("comm-1|pending_mark_done|pending_mark_done|todo|todo-1")
  })

  it("minimizes metadata and redacts token-bearing evidence", () => {
    const metadata = minimizeOperationalReviewMetadata({
      classification: "noise",
      riskReasonCodes: ["noise_cre_terms"],
      evidenceSnippets: [
        "Open https://example.test/?token=abcdefghijklmnopqrstuvwxyz123456 now",
      ],
      coarseDate: new Date("2026-04-29T12:00:00Z"),
    })

    expect(metadata).toEqual(
      expect.objectContaining({
        classification: "noise",
        riskReasonCodes: ["noise_cre_terms"],
        coarseDate: "2026-04-29",
      })
    )
    expect(JSON.stringify(metadata)).not.toContain(
      "abcdefghijklmnopqrstuvwxyz123456"
    )
    expect(JSON.stringify(metadata)).not.toContain("https://example.test")
  })

  it("strictly validates drilldown query parameters", () => {
    expect(() =>
      parseReviewItemsQuery(
        "https://example.test/api/agent/coverage/review-items?filter=bogus"
      )
    ).toThrow("invalid filter")
    expect(() =>
      parseReviewItemsQuery(
        "https://example.test/api/agent/coverage/review-items?filter=never_queued&extra=1"
      )
    ).toThrow("unknown query parameter")
    expect(() =>
      parseReviewItemsQuery(
        "https://example.test/api/agent/coverage/review-items?filter=never_queued&limit=500"
      )
    ).toThrow("invalid limit")
  })

  it("returns minimized stable DTOs without raw mailbox fields", async () => {
    const coverageRow = {
      id: "comm-1",
      communication_id: "comm-1",
      review_id: null,
      review_status: null,
      review_reason_codes: null,
      review_reason_key: null,
      review_recommended_action: null,
      review_policy_version: null,
      review_created_at: null,
      review_snoozed_until: null,
      date: new Date("2026-04-29T12:00:00Z"),
      created_at: new Date("2026-04-29T12:00:00Z"),
      subject: "Lease offer https://graph.microsoft.com/messages/abc",
      direction: "inbound",
      contact_id: null,
      metadata: {
        classification: "signal",
        from: { address: "tenant@example.com" },
        bodyPreview: "forbidden body preview",
        internetMessageId: "<message@example.com>",
        graphId: "AAMkAGVeryRawGraphId",
      },
      queue_id: null,
      queue_status: null,
      queue_attempts: null,
      queue_enqueued_at: null,
      queue_locked_until: null,
      queue_last_error: null,
      action_id: null,
      action_type: null,
      action_status: null,
      action_target_entity: null,
      action_summary: null,
      action_created_at: null,
      risk_score: 90,
      item_created_at: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      $queryRaw: vi.fn().mockResolvedValue([coverageRow]),
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "review-1",
          communicationId: "comm-1",
          type: "missed_eligible",
          status: "open",
          riskScore: 90,
          reasonCodes: ["signal_without_queue"],
          reasonKey: "signal_without_queue",
          dedupeKey: "comm-1|missed_eligible|signal_without_queue",
          recommendedAction: "enqueue_or_requeue_scrub",
          policyVersion: "coverage-review-v1",
          createdAt: new Date("2026-04-29T12:00:00Z"),
        }),
      },
    }

    const result = await listCoverageReviewItems(
      { filter: "missed_eligible", limit: 10 },
      client as never
    )
    const json = JSON.stringify(result)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: "review-1",
      communicationId: "comm-1",
      coarseDate: "2026-04-29",
      senderDomain: "example.com",
      reasonCodes: ["signal_without_queue"],
    })
    expect(result.items[0]).not.toHaveProperty("senderEmail")
    expect(client.operationalEmailReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communicationId: "comm-1",
          type: "missed_eligible",
          status: "open",
        }),
      })
    )
    expect(json).not.toContain("forbidden body preview")
    expect(json).not.toContain("internetMessageId")
    expect(json).not.toContain("AAMkAGVeryRawGraphId")
    expect(json).not.toContain("bodyPreview")

    client.operationalEmailReview.findFirst.mockReset()
    client.operationalEmailReview.create.mockReset()
    client.operationalEmailReview.create.mockRejectedValueOnce({
      code: "P2002",
    })
    client.operationalEmailReview.findFirst.mockResolvedValueOnce(null)
    client.operationalEmailReview.findFirst.mockResolvedValueOnce({
      id: "review-raced",
      communicationId: "comm-1",
      type: "missed_eligible",
      status: "open",
      riskScore: 90,
      reasonCodes: ["signal_without_queue"],
      reasonKey: "signal_without_queue",
      dedupeKey: "comm-1|missed_eligible|signal_without_queue",
      recommendedAction: "enqueue_or_requeue_scrub",
      policyVersion: "coverage-review-v1",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    })
    client.$queryRaw.mockResolvedValueOnce([
      {
        ...coverageRow,
        id: "comm-1",
        review_id: null,
        review_status: null,
        review_reason_codes: null,
        review_reason_key: null,
        review_recommended_action: null,
        review_policy_version: null,
        review_created_at: null,
        review_snoozed_until: null,
      },
    ])
    await expect(
      listCoverageReviewItems(
        { filter: "missed_eligible", limit: 10 },
        client as never
      )
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ id: "review-raced" })],
    })
  })

  it("suppresses terminal true-noise rows unless policy or reasons change", async () => {
    const existing = {
      id: "review-1",
      communicationId: "comm-1",
      type: "suspicious_noise",
      status: "resolved",
      operatorOutcome: "true_noise",
      policyVersion: "coverage-review-v1",
      reasonKey: "noise_cre_terms",
      dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "suspicious_noise",
        riskScore: 50,
        reasonCodes: ["noise_cre_terms"],
        recommendedAction: "review_noise_classification",
      },
      client as never
    )

    expect(result).toMatchObject({
      skipped: true,
      reason: "terminal_suppressed",
    })
    expect(client.operationalEmailReview.create).not.toHaveBeenCalled()
  })

  it("requires dry-run before write actions and enqueues scrub idempotently", async () => {
    const review = {
      id: "review-1",
      communicationId: "comm-1",
      type: "missed_eligible",
      status: "open",
      reasonCodes: ["signal_without_queue"],
      reasonKey: "signal_without_queue",
      dedupeKey: "comm-1|missed_eligible|signal_without_queue",
      recommendedAction: "enqueue_or_requeue_scrub",
      policyVersion: "coverage-review-v1",
      riskScore: 90,
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findUnique: vi.fn().mockResolvedValue(review),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      systemState: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      scrubQueue: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "queue-1" }),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (fn) => fn(client)),
    }

    await expect(
      applyCoverageReviewAction(
        "review-1",
        {
          action: "enqueue_scrub",
          dryRun: false,
          runId: "run-1",
          reason: null,
          snoozedUntil: null,
          reviewer: "Reviewer",
        },
        client as never
      )
    ).rejects.toThrow("dry run required before write")

    await applyCoverageReviewAction(
      "review-1",
      {
        action: "enqueue_scrub",
        dryRun: true,
        runId: "run-1",
        reason: null,
        snoozedUntil: null,
        reviewer: "Reviewer",
      },
      client as never
    )
    client.systemState.findUnique.mockResolvedValue({ key: "dry-run" })

    const result = await applyCoverageReviewAction(
      "review-1",
      {
        action: "enqueue_scrub",
        dryRun: false,
        runId: "run-1",
        reason: "reviewed",
        snoozedUntil: null,
        reviewer: "Reviewer",
      },
      client as never
    )

    expect(result).toMatchObject({
      status: "enqueued",
      scrubQueueId: "queue-1",
    })
    expect(client.scrubQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { communicationId: "comm-1", status: "pending" },
      })
    )
  })

  it("filters terminal-suppressed materialization rows from drilldown results", async () => {
    const client = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "comm-1",
          communication_id: "comm-1",
          review_id: null,
          review_status: null,
          review_reason_codes: null,
          review_reason_key: null,
          review_recommended_action: null,
          review_policy_version: null,
          review_created_at: null,
          review_snoozed_until: null,
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          subject: "Deal",
          direction: "inbound",
          contact_id: null,
          metadata: { classification: "noise" },
          queue_id: null,
          queue_status: null,
          queue_attempts: null,
          queue_enqueued_at: null,
          queue_locked_until: null,
          queue_last_error: null,
          action_id: null,
          action_type: null,
          action_status: null,
          action_target_entity: null,
          action_summary: null,
          action_created_at: null,
          risk_score: 65,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
      ]),
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue({
          id: "review-1",
          communicationId: "comm-1",
          type: "suspicious_noise",
          status: "resolved",
          operatorOutcome: "true_noise",
          policyVersion: "coverage-review-v1",
          reasonKey: "noise_cre_terms|noise_direct_to_matt",
          dedupeKey:
            "comm-1|suspicious_noise|noise_cre_terms|noise_direct_to_matt",
          createdAt: new Date("2026-04-29T12:00:00Z"),
        }),
        create: vi.fn(),
      },
    }

    const result = await listCoverageReviewItems(
      { filter: "suspicious_noise", limit: 10 },
      client as never
    )

    expect(result.items).toHaveLength(0)
    expect(client.operationalEmailReview.create).not.toHaveBeenCalled()
  })

  it("returns structured unsupported responses for coupled identity actions", async () => {
    const client = {
      operationalEmailReview: {
        findUnique: vi.fn().mockResolvedValue({
          id: "review-1",
          communicationId: "comm-1",
          status: "open",
        }),
      },
    }

    const result = await applyCoverageReviewAction(
      "review-1",
      {
        action: "deterministic_link_contact",
        dryRun: true,
        runId: "run-1",
        reason: null,
        snoozedUntil: null,
        reviewer: "Reviewer",
      },
      client as never
    )

    expect(result).toMatchObject({
      status: "unsupported",
      unsupportedReason: expect.stringContaining("deferred"),
    })
  })

  it("strictly rejects invalid action payloads", () => {
    expect(() =>
      parseReviewActionPayload({ action: "bogus", dryRun: true })
    ).toThrow("invalid action")
    expect(() =>
      parseReviewActionPayload({
        action: "mark_true_noise",
        dryRun: true,
        reviewItemIds: ["review-1"],
      })
    ).toThrow("unknown body key")
    expect(() =>
      parseReviewActionPayload({ action: "mark_true_noise", dryRun: false })
    ).toThrow("runId is required")
  })

  it("rejects malformed runId formats and snoozedUntil coupling", () => {
    expect(() =>
      parseReviewActionPayload({
        action: "mark_true_noise",
        dryRun: false,
        runId: "with spaces and !!! illegal chars",
      })
    ).toThrow("invalid runId")
    expect(() =>
      parseReviewActionPayload({
        action: "mark_true_noise",
        dryRun: false,
        runId: "x".repeat(101),
      })
    ).toThrow("invalid runId")
    expect(() =>
      parseReviewActionPayload({
        action: "mark_true_noise",
        dryRun: true,
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      })
    ).toThrow("snoozedUntil only allowed")
    expect(() =>
      parseReviewActionPayload({
        action: "snooze",
        dryRun: true,
        snoozedUntil: new Date(Date.now() - 86_400_000).toISOString(),
      })
    ).toThrow("snoozedUntil must be in the future")
  })

  it("strips control characters from operator notes", () => {
    const payload = parseReviewActionPayload({
      action: "mark_true_noise",
      dryRun: true,
      reason: "alertbeep[31mred[0m null bytes",
    })
    expect(payload.reason).not.toMatch(/[ -]/)
    expect(payload.reason).toContain("alert")
    expect(payload.reason).toContain("red")
  })

  it("reopens existing open rows in place instead of inserting", async () => {
    const existing = {
      id: "review-existing",
      communicationId: "comm-1",
      type: "missed_eligible",
      status: "open",
      operatorOutcome: null,
      policyVersion: "coverage-review-v1",
      reasonKey: "signal_without_queue",
      dedupeKey: "comm-1|missed_eligible|signal_without_queue",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const updated = {
      ...existing,
      riskScore: 90,
      reasonCodes: ["signal_without_queue"],
      reasonKey: "signal_without_queue",
      recommendedAction: "enqueue_or_requeue_scrub",
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
        create: vi.fn(),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "missed_eligible",
        riskScore: 90,
        reasonCodes: ["signal_without_queue"],
        recommendedAction: "enqueue_or_requeue_scrub",
      },
      client as never
    )

    expect(result).toMatchObject({ skipped: false })
    expect(client.operationalEmailReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "review-existing" } })
    )
    expect(client.operationalEmailReview.create).not.toHaveBeenCalled()
  })

  it("suppresses snoozed rows whose snoozedUntil is still in the future", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const existing = {
      id: "review-snoozed",
      communicationId: "comm-1",
      type: "suspicious_noise",
      status: "snoozed",
      snoozedUntil: future,
      policyVersion: "coverage-review-v1",
      reasonKey: "noise_cre_terms",
      dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "suspicious_noise",
        riskScore: 50,
        reasonCodes: ["noise_cre_terms"],
        recommendedAction: "review_noise_classification",
      },
      client as never
    )

    expect(result).toMatchObject({ skipped: true, reason: "snoozed" })
    expect(client.operationalEmailReview.create).not.toHaveBeenCalled()
    expect(client.operationalEmailReview.update).not.toHaveBeenCalled()
  })

  it("suppresses ignored rows when policy version and reasonKey match", async () => {
    const existing = {
      id: "review-ignored",
      communicationId: "comm-1",
      type: "missed_eligible",
      status: "ignored",
      policyVersion: "coverage-review-v1",
      reasonKey: "signal_without_queue",
      dedupeKey: "comm-1|missed_eligible|signal_without_queue",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "missed_eligible",
        riskScore: 90,
        reasonCodes: ["signal_without_queue"],
        recommendedAction: "enqueue_or_requeue_scrub",
      },
      client as never
    )

    expect(result).toMatchObject({ skipped: true, reason: "terminal_suppressed" })
    expect(client.operationalEmailReview.create).not.toHaveBeenCalled()
  })

  it("creates a fresh open row when policy version changes after resolved/ignored", async () => {
    const existing = {
      id: "review-stale",
      communicationId: "comm-1",
      type: "suspicious_noise",
      status: "resolved",
      operatorOutcome: "true_noise",
      policyVersion: "coverage-review-v0",
      reasonKey: "noise_cre_terms",
      dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn().mockResolvedValue({
          id: "review-fresh",
          communicationId: "comm-1",
          type: "suspicious_noise",
          status: "open",
          riskScore: 65,
          reasonCodes: ["noise_cre_terms"],
          reasonKey: "noise_cre_terms",
          dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
          recommendedAction: "review_noise_classification",
          policyVersion: "coverage-review-v1",
          createdAt: new Date("2026-04-29T13:00:00Z"),
        }),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "suspicious_noise",
        riskScore: 65,
        reasonCodes: ["noise_cre_terms"],
        recommendedAction: "review_noise_classification",
      },
      client as never
    )

    expect(result.skipped).toBe(false)
    expect(result.review?.id).toBe("review-fresh")
    expect(client.operationalEmailReview.create).toHaveBeenCalledTimes(1)
  })

  it("creates a fresh open row when reasonKey changes after resolved true_noise", async () => {
    const existing = {
      id: "review-old",
      communicationId: "comm-1",
      type: "suspicious_noise",
      status: "resolved",
      operatorOutcome: "true_noise",
      policyVersion: "coverage-review-v1",
      reasonKey: "noise_cre_terms",
      dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const client = {
      operationalEmailReview: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn().mockResolvedValue({
          id: "review-fresh",
          communicationId: "comm-1",
          type: "suspicious_noise",
          status: "open",
          riskScore: 80,
          reasonCodes: ["noise_cre_terms", "noise_direct_to_matt"],
          reasonKey: "noise_cre_terms|noise_direct_to_matt",
          dedupeKey:
            "comm-1|suspicious_noise|noise_cre_terms|noise_direct_to_matt",
          recommendedAction: "review_noise_classification",
          policyVersion: "coverage-review-v1",
          createdAt: new Date("2026-04-29T13:00:00Z"),
        }),
      },
    }

    const result = await upsertOperationalEmailReview(
      {
        communicationId: "comm-1",
        type: "suspicious_noise",
        riskScore: 80,
        reasonCodes: ["noise_direct_to_matt", "noise_cre_terms"],
        recommendedAction: "review_noise_classification",
      },
      client as never
    )

    expect(result.skipped).toBe(false)
    expect(client.operationalEmailReview.create).toHaveBeenCalledTimes(1)
  })

  it("emits distinct reason codes and risk scores per filter bucket", async () => {
    const baseRow = {
      review_id: null,
      review_status: null,
      review_reason_codes: null,
      review_reason_key: null,
      review_recommended_action: null,
      review_policy_version: null,
      review_created_at: null,
      review_snoozed_until: null,
      direction: "inbound",
      contact_id: null,
      metadata: { classification: "signal" },
      queue_id: null,
      queue_status: null,
      queue_attempts: null,
      queue_enqueued_at: null,
      queue_locked_until: null,
      queue_last_error: null,
      action_id: null,
      action_type: null,
      action_status: null,
      action_target_entity: null,
      action_summary: null,
      action_created_at: null,
    }

    const buckets = {
      orphaned_context: {
        filterRow: {
          ...baseRow,
          id: "comm-orphan",
          communication_id: "comm-orphan",
          subject: "Tour request",
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          metadata: { classification: "signal" },
          risk_score: 75,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
        reasonCodes: ["orphaned_signal"],
        riskScore: 75,
        recommendedAction: "review_contact_linkage",
      },
      failed_scrub: {
        filterRow: {
          ...baseRow,
          id: "comm-fail",
          communication_id: "comm-fail",
          subject: "Failed scrub",
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          metadata: { classification: "signal" },
          queue_status: "failed",
          queue_attempts: 3,
          risk_score: 83,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
        reasonCodes: ["failed_queue_old"],
        riskScore: 83,
        recommendedAction: "enqueue_or_requeue_scrub",
      },
      stale_queue: {
        filterRow: {
          ...baseRow,
          id: "comm-stale",
          communication_id: "comm-stale",
          subject: "Stuck in queue",
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          metadata: { classification: "signal" },
          queue_status: "in_flight",
          risk_score: 65,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
        reasonCodes: ["in_flight_stale"],
        riskScore: 65,
        recommendedAction: "enqueue_or_requeue_scrub",
      },
      missed_eligible: {
        filterRow: {
          ...baseRow,
          id: "comm-uncertain",
          communication_id: "comm-uncertain",
          subject: "Maybe a deal",
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          metadata: { classification: "uncertain" },
          risk_score: 70,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
        reasonCodes: ["uncertain_without_queue"],
        riskScore: 70,
        recommendedAction: "enqueue_or_requeue_scrub",
      },
      never_queued: {
        filterRow: {
          ...baseRow,
          id: "comm-never",
          communication_id: "comm-never",
          subject: "No queue row",
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          metadata: { classification: "uncertain" },
          risk_score: 45,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
        reasonCodes: ["uncertain_without_queue"],
        riskScore: 45,
        recommendedAction: "enqueue_or_requeue_scrub",
      },
    } as const

    for (const [filter, fixture] of Object.entries(buckets)) {
      const client = {
        $queryRaw: vi.fn().mockResolvedValue([fixture.filterRow]),
        operationalEmailReview: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }) => ({
            id: `review-${filter}`,
            ...data,
            createdAt: new Date("2026-04-29T12:00:00Z"),
          })),
        },
      }

      const result = await listCoverageReviewItems(
        {
          filter: filter as Parameters<typeof listCoverageReviewItems>[0]["filter"],
          limit: 5,
        },
        client as never
      )
      expect(result.items).toHaveLength(1)
      expect(result.items[0].reasonCodes).toEqual(fixture.reasonCodes)
      expect(result.items[0].riskScore).toBe(fixture.riskScore)
      expect(result.items[0].recommendedAction).toBe(fixture.recommendedAction)
    }
  })

  it("does not collapse suspicious-noise sub-buckets to the same reason set", async () => {
    const fixtures = [
      {
        label: "direct-to-matt",
        row: {
          contact_id: null,
          direction: "inbound",
          subject: "Hi Matt",
          metadata: { classification: "noise" },
        },
        expected: ["noise_direct_to_matt"],
      },
      {
        label: "known-contact-newsletter",
        row: {
          contact_id: "contact-1",
          direction: "inbound",
          subject: "Newsletter for you",
          metadata: { classification: "noise" },
        },
        expected: ["noise_known_contact_signal", "noise_direct_to_matt"],
      },
      {
        label: "active-thread-cre-terms",
        row: {
          contact_id: null,
          direction: "outbound",
          subject: "RE: Lease offer for 123 Main",
          metadata: { classification: "noise" },
        },
        expected: ["noise_cre_terms"],
      },
      {
        label: "internal-platform",
        row: {
          contact_id: null,
          direction: "outbound",
          subject: "Daily digest",
          metadata: { classification: "noise" },
        },
        expected: ["noise_active_thread"],
      },
    ]

    const seenReasonKeys = new Set<string>()
    for (const fixture of fixtures) {
      const row = {
        id: fixture.label,
        communication_id: fixture.label,
        review_id: null,
        review_status: null,
        review_reason_codes: null,
        review_reason_key: null,
        review_recommended_action: null,
        review_policy_version: null,
        review_created_at: null,
        review_snoozed_until: null,
        date: new Date("2026-04-29T12:00:00Z"),
        created_at: new Date("2026-04-29T12:00:00Z"),
        subject: fixture.row.subject,
        direction: fixture.row.direction,
        contact_id: fixture.row.contact_id,
        metadata: fixture.row.metadata,
        queue_id: null,
        queue_status: null,
        queue_attempts: null,
        queue_enqueued_at: null,
        queue_locked_until: null,
        queue_last_error: null,
        action_id: null,
        action_type: null,
        action_status: null,
        action_target_entity: null,
        action_summary: null,
        action_created_at: null,
        risk_score: 50,
        item_created_at: new Date("2026-04-29T12:00:00Z"),
      }
      const client = {
        $queryRaw: vi.fn().mockResolvedValue([row]),
        operationalEmailReview: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }) => ({
            id: `review-${fixture.label}`,
            ...data,
            createdAt: new Date("2026-04-29T12:00:00Z"),
          })),
        },
      }
      const result = await listCoverageReviewItems(
        { filter: "suspicious_noise", limit: 5 },
        client as never
      )
      expect(result.items).toHaveLength(1)
      expect(result.items[0].reasonCodes).toEqual(fixture.expected)
      seenReasonKeys.add(result.items[0].reasonKey)
    }
    // Different sub-buckets must produce distinct reasonKeys so reviewers
    // can tell them apart in dedupe and listing surfaces.
    expect(seenReasonKeys.size).toBe(fixtures.length)
  })

  it("produces a stable cursor when riskScore and item_created_at tie", async () => {
    const ts = new Date("2026-04-29T12:00:00Z")
    const rowFor = (id: string) => ({
      id,
      communication_id: id,
      review_id: id,
      review_status: "open",
      review_reason_codes: ["signal_without_queue"],
      review_reason_key: "signal_without_queue",
      review_recommended_action: "enqueue_or_requeue_scrub",
      review_policy_version: "coverage-review-v1",
      review_created_at: ts,
      review_snoozed_until: null,
      date: ts,
      created_at: ts,
      subject: `subject ${id}`,
      direction: "inbound",
      contact_id: null,
      metadata: { classification: "signal" },
      queue_id: null,
      queue_status: null,
      queue_attempts: null,
      queue_enqueued_at: null,
      queue_locked_until: null,
      queue_last_error: null,
      action_id: null,
      action_type: null,
      action_status: null,
      action_target_entity: null,
      action_summary: null,
      action_created_at: null,
      risk_score: 50,
      item_created_at: ts,
    })

    const client = {
      $queryRaw: vi
        .fn()
        // First page returns rows + spillover (limit + 1 == 3)
        .mockResolvedValueOnce([
          rowFor("review-c"),
          rowFor("review-b"),
          rowFor("review-a"),
        ])
        .mockResolvedValueOnce([rowFor("review-a")]),
      operationalEmailReview: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    }

    const firstPage = await listCoverageReviewItems(
      { filter: "missed_eligible", limit: 2 },
      client as never
    )
    expect(firstPage.items.map((i) => i.id)).toEqual(["review-c", "review-b"])
    expect(firstPage.pageInfo.nextCursor).not.toBeNull()

    const cursor = firstPage.pageInfo.nextCursor as string
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    )
    expect(parsed).toMatchObject({
      riskScore: 50,
      createdAt: ts.toISOString(),
      id: "review-b",
    })

    const secondPage = await listCoverageReviewItems(
      { filter: "missed_eligible", limit: 2, cursor },
      client as never
    )
    expect(secondPage.items.map((i) => i.id)).toEqual(["review-a"])
  })

  it("returns DTOs containing only the allowlisted public field set", async () => {
    const client = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "comm-allow",
          communication_id: "comm-allow",
          review_id: "review-allow",
          review_status: "open",
          review_reason_codes: ["signal_without_queue"],
          review_reason_key: "signal_without_queue",
          review_recommended_action: "enqueue_or_requeue_scrub",
          review_policy_version: "coverage-review-v1",
          review_created_at: new Date("2026-04-29T12:00:00Z"),
          review_snoozed_until: null,
          date: new Date("2026-04-29T12:00:00Z"),
          created_at: new Date("2026-04-29T12:00:00Z"),
          subject: "Lease offer",
          direction: "inbound",
          contact_id: null,
          metadata: {
            classification: "signal",
            from: { address: "tenant@example.com" },
            bodyPreview: "leak preview",
            internetMessageId: "<leak>",
            graphId: "AAMkLeak",
            recipients: ["matt@example.com"],
          },
          queue_id: null,
          queue_status: null,
          queue_attempts: null,
          queue_enqueued_at: null,
          queue_locked_until: null,
          queue_last_error: null,
          action_id: null,
          action_type: null,
          action_status: null,
          action_target_entity: null,
          action_summary: null,
          action_created_at: null,
          risk_score: 90,
          item_created_at: new Date("2026-04-29T12:00:00Z"),
        },
      ]),
      operationalEmailReview: { findFirst: vi.fn(), create: vi.fn() },
    }

    const result = await listCoverageReviewItems(
      { filter: "missed_eligible", limit: 5 },
      client as never
    )
    const allowed = new Set([
      "id",
      "communicationId",
      "type",
      "status",
      "coarseDate",
      "subject",
      "senderDomain",
      "classification",
      "queueState",
      "scrubState",
      "contactState",
      "actionState",
      "riskScore",
      "reasonCodes",
      "reasonKey",
      "recommendedAction",
      "policyVersion",
      "evidenceSnippets",
      "createdAt",
    ])
    const itemKeys = new Set(Object.keys(result.items[0]))
    expect(new Set([...itemKeys].filter((k) => !allowed.has(k)))).toEqual(
      new Set()
    )
    expect(allowed.size).toBe(itemKeys.size)
    const json = JSON.stringify(result)
    expect(json).not.toContain("bodyPreview")
    expect(json).not.toContain("internetMessageId")
    expect(json).not.toContain("AAMkLeak")
    expect(json).not.toContain("leak preview")
    expect(json).not.toContain("matt@example.com")
    expect(json).not.toContain("tenant@example.com")
  })

  it("locks the review row in a transaction before mutating non-queue actions", async () => {
    const review = {
      id: "review-lock",
      communicationId: "comm-1",
      type: "suspicious_noise",
      status: "open",
      reasonCodes: ["noise_cre_terms"],
      reasonKey: "noise_cre_terms",
      dedupeKey: "comm-1|suspicious_noise|noise_cre_terms",
      recommendedAction: "review_noise_classification",
      policyVersion: "coverage-review-v1",
      riskScore: 50,
      createdAt: new Date("2026-04-29T12:00:00Z"),
    }
    const queryRaw = vi.fn().mockResolvedValue([])
    const client = {
      operationalEmailReview: {
        findUnique: vi.fn().mockResolvedValue(review),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      systemState: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ key: "dry-run", value: { runId: "run-1" } }),
        upsert: vi.fn(),
      },
      $queryRaw: queryRaw,
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(client)
      ),
    }

    await applyCoverageReviewAction(
      "review-lock",
      {
        action: "mark_true_noise",
        dryRun: false,
        runId: "run-1",
        reason: "confirmed",
        snoozedUntil: null,
        reviewer: "Reviewer",
      },
      client as never
    )

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(queryRaw).toHaveBeenCalled()
    expect(client.operationalEmailReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "review-lock", status: { in: ["open", "snoozed"] } },
      })
    )
  })
})
