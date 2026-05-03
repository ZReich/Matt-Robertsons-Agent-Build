# Lease-Lifecycle Backfill Execution — Design Spec

**Date:** 2026-05-02
**Owner:** Zach (directive: "use sub agents for the build and audit everything adversarially for each phase. at the end test everything in the browser, each button each data and make sure it's all there")
**Predecessor plans:** [`docs/superpowers/plans/2026-05-02-lease-lifecycle.md`](../plans/2026-05-02-lease-lifecycle.md), [`docs/superpowers/plans/2026-04-29-deal-pipeline-and-ai-backfill.md`](../plans/2026-04-29-deal-pipeline-and-ai-backfill.md)

## Goal

Execute the dormant lease-lifecycle pipeline end-to-end against Matt's full ten-year Outlook archive: classify every email, extract structured lease/sale data from every closed-deal candidate (body **and** PDF attachments), persist `LeaseRecord` + `CalendarEvent` rows, drive `Contact.clientType` lifecycle transitions, and surface renewal alerts on the calendar + dashboard. Verify the result in the browser.

## What's already in place (do not rebuild)

- `LeaseRecord` + `CalendarEvent` schema applied (migration `20260502160000_lease_lifecycle`).
- Email-history backfill engine (`src/lib/msgraph/email-history-backfill.ts`), admin endpoint, operator script (`scripts/lease-history-scan.mjs`). Resume-safe via `SystemState` cursor.
- Closed-deal classifier scaffold (`src/lib/ai/closed-deal-classifier.ts`) with full validation, sensitive-content gate, and outcome typing. **Provider call is a stub** returning `null`.
- Lease extractor scaffold (`src/lib/ai/lease-extractor.ts`) with strict validator (date round-trip, lease-term cross-check, sale/lease field exclusivity, confidence floor). **Provider call is a stub** returning `null`.
- Renewal alert job (`src/lib/lease/renewal-alert-job.ts`).
- Calendar tab UI (`src/app/[lang]/(dashboard-layout)/apps/calendar/page.tsx`).
- Provider routing (`scrubWithConfiguredProvider` → DeepSeek; `scrubWithSensitiveProvider` → Haiku gated by `ROUTE_SENSITIVE_TO_CLAUDE`).
- All API keys present in `.env.local`: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://api.deepseek.com/v1`, `MSGRAPH_*`. Anthropic account is prepaid with $50.

## What this spec adds

### Component A — AI provider wiring

1. Author the system+user prompt in [`closed-deal-classifier.prompt.md`](../../../full-kit/src/lib/ai/closed-deal-classifier.prompt.md) (DeepSeek). Implement `callClassifier()` to POST to `${OPENAI_BASE_URL}/chat/completions` with the prompt as system msg, `{subject, body}` as user msg, JSON-mode response, parse → return `ClosedDealClassification`. Handles 429/5xx with one retry.
2. Author the prompt in [`lease-extractor.prompt.md`](../../../full-kit/src/lib/ai/lease-extractor.prompt.md) (Haiku). Implement `callExtractor()` against `https://api.anthropic.com/v1/messages` using `claude-haiku-4-5-20251001`, with a tool-use block whose `input_schema` mirrors `LeaseExtraction`. Parse the tool-use input, return raw object → existing validator narrows it.
3. **Hard cost guardrail**: every call goes through the existing `budget-tracker.ts`. If the daily budget cap (configurable, default $25/day for backfill mode) is exceeded, calls return `{ok:false, reason:"budget_exceeded"}` and the orchestrator pauses.

### Component B — Orchestrator

`src/lib/ai/lease-pipeline-orchestrator.ts`:

- `processCommunicationForLease(commId)` → runs Stage 1 (classifier). On `closed_lease` / `closed_sale`, runs Stage 2 (body extractor). If body extractor returns null/low-confidence (<0.6) AND the Communication has a PDF attachment, runs Component C (PDF extractor).
- On valid `LeaseExtraction`: idempotent upsert of `LeaseRecord` (key = `(contactId, propertyId, leaseStartDate)` or `(contactId, closeDate)` for sales); insert/update `CalendarEvent` for `leaseEndDate`; transition `Contact.clientType` to past/active client variant; enqueue renewal Todo if `leaseEndDate` is within `automationSettings.leaseRenewalLookaheadMonths` (default 6).
- Stamps `comm.metadata.closedDealClassification = {classification, confidence, version, runAt}` for idempotency on re-runs.
- `processBacklogClosedDeals({batchSize, throttleMs})` → cursor-driven loop over Communications missing the metadata stamp; resume-safe.

### Component C — PDF lease extractor (NEW — was out of scope in the lifecycle plan)

`src/lib/msgraph/download-attachment.ts`:
- `downloadAttachment(messageId, attachmentId): Promise<{contentBytes: Buffer, contentType: string, name: string}>`. Hits Graph `/users/{upn}/messages/{id}/attachments/{aid}` → reads `contentBytes` (base64) → returns Buffer.
- Honors per-call 1.5s rate-limit (Graph quota).

