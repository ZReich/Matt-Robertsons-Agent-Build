# Phase 3 Runbook: Live 10-Year Lease Backfill

**Date:** 2026-05-03  
**Operator:** Zach Reichert  
**Branch:** `lease-backfill-execution`  
**Purpose:** Step-by-step guide for running the full 10-year historical lease backfill against production Supabase.

> All commands assume you are in the `full-kit` directory with `.env.local` sourced. Run this once per terminal session before anything else:
> ```bash
> cd full-kit
> set -a && source .env.local && set +a
> ```

---

## 1. Pre-flight checks

### 1a. Verify worktree and branch

```bash
pwd          # must end with: .worktrees/lease-backfill-execution/full-kit
git branch --show-current   # must print: lease-backfill-execution
```

If either check fails, **STOP**. Do not run anything until you are on the correct branch and in the correct worktree.

### 1b. Confirm required env keys

All of the following must be set in `.env.local`. Verify with:

```bash
grep -E \
  "MSGRAPH_CLIENT_ID|MSGRAPH_CLIENT_SECRET|MSGRAPH_TENANT_ID|MSGRAPH_USER_ID|\
ANTHROPIC_API_KEY|OPENAI_API_KEY|OPENAI_BASE_URL|MSGRAPH_TEST_ADMIN_TOKEN|\
ROUTE_SENSITIVE_TO_CLAUDE|LEASE_BACKFILL_DAILY_BUDGET_USD" \
  .env.local
```

Required keys:
| Key | Expected value / note |
|---|---|
| `MSGRAPH_CLIENT_ID` | Azure app registration client ID |
| `MSGRAPH_CLIENT_SECRET` | Azure app registration secret |
| `MSGRAPH_TENANT_ID` | Azure tenant ID |
| `MSGRAPH_USER_ID` | Matt's Microsoft user ID (GUID) |
| `ANTHROPIC_API_KEY` | Anthropic key — balance check below |
| `OPENAI_API_KEY` | DeepSeek API key (routed to DeepSeek endpoint) |
| `OPENAI_BASE_URL` | **Must be** `https://api.deepseek.com/v1` |
| `MSGRAPH_TEST_ADMIN_TOKEN` | Admin token used by all operator scripts |
| `ROUTE_SENSITIVE_TO_CLAUDE` | **Must be** `true` for this backfill |
| `LEASE_BACKFILL_DAILY_BUDGET_USD` | Set to `30` if not already present |

If `ROUTE_SENSITIVE_TO_CLAUDE` is missing or `false`, sensitive emails will be skipped rather than routed to Haiku — add it:

```bash
echo 'ROUTE_SENSITIVE_TO_CLAUDE=true' >> .env.local
```

If `LEASE_BACKFILL_DAILY_BUDGET_USD` is not set:

```bash
echo 'LEASE_BACKFILL_DAILY_BUDGET_USD=30' >> .env.local
```

Re-source after any edit:

```bash
set -a && source .env.local && set +a
```

### 1c. Confirm tests pass

```bash
pnpm test
pnpm exec tsc --noEmit --pretty false
```

Expected: 1007+ tests passing, 1 skipped, tsc exits 0. If tests fail, **STOP** and investigate before running any backfill.

### 1d. Verify Anthropic balance

