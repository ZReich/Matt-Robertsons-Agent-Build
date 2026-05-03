# Deal-Pipeline Automation Implementation Plan

**Source:** Continuation of the 2026-04-29 deal-pipeline plan (Phases 8-10 unfinished) plus deferred items from the 2026-05-01 transcript-followups plan. Captured 2026-05-02.

**Goal:** Close the loop on autonomous deal-stage movement so AI-detected events from email actually push deals through the pipeline without manual queuing — while keeping the slick per-lead approval card UX Matt liked.

**Tech stack:** Next.js 15 / TypeScript / Prisma 5 / Postgres (Supabase) / DeepSeek (existing OpenAI-compatible provider) / Microsoft Graph (read working, write blocked on Azure permission grant) / Vitest / pnpm.

---

## Decisions baked in (from prior sessions, do not reopen)

- **DeepSeek** is the model for cost-driver paths. Don't introduce direct Anthropic calls.
- **Per-lead AI Suggestions card stays** — the user explicitly likes the approve/snooze/reject UX on the lead detail page. Do NOT auto-execute `create-todo`, `mark-todo-done`, or `create-agent-memory` at scrub time.
- **Auto-execution at scrub time only happens for `move-deal-stage`** when the AI's confidence + the email signal class crosses an explicit threshold (Phase B).
- **Sensitive-content filter (financial keywords)** runs first, every time.
- **Mail.Send permission** is blocked on IT granting `Mail.Send` (Application) on the Azure app registration plus admin consent. No engineering work needed in this plan; just don't depend on send working.
- **Hosting** is out of scope.

---

## Phase ordering

```
Phase A (Phase 7 audit) — ~30 min, prerequisite-free
   │
   ├─→ Phase B (Buildout deal-stage parser) ← highest leverage
   │      │
   │      └─→ Phase B-cron (Vercel cron + sweep endpoint, 15 min)
   │
   ├─→ Phase C (Contact role lifecycle) — independent, 1 hr
   │
   └─→ Phase D (Buyer-rep detection) — independent but largest, 3-4 hr
          │
          └─→ Phase D-cron

Phase E (lead → property auto-creation hook) — small, parallel-safe
Phase F (Daily Listings cron) — small, depends on Mail.Send not at all
```

---

## Phase A — Phase 7 audit (sanity check what already landed)

**Why:** `src/lib/ai/agent-actions-deal.ts` exists and is wired into `approveAgentAction`'s switch. 306 pending `create-deal` rows sit in the DB. We have no end-to-end confirmation that clicking Approve on one actually creates a Deal correctly. Before building more on top of these handlers, verify them.

### Tasks

**A.1.** Pick one pending `move-deal-stage` action (or synthesize one for a known Deal id). Use the API — `POST /api/agent/actions/{id}/approve` — and confirm:
- HTTP 200, response includes `{ status: "executed" }`.
- The Deal row's `stage` actually updated.
- The Deal row's `stageChangedAt` got stamped.
- The AgentAction row's `status` flipped to `executed`.
- If the AI proposed `fromStage` doesn't match the deal's current stage, the call returns 409 (concurrency guard).

**A.2.** Same for `update-deal` (patches value/closingDate/probability) and `create-deal` (creates a buyer-rep Deal).

**A.3.** Pick 3 of the existing 306 pending `create-deal` rows. Eyeball the payloads. If any are clearly wrong (e.g. duplicate of an existing Deal, malformed property reference), document the failure modes — they're hints for Phase D's prompt-engineering.

**A.4.** Document findings in `docs/superpowers/notes/2026-05-02-phase-7-audit.md`.

**Acceptance:** Audit doc exists; the three handler types each demonstrate a clean approve→execute round trip on real DB rows.

---

## Phase B — Buildout deal-stage email parser

**Why:** Buildout sends deterministic "Deal stage updated" emails when Matt or his team progresses a deal in the Buildout UI. Today the system ingests these emails but does nothing with them. Parsing them deterministically (no AI cost, no AI hallucination risk) → produces `move-deal-stage` AgentActions → the existing approve flow lets Matt confirm or override the move.

The transcript ask ("LOI mentioned in an email and the deal moves automatically") is partly served by this. The richer signal-detection (LOI mentions in arbitrary emails) is the AI scrub's job and already happens; this phase just adds the high-confidence Buildout deterministic path.

### Files

- Create: `src/lib/buildout/deal-stage-parser.ts` + `.test.ts`
- Create: `src/lib/buildout/deal-stage-classifier.ts` (sender + subject filter)
- Create: `src/lib/buildout/deal-stage-processor.ts` (per-email orchestrator)
- Create: `src/app/api/buildout/process-stage-updates/route.ts`
- Modify: `src/lib/msgraph/email-classifier.ts` (or whatever sets `kind` on Communication.metadata) to flag these emails