`src/lib/ai/pdf-lease-extractor.ts`:
- Builds an Anthropic Messages payload with the PDF as a `document` content block (Claude supports native PDF input). Uses the same prompt + tool-use schema as the body extractor, but loads PDF instead of email body.
- Returns the same `LeaseExtraction` shape; goes through the same validator.
- Skips files >32 MB or non-PDF content-types.

### Component D — Backfill execution

Sequenced shell steps documented in `docs/superpowers/notes/2026-05-02-backfill-runbook.md`:

1. Set `ROUTE_SENSITIVE_TO_CLAUDE=true` in `.env.local`.
2. Restart dev server.
3. `node scripts/lease-history-scan.mjs --start-year=2026 --end-year=2016 --folder=inbox` — runs in background. Logs to `.logs/lease-history-inbox.log`. Resume-safe.
4. Repeat with `--folder=sentitems`.
5. Once Communication count plateaus: `node scripts/process-closed-deal-backlog.mjs` (new) — calls `processBacklogClosedDeals` in batches of 50 with a 200ms throttle. Logs per-batch metrics.
6. Renewal alert job: triggered in step 5 per-LeaseRecord; also one final sweep at end via `POST /api/lease/renewal-sweep`.

### Component E — Verification

After Phase 3 completes, browser-test with `preview_*` tools:
- Calendar tab: month view, filter chips (lease_renewal / meeting / follow_up), click event → drawer opens with linked contact/property/lease.
- Dashboard: "N leases up this quarter" banner present and clickable.
- Pending Replies queue: any auto-drafted renewal outreach is visible.
- Contacts list: filter by `past_listing_client` shows non-zero count post-backfill.
- Todos: search "lease renewing" returns the new auto-created Todos.
- Open one Lease detail (drill from Contact → Lease tab) and confirm fields populated, source Communication linked.

Each surface is screen-shotted via `preview_screenshot` and the screenshots attached to the final report.

## Sub-agent execution model

Each Phase has TWO sub-agents launched in sequence (audit cannot start until build claims completion):

1. **Build agent** (general-purpose): Receives the scoped instructions for that Phase. Writes code, runs `pnpm test` + `pnpm exec tsc --noEmit`, returns "done" with a list of files changed.
2. **Adversarial audit agent** (`superpowers:code-reviewer`): Receives the same scoped instructions plus the build agent's diff. Probes for: missing edge cases, idempotency holes, cost-control bypasses, TypeScript any-escapes, untested branches, secrets leakage, schema constraint violations, race conditions on concurrent backfill batches. Reports issues in priority order.

If the audit returns critical/high issues, a follow-up build agent fixes them before the Phase is marked complete.

## Cost ceiling

Hard cap enforced via `SCRUB_DAILY_BUDGET_USD` (already exists). Backfill mode bumps it to **$30/day**; orchestrator respects the cap and pauses with a clear error rather than silently truncating. Resume by raising the cap or waiting until tomorrow.

Total expected one-time spend, in 2026 list pricing:

| Component | Provider | Volume | Cost |
|---|---|---|---|
| Stage-1 classification | DeepSeek-chat | ~880K msgs | ~$10 |
| Stage-2 email-body extraction | Haiku | ~5–15K msgs | ~$15–30 |
| Stage-2 PDF extraction | Haiku (vision) | ~500–2K PDFs | ~$15–60 |
| **Total** | — | — | **~$40–100** |

Anthropic prepaid balance ($50) covers the no-PDF path; PDF pass may need a top-up. Out-of-credit → orchestrator errors and pauses; no surprise bill.

## Out of scope (still)

- Buildout property catalog *additions* — already imported, this spec only links existing properties to new LeaseRecords.
- Plaud transcripts — separate ingestion path; this spec only consumes Communications already in DB.
- Phone-log unification — not relevant to leases.
- Mail.Send permission — does not block the backfill; only blocks auto-sending renewal-outreach emails (those will queue to PendingReply for manual send).

## Acceptance criteria

1. `LeaseRecord` table contains ≥50 rows after backfill (Matt has done many leases — if we get <50 the extractor or classifier prompt is undertuned and needs revision before we ship).
2. `CalendarEvent` table contains a `lease_renewal` row for each LeaseRecord with a non-null `leaseEndDate` in the future.
3. `Contact.clientType` distribution shows non-zero `past_listing_client` and `past_buyer_client` populations.
4. Browser verification: every surface listed in Component E renders without console errors and shows the expected data; all action buttons (Mark complete / Dismiss / Open lease / Approve renewal draft) round-trip a successful API response.
5. Cost report from `budget-tracker.ts` shows total spend ≤ $100.
6. No new TypeScript errors; full `pnpm test` suite passes.
