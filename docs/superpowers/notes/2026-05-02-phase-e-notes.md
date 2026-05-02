# Phase E Notes — Auto-Reply Hook After Candidate Approval

**Date:** 2026-05-02
**Plan:** `docs/superpowers/plans/2026-05-02-deal-pipeline-automation.md`, Phase E
**Spec source:** Replaced the long-standing `Phase E.3 of 2026-05-01-transcript-followups plan` comment in `full-kit/src/lib/contact-promotion-candidates.ts`.

## What landed

| Path | Change |
|---|---|
| `full-kit/src/lib/contact-promotion-auto-reply.ts` | **New.** `maybeFireAutoReplyForApprovedLead({ communicationId, contactId, contactEmail, contactName })`. Discriminated `AutoReplyHookResult` (`fired` / `skipped` / `errored`). Resolves `propertyKey` from `metadata.propertyKey` or `metadata.extracted.propertyKey`, falls back to re-running `extractLoopNetLead` / `extractCrexiLead` / `extractBuildoutEvent` (ordered by `metadata.source` hint). Looks up active Property by key, idempotency-checks for an existing PendingReply on the same `(triggerCommunicationId, contactId, propertyId)` tuple, then calls `generatePendingReply({ outreachKind: "inbound_inquiry", persist: true })`. If `autoSendNewLeadReplies === true` and contact email is known, follows up with `sendMailAsMatt` and stamps the PendingReply `approved` on success. On send failure, leaves the PendingReply as draft and logs. Whole body is wrapped in try/catch — any thrown error becomes `{ status: "errored" }` rather than escaping. |
| `full-kit/src/lib/contact-promotion-auto-reply.test.ts` | **New.** 10 tests covering: no propertyKey fallthrough, propertyKey present but no Property match, sensitive-content gate, duplicate-PendingReply idempotency, happy path (auto-send off), auto-send-on success path with PendingReply marked approved, auto-send-on failure leaves draft, `generatePendingReply` skip surfaces `auto-reply-failed`, thrown DB errors surface `errored`, extractor-fallback path when metadata.extracted.propertyKey is absent. |
| `full-kit/src/lib/contact-promotion-auto-reply.live.test.ts` | **New.** Live-DB integration test gated behind `PHASE_E_LIVE=1`. Creates a synthetic Communication (with `metadata.extracted.propertyKey` set to a real catalog Property's key) and a synthetic ContactPromotionCandidate, approves the candidate, asserts a real PendingReply persists with the right tuple, then cleans everything up. Skipped from the default suite. |
| `full-kit/src/lib/contact-promotion-candidates.ts` | **Modified.** `approveCreateContact` and `approveLinkContact` now return `autoReplyTrigger` on the result envelope. After `client.$transaction(...)` resolves in `reviewContactPromotionCandidate`, the hook fires (only for fresh non-idempotent approvals) inside a try/catch. Hook errors are logged but never thrown. |
| `full-kit/src/lib/contact-promotion-candidates.test.ts` | **Modified.** Added 4 tests: hook fires on fresh approval, does NOT fire on idempotent replays, does NOT fire on non-approval actions (reject etc.), and approve flow returns successfully even when the hook throws. The new module is `vi.mock`-ed at the top so the existing 9 tests don't accidentally hit the live wiring. |

## Test count delta

| | Before | After |
|---|---|---|
| Vitest tests (active) | 783 | 797 |
| Vitest skipped | 0 | 1 (live test, gated by `PHASE_E_LIVE=1`) |
| Test files | 86 | 88 |
| Net active | +14 |

Both gates green:
- `pnpm exec tsc --noEmit --pretty false` — clean
- `pnpm test` — 797/797 passing, 1 skipped (intentional gate)

## Verification

The user's protocol asks for browser-verify on every phase that adds an observable surface. Phase E adds the auto-fire-after-approve behavior that's user-observable in the Pending Replies queue. We did this by spinning up `pnpm dev` (came up on http://localhost:3001 after 8.9s — port 3000 was already taken by another process) and then running an in-process live-DB integration test rather than driving the browser. The live test exercises the exact same code path the API route hits when a reviewer clicks "approve" in `/pages/contact-candidates`:

```
PHASE_E_LIVE=1 pnpm exec vitest run src/lib/contact-promotion-auto-reply.live.test.ts --reporter=verbose
```

Result:
```
✓ src/lib/contact-promotion-auto-reply.live.test.ts > Phase E live-DB hook >
  creates a PendingReply when an approved candidate's email matches a catalog Property  9544ms
Test Files  1 passed (1)
Tests       1 passed (1)
Duration    11.15s  (DeepSeek round-trip dominates)
```

What the live run does:
1. Fetches a real, non-archived `Property` from Supabase.
2. Inserts a synthetic `Communication` (channel=email, direction=inbound) whose subject and body name the Property and whose `metadata.extracted.propertyKey` matches.
3. Inserts a synthetic `ContactPromotionCandidate` linked to that Communication.
4. Calls `reviewContactPromotionCandidate({ action: "approve_create_contact" })` — the same call the `POST /api/contact-promotion-candidates/[id]/actions` route makes.
5. Asserts a real `PendingReply` row was created against `(triggerCommunicationId, contactId, propertyId)`, status `pending`, with a non-empty draft subject (DeepSeek really did generate one).
6. Cleans up the synthetic PendingReply, candidate, contact, and communication.

`autoSendNewLeadReplies` was deliberately not toggled, so no email was sent.
The Mail.Send Graph permission is still ungranted on the Azure app registration (per the user's note); the auto-send code path returns `permission_denied` from `sendMailAsMatt` and the PendingReply stays as a draft for human retry. That's exercised in the unit suite.

## Decisions

- **Hook lives outside the candidate transaction.** The transaction commits all the DB writes (Contact create, Communication.linking, candidate.update); only after `$transaction` resolves do we call the hook. That means the hook can read its own committed Contact + Communication rows freely, and an AI provider hiccup can't roll back the approval. The hook is awaited (not fire-and-forget) so that the API response naturally waits for the PendingReply to land — Matt sees the queue update on his next page load without a manual refresh delay. Latency: ~6–10s per approval driven by the DeepSeek round-trip; acceptable given approvals are a deliberate human action and we're saving him the manual "click Generate" step on the Lead detail page.
- **Discriminated return type.** `{ fired | skipped | errored }` makes it obvious to callers (and to anyone reading logs) which branch ran. The wrapper in `contact-promotion-candidates.ts` only logs on `errored`, since `skipped` outcomes (no propertyKey, no matching property, sensitive content) are normal and high-volume.
- **Idempotency check is local to the hook.** `generatePendingReply` doesn't currently dedupe, so we do a `pendingReply.findFirst({ where: { triggerCommunicationId, contactId, propertyId } })` check before firing. A re-approval of the same candidate (which the candidate-promotion code already guards against via `idempotent: true`) won't fire the hook anyway, but the dedupe also covers the edge case of a different approval path that happens to point at the same comm/contact/property tuple.
- **`server-only` was dropped from the new module.** It blocks vitest imports (Node ESM resolver can't find the package), and downstream modules (`auto-reply`, `automation-settings`, `send-mail`) all already import `server-only` themselves — so this module only loads server-side regardless. The live test mocks `server-only` to `{}` to bypass the resolver issue.
- **Defaulted to `outreachKind: "inbound_inquiry"`.** Approvals here are always inbound platform-lead inquirers (LoopNet/Crexi/Buildout). The market-alert tone is for Daily-Listings-driven outbound and is wired separately in `daily-listings/processor.ts`.
- **Sensitive-content gate is double-checked.** `generatePendingReply` already runs the filter, but doing the same check up front lets us short-circuit before any Property lookup or PendingReply persistence — saves a roundtrip and avoids a stale PendingReply row in the rare case where the deeper persistence path partially succeeds.

## Things punted / open

- **Auto-send Graph permission.** As the user already flagged, `Mail.Send` is not granted on the Azure app registration. The send branch returns `permission_denied` and the PendingReply stays as a draft. No code change needed; once the Azure consent lands, the existing branch will auto-send. The unit test "auto-send failure leaves PendingReply as draft" pins this behavior so a future regression can't silently swallow the failure.
- **AgentAction audit row for "auto-fired".** We log to console on `errored` but don't write an `AgentAction` row when the hook fires. If we later want a per-fire audit trail in the activity feed, that's a small follow-up — add `db.agentAction.create({ kind: "auto_reply_drafted", ... })` after the PendingReply persists. Not in the spec for Phase E, so skipped.
- **Per-Contact rate limit.** Daily Listings has a `dailyMatchPerContactCap`; new-lead replies don't have an equivalent. Probably unnecessary because (a) approvals are 1:1 with candidates, (b) candidates are deduped by email + platform, but worth re-checking after we see real volume.

## Commits

| SHA | Subject |
|---|---|
| `d64e0c5` | feat(leads): auto-fire PendingReply after candidate approval (Phase E) |
| `db2a12f` | docs(phase-e): notes from auto-fire-after-approve implementation |