Log into [console.anthropic.com](https://console.anthropic.com) and confirm credit balance > $50. The worst-case spend for the full backfill is $200–450 (see Section 6), but it is throttled to $30/day so it drains over 7–15 days. Having at least $50 available ensures the first few days run uninterrupted.

---

## 2. Communication backfill (the 10-year email scan)

This step populates the `Communication` table by scanning Matt's inbox and sent items from 2016 through 2026. It is a prerequisite for the closed-deal backlog sweep in Section 4.

The script `scripts/lease-history-scan.mjs` already exists from a prior phase. It walks the Graph API month by month, newest to oldest, and stores progress in a `SystemState` cursor so restarts are safe.

### 2a. Inbox scan

```bash
mkdir -p .logs
node scripts/lease-history-scan.mjs \
  --start-year=2026 \
  --end-year=2016 \
  --folder=inbox \
  2>&1 | tee .logs/lease-history-inbox.log
```

Or as a background process (recommended for a ~12-hour run):

```bash
mkdir -p .logs
nohup node scripts/lease-history-scan.mjs \
  --start-year=2026 \
  --end-year=2016 \
  --folder=inbox \
  > .logs/lease-history-inbox.log 2>&1 &
echo "Inbox scan PID: $!"
```

### 2b. Sent items scan (run in a separate terminal, in parallel)

```bash
nohup node scripts/lease-history-scan.mjs \
  --start-year=2026 \
  --end-year=2016 \
  --folder=sentitems \
  > .logs/lease-history-sentitems.log 2>&1 &
echo "Sent items scan PID: $!"
```

### What to expect

- Each folder takes approximately 12 hours wall-clock, depending on Graph API throttling.
- You will see one log line per invocation (the script re-calls the API endpoint per batch of months). Normal output:
  ```
  [invocation 1] 2.3s — seen=47 inserted=12 monthsProcessed=1 monthsSkipped=0 errors=0 lastCompletedMonth=2026-12 done=false
  ```
- The cursor in `SystemState` survives interrupts. If you kill the process, re-run the same command and it resumes from the last completed month.
- When done: `done=true` is printed and the script exits 0.

---

## 3. Validation: small-batch sweep first

Before running the full closed-deal backlog, do a small validation pass to confirm the classifier and extractor are producing sane LeaseRecords.

**Prerequisite:** The dev server must be running (`pnpm dev` in a separate terminal, or deploy to Vercel).

### 3a. Run a 1-batch sweep of 10 Communications

```bash
node scripts/process-closed-deal-backlog.mjs \
  --max-batches=1 \
  --batch-size=10 \
  --throttle-ms=500
```

Expected output:

```
[2026-05-03T...] process-closed-deal-backlog starting { batchSize: 10, throttleMs: 500, maxBatches: 1, ... }
[invocation 1] 8.2s — processed=10 leaseRecordsCreated=3 errors=0 stoppedReason=max_batches cursor=...
[2026-05-03T...] process-closed-deal-backlog stopped: max_batches — invocations=1 processed=10 leaseRecordsCreated=3 errors=0
```

### 3b. Inspect the resulting LeaseRecords

Connect to the database (use `DIRECT_URL` for psql to avoid PgBouncer issues) and run:

```sql
-- Most recently created LeaseRecords
SELECT
  lr.id,
  lr.dealKind,
  c.name AS contact_name,
  c.email AS contact_email,
  p.address AS property_address,
  lr.leaseStartDate,
  lr.leaseEndDate,
  lr.rentAmount,
  lr.extractionConfidence,
  lr.createdAt
FROM "LeaseRecord" lr
LEFT JOIN "Contact" c ON lr.contactId = c.id
LEFT JOIN "Property" p ON lr.propertyId = p.id
WHERE lr.createdBy = 'lease-pipeline-orchestrator'
ORDER BY lr.createdAt DESC
LIMIT 20;
```

Check:
- `contact_name` and `contact_email` look real (not hallucinated strings like "Re:" or "FW:").
- `property_address` either matches a known property or is NULL (acceptable when no match found).
- `extractionConfidence` is >= 0.7 (the default threshold).
- `dealKind` (lease vs sale) matches what you'd expect from those emails.

If the results look like garbage (e.g., all NULLs, junk contact names, wrong dealKind), **STOP**. Review the classifier/extractor prompts before proceeding.

### 3c. Check the classifier stamp on Communications

```sql
-- Verify classifier stamps landed
SELECT
  metadata->'closedDealClassification'->>'classification' AS classification,
  metadata->'closedDealClassification'->>'confidence' AS confidence,
  metadata->'closedDealClassification'->>'version' AS version,
  COUNT(*) AS cnt
FROM "Communication"
WHERE metadata->'closedDealClassification' IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY cnt DESC
LIMIT 20;
```

---

## 4. Full backfill execution

Once the small-batch validation looks good, run the full backlog sweep.

### 4a. Run the backlog driver (foreground, with logging)

```bash
mkdir -p .logs
nohup node scripts/process-closed-deal-backlog.mjs \
  --batch-size=50 \
  --throttle-ms=250 \
  > .logs/closed-deal-backlog.log 2>&1 &
echo "Backlog driver PID: $!"
```

Or foreground (useful for the first hour to watch live):

```bash
node scripts/process-closed-deal-backlog.mjs \
  --batch-size=50 \
  --throttle-ms=250 \
  2>&1 | tee .logs/closed-deal-backlog.log
```

### 4b. What to expect

The driver loops calling `POST /api/lease/process-backlog` and exits when one of the stop conditions fires (see Section 7):

- **Budget cap hit** (`stoppedReason: "budget"`): normal — just re-run the same command tomorrow after the daily budget resets. The cursor persists in `SystemState`.
- **Complete** (`stoppedReason: "complete"`): all Communications have been classified. Move to Section 5.
- **Max batches** (`stoppedReason: "max_batches"`): only if you passed `--max-batches`; re-run to continue.
- **Error** (`stoppedReason: "error"`): 5 consecutive or 50 total errors. Investigate before re-running (see Section 10).

### 4c. Expected duration

| Stage | Volume | Per-item latency | Wall-clock estimate |
|---|---|---|---|
| Classifier (DeepSeek) | ~880K Communications | ~50ms | ~12 hours total |
| Body extractor (Haiku) | ~5–15K closed deals | ~3s | ~4–12 hours total |
| PDF extractor (Haiku) | ~500–2K with PDFs | ~5s | ~1–3 hours total |

Total: 17–27 hours of active processing, spread over 7–15 days at the $30/day cap.

The driver exits and resumes automatically each day — just re-run when `stoppedReason: "budget"` fires.

---

## 5. Renewal alert sweep

After the backlog is complete (or at any point to catch leases with upcoming expirations), run the renewal sweep:

```bash
curl -s -X POST http://localhost:3000/api/lease/renewal-sweep \
  -H "x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN" \
  | jq .
```

Expected response:

```json
{
  "ok": true,
  "candidatesFound": 42,
  "todosCreated": 38,
  "pendingRepliesCreated": 12,
  "alreadyHandled": 4
}
```

If `candidatesFound` is 0 and the backlog is complete, either no leases have upcoming expirations within the configured window, or the renewal sweep window needs adjustment in `AutomationSettings`.

---

## 6. Cost monitoring

Run this SQL at any point to see live spend broken down by outcome type:

```sql
SELECT
  outcome,
  COUNT(*) AS calls,
  SUM(estimated_usd)::NUMERIC(10,2) AS total_usd,
  AVG(estimated_usd)::NUMERIC(10,6) AS avg_usd
FROM scrub_api_calls
WHERE at >= NOW() - INTERVAL '24 hours'
GROUP BY outcome
ORDER BY total_usd DESC;
```

### Expected cost ranges (full backfill)

| Step | Outcome label(s) | Per-call cost | Volume | Total |
|---|---|---|---|---|
| DeepSeek classifier | `classifier-ok`, `classifier-validation-failed` | ~$0.000196 | ~880K | ~$170 |
| Haiku body extractor | `extractor-ok`, `extractor-validation-failed` | ~$0.001–0.005 | ~5–15K | ~$15–75 |
| Haiku PDF extractor | `extractor-pdf-ok`, `extractor-pdf-failed` | ~$0.05–0.10 | ~500–2K | ~$25–200 |
| **TOTAL** | | | | **~$210–445** |

At the $30/day cap, the full backfill spans **7–15 days**.

> **Note on the $40–100 range from the original plan:** The original plan estimated $40–100 assuming a lower fraction of emails would classify as closed deals and trigger the extractor. If Matt's inbox has a higher hit rate (e.g., 5%+ of 880K = 44K extraction calls), the upper end could reach $300–450. The $30/day cap ensures this stays manageable regardless of actual hit rate. Flag to the user if daily spend is consistently hitting $30 after just a few hundred extractions (would indicate a classifier false-positive problem).

### Daily budget check

```sql
-- Today's spend vs cap
SELECT
  DATE(at) AS day,
  SUM(estimated_usd)::NUMERIC(10,2) AS total_usd
FROM scrub_api_calls
WHERE at >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

---

## 7. Stop conditions

The backlog driver (`process-closed-deal-backlog.mjs`) exits cleanly for each of these:

| `stoppedReason` | Meaning | Action |
|---|---|---|
| `complete` | No more Communications to process | Proceed to Section 5 (renewal sweep) |
| `budget` | Daily cap hit; orchestrator stopped itself | Re-run tomorrow; cursor persists automatically |
| `max_batches` | Operator-specified `--max-batches` cap hit | Re-run with same or higher `--max-batches` |
| `error` | 5 consecutive or 50 total per-row errors | Check logs and recent errors (see Section 10) |

The inner `stoppedReason: "budget"` is raised by `assertWithinLeaseBackfillBudget`, which reads the rolling daily total from `scrub_api_calls`. Re-running the driver the next calendar day (UTC) works automatically.

---

## 8. Verification queries

Run these after the backlog sweep completes to confirm the data looks right.

### Total LeaseRecords by deal year

```sql
SELECT
  EXTRACT(YEAR FROM COALESCE(lr.leaseStartDate, lr.closeDate)) AS deal_year,
  COUNT(*) AS records
FROM "LeaseRecord" lr
WHERE lr.createdBy = 'lease-pipeline-orchestrator'
GROUP BY deal_year
ORDER BY deal_year DESC;
```

### Distribution by dealKind

```sql
SELECT dealKind, COUNT(*) AS cnt
FROM "LeaseRecord"
WHERE createdBy = 'lease-pipeline-orchestrator'
GROUP BY dealKind;
```

### Distribution by extraction confidence bucket

```sql
SELECT
  CASE
    WHEN extractionConfidence >= 0.9 THEN 'high (≥0.9)'
    WHEN extractionConfidence >= 0.7 THEN 'medium (0.7–0.9)'
    ELSE 'low (<0.7)'
  END AS confidence_bucket,
  COUNT(*) AS cnt
FROM "LeaseRecord"
WHERE createdBy = 'lease-pipeline-orchestrator'
GROUP BY confidence_bucket
ORDER BY cnt DESC;
```

### Calendar events scheduled in the next 90 days

```sql
SELECT
  ce.title,
  ce.startDate,
  c.name AS contact_name,
  p.address AS property_address
FROM "CalendarEvent" ce
LEFT JOIN "Contact" c ON ce.contactId = c.id
LEFT JOIN "Property" p ON ce.propertyId = p.id
WHERE ce.eventKind = 'lease_renewal'
  AND ce.startDate BETWEEN NOW() AND NOW() + INTERVAL '90 days'
  AND ce.createdBy = 'lease-pipeline-orchestrator'
ORDER BY ce.startDate;
```

### Contact.clientType distribution (run before and after backfill to compare)

```sql
SELECT clientType, COUNT(*) AS cnt
FROM "Contact"
GROUP BY clientType
ORDER BY cnt DESC;
```

### Communications still pending classification (progress check)

```sql
SELECT COUNT(*) AS unclassified
FROM "Communication"
WHERE archivedAt IS NULL
  AND (
    metadata IS NULL
    OR NOT (
      metadata->'closedDealClassification'->>'version' = 'v1'
    )
  );
```

Replace `'v1'` with the current `CLOSED_DEAL_CLASSIFIER_VERSION` value from `src/lib/ai/closed-deal-classifier.ts` if it has changed.

---

## 9. Recovery procedures

### Resume after crash or budget stop

Just re-run the backlog driver. The cursor in `SystemState` row `closed-deal-backlog-cursor` picks up from where it left off:

```bash
node scripts/process-closed-deal-backlog.mjs \
  --batch-size=50 \
  --throttle-ms=250 \
  2>&1 | tee -a .logs/closed-deal-backlog.log
```

### Force a full re-scan (bump prompt version)

If the classifier or extractor prompts were updated and you want to re-classify all Communications:

1. Bump `CLOSED_DEAL_CLASSIFIER_VERSION` in `src/lib/ai/closed-deal-classifier.ts`.
2. Clear the old stamps so the backlog driver sees them as unprocessed:

```sql
-- DESTRUCTIVE: only run after a deliberate version bump.
-- Clears the closedDealClassification stamp from all Communications
-- that carry the OLD version (replace 'v1' with the old version string).
UPDATE "Communication"
SET metadata = metadata - 'closedDealClassification'
WHERE metadata->'closedDealClassification'->>'version' = 'v1';
```

3. Reset the cursor to restart from the beginning:

```sql
DELETE FROM "SystemState" WHERE key = 'closed-deal-backlog-cursor';
```

4. Re-run the driver.

### Re-run extractor only (keep classifier stamps)

If you want to re-extract but keep the classifier stamps (e.g., extraction prompt improved):

1. Bump `LEASE_EXTRACTOR_VERSION` in `src/lib/ai/lease-extractor.ts`.
2. The `pdfAttempted` stamp is version-gated — bumping the version automatically allows PDF fallback to retry.
3. You do NOT need to clear `closedDealClassification` stamps — the driver will re-run the extractor on any Communication whose stamp version does not match the current classifier version. If you only bumped the extractor version (not the classifier), you need to also clear the classifier stamps or the driver will skip those rows as `already_processed`.

The cleanest approach is to bump both versions together and use the full re-scan procedure above.

### Cancel mid-flight

```bash
# Kill the driver script (NOT the dev server)
kill <pid>
# PID was printed when you started it with &
# Verify:
ps aux | grep process-closed-deal-backlog
```

Do not kill the Next.js dev server (it serves the API the driver calls). The cursor is persisted after each batch, so killing the driver between batches loses at most one batch of progress.

---

## 10. Out-of-scope failure handling

### Anthropic out of credits

Symptom: `extractor-provider-error` rows in `scrub_api_calls` accumulating; extraction calls fail with `provider_error`.

The orchestrator continues processing (classifier still runs; extractor failures are tolerated). The backlog driver will eventually hit the `error` stop condition if provider errors are sustained.

Fix:
1. Add credits at [console.anthropic.com](https://console.anthropic.com).
2. Re-run the driver. Communications with `pdfAttempted: false` in their `leaseExtractionAttempt` stamp will be retried on the next run (the classifier short-circuit prevents re-classifying them, but the extractor stamp does not block re-extraction).

Note: A `provider_error` does NOT write a `pdfAttempted: true` stamp, so PDF fallback will be retried automatically on the next run.

### DeepSeek rate-limited

Symptom: `classifier-provider-error` rows; classifier calls fail.

The closed-deal classifier retries once internally before surfacing as a per-row error. If the rate limit is sustained, errors will accumulate and the driver will stop on the `error` condition.

Fix: wait for the rate limit window to pass (typically 60 seconds), then re-run the driver. DeepSeek's free tier has per-minute limits; the $30/day throttle keeps the request rate well below the sustained limit for paid tiers.

### Dev server not running

Symptom: `network error contacting http://localhost:3000/api/lease/process-backlog`.

Fix: start the dev server in a separate terminal:

```bash
cd full-kit
set -a && source .env.local && set +a
pnpm dev
```

Or point the driver at the Vercel preview URL:

```bash
node scripts/process-closed-deal-backlog.mjs \
  --url=https://your-preview-url.vercel.app \
  --batch-size=50 \
  --throttle-ms=250
```

### Shadow Postgres not running (for schema changes only)

If you need to run `prisma migrate diff` or `migrate dev` during the backfill:

```bash
docker start shadow-postgres
# or fresh:
docker run -d --name shadow-postgres \
  -e POSTGRES_PASSWORD=shadow \
  -p 5433:5432 postgres:15
```

This does NOT affect the backfill itself — shadow Postgres is only needed for Prisma schema migrations.

---

## Appendix: Quick-reference command sheet

All commands assume `cd full-kit && set -a && source .env.local && set +a` has been run.

```bash
# Pre-flight
git branch --show-current          # must print: lease-backfill-execution
pnpm test && pnpm exec tsc --noEmit --pretty false

# Email scan (run both in parallel in separate terminals)
mkdir -p .logs
nohup node scripts/lease-history-scan.mjs \
  --start-year=2026 --end-year=2016 --folder=inbox \
  > .logs/lease-history-inbox.log 2>&1 &
nohup node scripts/lease-history-scan.mjs \
  --start-year=2026 --end-year=2016 --folder=sentitems \
  > .logs/lease-history-sentitems.log 2>&1 &

# Validation (small batch)
node scripts/process-closed-deal-backlog.mjs \
  --max-batches=1 --batch-size=10 --throttle-ms=500

# Full backfill
nohup node scripts/process-closed-deal-backlog.mjs \
  --batch-size=50 --throttle-ms=250 \
  > .logs/closed-deal-backlog.log 2>&1 &

# Renewal sweep (after backfill complete)
curl -s -X POST http://localhost:3000/api/lease/renewal-sweep \
  -H "x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN" | jq .

# Live cost monitor
# (paste SQL from Section 6 into psql or Supabase SQL editor)

# Resume after budget stop (re-run same command)
nohup node scripts/process-closed-deal-backlog.mjs \
  --batch-size=50 --throttle-ms=250 \
  >> .logs/closed-deal-backlog.log 2>&1 &
```