### B.1. Get a sample of Buildout deal-stage emails

```bash
set -a && source .env.local && set +a
node -e "/* query db.communication where subject contains 'Deal stage updated' or sender is buildout's no-reply, take 5, dump bodies */"
```

Inspect the bodies. Confirm the format. Document fields available:
- Property name / address
- Old stage → new stage
- Who moved it (which user inside Buildout)
- Timestamp

### B.2. Parser (pure function)

`parseBuildoutDealStageEmail(input: { subject, body }): { propertyName, propertyAddress, propertyKey, fromStage, toStage, movedBy, movedAt } | null`

Use the existing `normalizeBuildoutProperty` from `src/lib/buildout/property-normalizer.ts` for `propertyKey`. Map Buildout's stage names → our `DealStage` enum.

Tests: 6 minimum — happy path, each stage transition, malformed body, empty body, non-Buildout email passed in.

### B.3. Classifier

Subject check + sender check (Buildout's no-reply address — find it from the corpus). Returns boolean.

### B.4. Processor

Per Communication:
1. Run sensitive-content filter; bail if tripped.
2. Run classifier; bail if not a deal-stage update.
3. Run parser; bail if returns null.
4. Look up Deal by propertyKey + dealType=seller_rep (matching the existing partial unique index).
5. If no Deal exists, log and skip (Phase 5 of the prior plan — lead-derived Deal creation — handles that path).
6. If Deal's current stage != parsed `fromStage`, log the divergence and skip (someone moved it manually; AI shouldn't override).
7. Create AgentAction:
   - actionType: "move-deal-stage"
   - tier: "auto" (deterministic parser, high confidence — auto-execute)
   - status: "executed"
   - payload: `{ dealId, fromStage, toStage, reason: "Buildout deal-stage update" }`
   - Then call the deal stage update directly inside the same tx (mirroring how `moveDealStageFromAction` works).
8. Stamp `comm.metadata.buildoutStageUpdate = { processedAt, dealId, oldStage, newStage }` so re-runs are idempotent.

### B.5. Sweep endpoint

`POST /api/buildout/process-stage-updates` with body `{ communicationId? | sweep: true, lookbackDays? }` — analogous to the Daily Listings sweep endpoint.

### B.6. Cron (deferred until Phase B passes manual verify)

Add a Vercel cron entry (or document where to wire it) to run `{ sweep: true, lookbackDays: 1 }` every 15 minutes. Don't ship this until at least 5 Buildout emails have been processed manually and the moves were correct.

**Acceptance:** Manual sweep on 5+ historical Buildout deal-stage emails moves their linked Deals through the correct stages. No spurious moves. Idempotent re-runs are no-ops.

---

## Phase C — Contact role lifecycle

**Why:** When a Deal closes, the linked Contact's `clientType` should transition (`active_listing_client` → `past_listing_client`, `active_buyer_client` → `past_buyer_client`, etc.). Currently `clientType` is set on initial promotion and never updates. Matt's transcript: he wants Christmas-mailer-style re-engagement of past clients to actually surface the right cohort.

### Files

- Create: `src/lib/contacts/role-lifecycle.ts` (pure: `nextClientType(deal, contact)` → ClientType | null)
- Create: `src/lib/contacts/role-lifecycle.test.ts`
- Modify: `src/lib/ai/agent-actions-deal.ts` to call `applyRoleLifecycle(tx, contactId)` after a stage change to `closed`
- Add a small one-shot script: scan all Deals with `stage = closed` and `closedAt` populated, ensure the linked Contact's clientType reflects past-client status

### Acceptance

- 100% test coverage on the transition table
- One-shot backfill report shows N contacts updated to past_*_client
- New deal closures drive the lifecycle update without manual intervention

---

## Phase D — Buyer-rep deal detection (Phase 10 of prior plan)

**Why:** Buildout, Crexi, LoopNet only track Matt's listing-side deals. Buyer-rep work (Matt finding property FOR a client) lives entirely in email and isn't tracked anywhere. Detect signals from outbound emails to auto-create `buyer_rep` Deals.

### Detection signals (from transcript + 2026-04-29 plan)

1. **Tour scheduling** — outbound email containing "tour", "showing", "walkthrough", "site visit" + a date phrase, recipient is a known broker/lister.
2. **LOI / offer drafting** — outbound email referencing "LOI", "letter of intent", "offer", with an attachment whose filename matches an LOI pattern.
3. **NDA exchange** — outbound email with NDA in subject/body, recipient is an external broker.
4. **Tenant-rep search activation** — outbound email saying "looking for", "in the market for", "exploring options" addressed to a broker contact.

### Files

