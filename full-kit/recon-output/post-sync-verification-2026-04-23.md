# Post-Email-Ingestion-Sync Verification — 2026-04-23

Manual verification after Tasks 12–17 of the email ingestion plan shipped. Sync ran against Matt's live mailbox via `POST /api/integrations/msgraph/emails/sync` in dev.

## Runs executed

| Run | Params | Duration | isBootstrap | cursorAdvanced | inserted |
|---|---|---|---|---|---|
| 7-day smoke | `?daysBack=7` | 253s | true (no-cursor) | true | 200 |
| Idempotency | (no params) | 5s | false | true | 2 |
| 90-day bootstrap | `?daysBack=90&forceBootstrap=true` | 152s | true (forced) | true | 0 (all duplicates) |

## Totals ingested

- **202 communications** (102 inbound, 100 outbound)
- **0 failed rows** in `external_sync`
- **0 leads created** (no crexi/loopnet/buildout leads landed in the sampled window)

## Classification breakdown

| Classification | Count |
|---|---|
| signal | 118 |
| noise | 46 |
| uncertain | 38 |

Signal = 118 decomposes as:
- `matt-outbound` — 100 (all outbound, by definition signal)
- `nai-internal` — 18 (Layer A internal domain hit)

Noise = 46 decomposes as:
- `layer-b-unsubscribe-header` — 25
- `layer-b-domain-drop` — 13
- `layer-b-sender-drop` — 6
- `layer-b-local-part-drop` — 2

Uncertain = 38 all tagged `layer-c` (fallback).

## Leads

`contacts` filter `created_by LIKE 'msgraph-email-%-extract'` → **0 rows**.
`communications` where `metadata->>'source' = 'crexi-lead'` → **0 rows**.
Unanswered crexi leads query → 0.

No Crexi / LoopNet / Buildout platform emails hit the inbox in the window actually scanned. Cannot validate the Focused/Other leak hypothesis without real platform leads in the data set.

## Concerns flagged for follow-up

### 1. Advisory lock not released under Supabase pgbouncer transaction pooling

After the 7-day bootstrap completed, the 90-day bootstrap returned `skippedLocked: true` in 352ms — the `msgraph-email` advisory lock was still held on a backend connection.

**Root cause:** `DATABASE_URL` points at Supabase pgbouncer on port 6543 with `pgbouncer=true` (transaction pooling). `pg_try_advisory_lock` takes a **session-scoped** lock. Each Prisma `$queryRaw` runs in its own transaction, and pgbouncer hands out a different backend connection per transaction. The `SELECT pg_try_advisory_lock(...)` acquires the lock on backend A; the later `SELECT pg_advisory_unlock(...)` runs on backend B and silently no-ops. The lock stays held on A until its session ends (pgbouncer holds backends for minutes).

**Impact:** Any cron invocation or manual re-trigger within the pgbouncer backend idle window after a successful sync will spuriously return `skippedLocked: true`. This silently skips work.

**Workaround used:** Wrote [full-kit/scripts/clear-advisory-lock.mjs](full-kit/scripts/clear-advisory-lock.mjs) which connects via `DIRECT_URL` (port 5432, no pgbouncer) and `pg_terminate_backend`s any pid holding the `hashtext('msgraph-email')` advisory lock.

**Proper fix options:**
1. Run the lock/unlock queries via a dedicated `PrismaClient` configured with `DIRECT_URL`, so they share a single backend.
2. Switch to `pg_advisory_xact_lock` scoped to a single transaction — but the sync is not a single transaction.
3. Use Postgres `SELECT pg_try_advisory_xact_lock(...)` at the start of each `$transaction` in `processOneMessage`/`persistMessage` — but coarser coordination across the whole sync run is lost.
4. Replace the advisory lock with a row-based lock in `external_sync` (explicit `updated_at` sentinel row + `FOR UPDATE NOWAIT`).

Option 1 is the cleanest and most targeted.

### 2. Delta endpoint returned exactly 100 messages per folder for both 7-day and 90-day windows

The 7-day smoke processed 100 inbox + 100 sent. The 90-day bootstrap (with `forceBootstrap=true` — cursors cleared) processed another 100 inbox + 100 sent — **all of which already existed from the 7-day smoke** (0 inserted). This means Graph returned the same ~100-message slice for both windows.

The `fetchEmailDelta` generator in [full-kit/src/lib/msgraph/emails.ts:128](full-kit/src/lib/msgraph/emails.ts:128) correctly loops on `@odata.nextLink` until only `@odata.deltaLink` is present. So Graph itself is returning a deltaLink after one page.

**Hypothesis A (real data):** Matt's mailbox really does have only ~100 messages per folder in the last 90 days that match `receivedDateTime ge sinceIso`. Unlikely for an active CRE broker — contradicts the spec's "low tens of thousands" estimate and Matt's workflow memory.

**Hypothesis B (Graph delta + filter interaction):** Microsoft Graph's `/mailFolders/{folder}/messages/delta` may behave unexpectedly when combined with `$filter=receivedDateTime ge ...` and `$top=100`. Possible explanations:
- Delta may return a deltaLink after the first page if the filter matches more than N items and Graph deems the remainder "state not yet synced" — to be paged on the next delta call via the deltaLink.
- There may be an undocumented cap on delta results per call when a filter is applied.

**Next investigation:** Call the endpoint a second time with the stored cursor (no `forceBootstrap`) and verify it continues fetching remaining messages. If so, the delta semantics are working as Microsoft intends and the orchestrator needs to loop until an empty page is returned. If not, probe the Graph API directly (without delta, with `$count=true`) to confirm the true message count in the window.

**Impact:** Until resolved, the module will only ingest ~100 messages per folder per invocation rather than the full 90-day window in one bootstrap. A cron that runs the sync every N minutes would eventually catch up, but the initial bootstrap does not deliver the full history the spec expected.

## Sign-off

Architecture works end-to-end: auth → delta fetch → sender normalize → three-layer classify → extractor dispatch (no lead hits in window) → per-message transactional persist → cursor advance. Zero runtime errors, zero failed rows, idempotency verified. Two issues above are the concrete follow-ups before a cron handoff.
