# Phase F Notes — Daily Listings Autonomous Cron

**Date:** 2026-05-02
**Plan:** `docs/superpowers/plans/2026-05-02-deal-pipeline-automation.md`, Phase F

## What landed

| Path | Change |
|---|---|
| `full-kit/src/lib/system-state/last-daily-listings-sweep.ts` | **New.** `getLastDailyListingsSweep()` / `setLastDailyListingsSweep(summary)` against `SystemState` row keyed `app.last_daily_listings_sweep`. Stores `{ ranAt, candidates, processed, listingsParsed, draftsCreated, draftsSent, errors }`. Mirrors the shape of `automation-settings.ts` exactly. |
| `full-kit/src/lib/system-state/last-daily-listings-sweep.test.ts` | **New.** 6 tests: missing row → null, malformed value → null, missing `ranAt` → null, partial value → numeric fields default to 0, happy-path round trip, upsert call shape. |
| `full-kit/src/app/api/cron/daily-listings/route.ts` | **New.** GET-only endpoint for Vercel cron. Auth: `Authorization: Bearer <DAILY_LISTINGS_CRON_SECRET>` via `constantTimeCompare`. Calls `processUnprocessedDailyListings({ lookbackDays: 1 })`, summarizes the result, persists last-run state, returns `{ ok: true, ranAt, candidates, processed, listingsParsed, draftsCreated, draftsSent, errors }`. 503 when env var unset, 401 on bad/missing bearer, 500 if processor throws (last-run NOT advanced in that branch — observability stays accurate). Last-run persistence failure logs but does not poison the response (it's observability, not correctness). |
| `full-kit/src/app/api/cron/daily-listings/route.test.ts` | **New.** 6 tests: missing auth 401, wrong bearer 401, env unset 503, valid bearer happy path 200 with summary + persistence call, processor throw 500 with no persistence, empty env var 503. |
| `full-kit/src/app/[lang]/(dashboard-layout)/pages/account/settings/automation/page.tsx` | **Modified.** Now fetches both `getAutomationSettings()` and `getLastDailyListingsSweep()` in parallel. New `LastDailyListingsSweepLine` component renders a small bordered line under the page header: relative time (`date-fns.formatDistanceToNow`) + counts + ISO tooltip on hover. "Never run" copy when no row exists. |
| `full-kit/vercel.json` | **New.** `crons: [{ path: "/api/cron/daily-listings", schedule: "0 15 * * *" }]`. Lives at `full-kit/vercel.json` (not the repo root) because the Next.js app deploys from `full-kit/`. |
| `full-kit/.env.local` | **Modified locally only.** Added `DAILY_LISTINGS_CRON_SECRET=phase-f-local-test-secret-2026-05-02` for local browser-verify. Not committed. |

## Why a separate cron route instead of adding GET to `/api/daily-listings/process`

The existing POST endpoint uses `requireApiUser` + `validateJsonMutationRequest` (cookie + same-origin). Cron requests have neither. Two clean paths exist:

1. Add a GET handler to `/api/daily-listings/process` with separate cron auth.
2. New route at `/api/cron/daily-listings`.

Picked **option 2** to keep the existing POST user-mutation-shaped (cookie, JSON body) and the cron route cron-shaped (GET, bearer, no body). The processor itself (`processUnprocessedDailyListings`) is shared — both paths call it. Mirrors the `scrub` pattern (separate routes for admin vs cron via `authorizeScrubRequest`), but with a dedicated env var (`DAILY_LISTINGS_CRON_SECRET`) so rotating one secret doesn't invalidate the other.

## Cron schedule decision

`0 15 * * *` (15:00 UTC daily).

- **Summer (DST, March → November):** 15:00 UTC = 09:00 MDT — the requested 9am Mountain Time.
- **Winter (standard, November → March):** 15:00 UTC = 08:00 MST — fires one hour earlier than spec.

Vercel cron does not support timezone-aware schedules; only UTC. Two options:

1. Pin to MDT year-round (15:00 UTC) — fires at 8am during winter.
2. Pin to MST year-round (16:00 UTC) — fires at 10am during summer.

Picked **option 1**. Daily Listings emails from Crexi/LoopNet typically land overnight; firing at 8am winter local is still well-aligned with Matt's "first thing in the morning" workflow. Bumping to 10am during summer (option 2) felt later than what Matt asked for.

If we ever need true 9am-Mountain-year-round, we can ship two cron entries (Mar–Nov and Nov–Mar pins) with overlapping windows, or move the cron under an external scheduler (cron-job.org) that supports timezones. Not worth the complexity right now.

## Env var name

`DAILY_LISTINGS_CRON_SECRET`

For Matt to set in:
- `full-kit/.env.local` (locally, for testing the route via curl)
- Vercel project env settings (production), once he deploys.

Vercel does **not** auto-inject `Authorization: Bearer <CRON_SECRET>` to crons unless you use the literal env var `CRON_SECRET`. We chose a project-specific name to avoid collision with the existing `SCRUB_CRON_SECRET` (different rotation cadences likely) and to make the intent explicit. Per Vercel cron docs, the platform will inject `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in project env. To use our route, set `DAILY_LISTINGS_CRON_SECRET=<value>` AND set `CRON_SECRET=<same-value>` in Vercel env. (Or rename our env var to `CRON_SECRET` if Matt prefers; the route auth is symmetric on string compare.)

Documenting this in the deploy checklist when hosting comes up.

## Test count delta

| | Before | After |
|---|---|---|
| Vitest tests (active) | 797 | 809 |
| Vitest skipped | 1 | 1 |
| Test files | 88 | 90 |
| Net active | +12 |

Both gates green:
- `pnpm exec tsc --noEmit --pretty false` — clean
- `pnpm test` — 809/809 passing, 1 skipped (Phase E live-DB test, unchanged)

## Browser-verify

Server: `next-dev` on port 3000 (reused from prior session).

1. **Missing auth → 401.**
   ```js
   await fetch('/api/cron/daily-listings', { method: 'GET' })
   // status: 401
   ```

2. **Wrong bearer → 401.**
   ```js
   await fetch('/api/cron/daily-listings', { method: 'GET',
     headers: { Authorization: 'Bearer wrong-token' } })
   // status: 401
   ```

3. **Valid bearer → 200 with summary.**
   ```js
   await fetch('/api/cron/daily-listings', { method: 'GET',
     headers: { Authorization: 'Bearer phase-f-local-test-secret-2026-05-02' } })
   // status: 200, body: {
   //   ok: true,
   //   ranAt: "2026-05-02T13:30:21.627Z",
   //   candidates: 0, processed: 0,
   //   listingsParsed: 0, draftsCreated: 0, draftsSent: 0, errors: 0
   // }
   ```
   No unprocessed Daily Listings emails in the last 24h on the live DB right now — counts are zero, but the path is end-to-end exercised including the `setLastDailyListingsSweep` write.

4. **Settings page renders the new line.**
   Navigated to `http://localhost:3000/en/pages/account/settings/automation`. The DOM-extracted text:
   > "Last Daily Listings sweep: less than a minute ago · 0/0 emails processed · 0 listings parsed · 0 drafts created · 0 sent · 0 errors"
   With `title="2026-05-02T13:30:21.627Z"` for ISO hover.

5. **Re-firing the route advances `ranAt`** — confirming the SystemState upsert works against live Postgres.

Screenshot of settings page with the new line: not saved to disk; the line is captured in the DOM-extract above and the screenshot was reviewed inline during the verify pass.

## Decisions

- **GET, not POST, for the cron route.** Vercel cron always issues GET. Documented in the Vercel cron docs page on the deploy checklist when we get there.
- **503 when env var unset, not 401.** Distinguishes "you forgot to configure this in Vercel" from "you're not authorized." The cron monitoring dashboard surfaces both as failures, but the response body in 503 makes the misconfiguration obvious to a human looking at the log.
- **`lookbackDays: 1` is hardcoded.** Spec calls for it. Manual sweeps (the existing POST route) accept any value 1–90; the cron is opinionated.
- **Last-run persistence isolated from response shape.** The route returns the full summary on success. The SystemState row is observability for the Settings page. Failure to write the row logs but doesn't fail the response. Failure to read the row in the page renders "never run" — the page never crashes due to a missing or malformed row.
- **No new Prisma migration.** Reuses the existing `system_state` Json table.
- **No AI calls added.** Phase F is plumbing only.

## Things punted / open

- **`CRON_SECRET` injection.** Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically only when the env var is exactly named `CRON_SECRET`. Our route reads `DAILY_LISTINGS_CRON_SECRET`. When Matt deploys, he should either (a) set both env vars to the same value, or (b) rename our env var to `CRON_SECRET`. Documented in this notes file. Not exercised end-to-end because hosting is out of scope this batch.
- **No cron-fired-end-to-end test.** Per spec: "you do NOT need to actually verify the cron firing — just verify the endpoint accepts a cron-originated request locally." Done via the curl-equivalent above.
- **Schedule overshoot in winter.** As above — 8am MST instead of 9am during the ~4-month winter window. Acceptable given Matt's morning workflow.
- **No retry / backoff.** A processor throw returns 500. Vercel cron will not retry. If we see real-world flakes, add a small in-route retry loop (3 attempts, exponential backoff). Not warranted yet.
- **No alarm if ranAt drifts.** If the cron stops firing for a week, nothing alerts us. The Settings page line will go stale ("7 days ago"). A future enhancement: a dashboard widget that flips red when `ranAt > 36h ago`. Out of Phase F scope.

## Commits

| SHA | Subject |
|---|---|
| `18fca3e` | feat(cron): daily-listings autonomous sweep (Phase F) |