- Create: `src/lib/ai/buyer-rep-detector.ts` (pure scoring per signal)
- Create: `src/lib/ai/buyer-rep-detector.test.ts`
- Create: `src/lib/ai/buyer-rep-processor.ts` (per outbound Communication → AgentAction `create-deal` with `dealType: "buyer_rep"`)
- Modify: scrub-applier or a separate cron-driven sweep to run the processor

### Confidence tiers

- High confidence (LOI attached + recipient is external broker): tier="auto", auto-execute.
- Medium confidence (tour scheduling): tier="approve" — surface in Agent Control Center.
- Low confidence (vague "in the market"): tier="log_only" — no action created, just log to a future-review table.

### Acceptance

- Tests cover at least 8 signal patterns
- Sweep on existing outbound corpus produces a sane number of buyer-rep Deals (estimate: 5-20 — Matt's mentioned 5 active Kalispell hunts on the call)
- The Deals page Kanban shows buyer-rep Deals separately from seller-rep (filter chip)

---

## Phase E — Lead → Property auto-creation hook

**Why:** Documented but not wired in `src/lib/contact-promotion-candidates.ts` (the `Phase E.3 of 2026-05-01-transcript-followups plan` comment). When a candidate is approved into a Lead, if the inbound email's `propertyKey` matches a Property in the catalog, fire `generatePendingReply`. If `autoSendNewLeadReplies` is true in automation settings, send immediately.

### Tasks

E.1. Implement the autonomous fire after the contact-promotion transaction commits.

E.2. Resolve `propertyKey` from the Communication's metadata or by re-running the existing extractors against subject + body.

E.3. Look up Property by `propertyKey`. If not found, fall back to the existing manual-button flow (no change).

E.4. If found AND `autoSendNewLeadReplies === true`: call `sendMailAsMatt` directly. Otherwise persist a PendingReply for review.

E.5. Wrap in try/catch — failures here MUST NOT block the candidate-approval response.

**Acceptance:** Manual test: approve a candidate whose inbound email mentions a catalog property → a PendingReply appears within seconds, OR the email goes out via Graph if the toggle is on.

---

## Phase F — Daily Listings autonomous cron

**Why:** Today the Daily Listings sweep runs only when someone clicks the button. Matt wants it daily.

### Tasks

F.1. Create `vercel.json` (or extend if one exists) with a cron entry hitting `POST /api/daily-listings/process` with `{ sweep: true, lookbackDays: 1 }` at 9am Mountain Time daily.

F.2. The endpoint already exists — just verify it accepts cron-originated requests (likely needs a CRON_SECRET header check OR the endpoint already works via cookie-less internal calls; verify).

F.3. Add a "last-run" timestamp surfaced on the Pending Replies page or Settings/Automation page so Matt can see "Last Daily Listings sweep: today at 9:02am, 6 listings parsed, 2 drafts created."

**Acceptance:** Cron fires at 9am next morning; first run produces drafts in the queue.

---

## Out-of-scope this batch (waiting on external blockers)

- **Mail.Send permission** — IT must grant `Mail.Send` Application permission + admin consent on the Azure app registration. Until then, the Send button on Pending Replies returns 503. Phase E's auto-send branch is gated by this. No engineering work needed here.
- **Hosting** — still localhost. Vercel deploy decision pending.
- **Plaud / SMS / phone-log unification** — separate project track.
- **Reply-style fine-tuning corpus** — depends on outbound volume; deferred.
- **Deep people enrichment** — vendor + cost decision pending.
- **NDA gating on auto-reply** — template authoring decision deferred.

---

## Conventions

- Tests: vitest. `pnpm test` runs all. New parser tests live next to the source file (`foo.ts` → `foo.test.ts`).
- Schema changes: edit `prisma/schema.prisma`, generate SQL via `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel prisma/schema.prisma --shadow-database-url $SHADOW_DATABASE_URL --script`, save to `prisma/migrations/YYYYMMDDhhmmss_name/migration.sql`, apply with `prisma db execute`, register with `prisma migrate resolve --applied`.
- After every meaningful chunk: `pnpm exec tsc --noEmit --pretty false` clean and `pnpm test` clean before moving to the next phase.
- After each phase: browser-verify with the preview tools, NOT just API calls.
- Commit per phase with conventional-commit style: `feat(scope): summary`.

---

## Recommended execution order

1. **Phase A** — 30 min, derisks everything downstream
2. **Phase B** (parser + processor + manual sweep test) — 2-3 hr — biggest leverage
3. **Phase E** — 30-45 min — closes the autonomous-lead-reply loop (gated by Mail.Send)
4. **Phase F** — 30 min — Daily Listings cron
5. **Phase C** — 1 hr — Contact role lifecycle
6. **Phase D** — 3-4 hr — buyer-rep detection (largest)
7. **Phase B-cron** — final 15 min after Phase B has been manually verified for a week

Total expected effort: ~10-12 focused hours.
