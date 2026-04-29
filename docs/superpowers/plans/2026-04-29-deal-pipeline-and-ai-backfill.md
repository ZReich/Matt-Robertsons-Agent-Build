# Deal Pipeline + AI Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing-but-hollow Deal entity end-to-end so platform leads (Crexi/LoopNet/Buildout) auto-create listing-side Deals, email signals (tours, LOIs) auto-create buyer-rep Deals, AI scrub output is actionable, Contact role lifecycle reflects deal state, and the existing 22K-email corpus is re-classified and AI-scrubbed against the corrected pipeline.

**Architecture:** Three independent flows converge on a unified Deal model. (1) Lead-derived: existing Crexi/LoopNet/Buildout email parsers gain address extraction; a normalized `propertyKey` becomes the join key that auto-creates or links a `dealType="seller_rep"` Deal on every inbound platform lead. (2) Email-signal-derived: tour-scheduling and LOI-drafting outbound emails create `dealType="buyer_rep"` Deals at 70-85% precision. (3) Stage updates: Buildout "Deal stage updated" emails parse cleanly into `move-deal-stage` AgentActions. The AI scrub backfill is gated behind a re-classification pass (existing 22K rows have stale classifications from earlier classifier code) and a Claude-Code-subscription validation harness that lets us verify quality on 50-100 emails at $0 before committing to bulk API spend.

**Tech Stack:** Next.js 15 / TypeScript / Prisma 5.20 / Postgres (Supabase) / Anthropic SDK (Claude Haiku 4.5 for scrub) / Vitest test runner / pnpm.

---

## Background context (for cold-start subagents)

This is the executive-assistant CRM for Matt Robertson, a CRE broker at NAI Business Properties (Billings, Montana). Today's date: 2026-04-29.

**Current state of the system:**
- 22,597 communications in DB, all email, ingested 2026-04-23/24 as a one-shot 90-day historical backfill (live ingestion is not yet running)
- Email scrub pipeline exists at `full-kit/src/lib/ai/scrub-*.ts` and is functional but untested at scale
- 67 Leads exist (Contacts with `leadStatus` populated), sourced from Crexi/LoopNet/Buildout email parsers
- **0 Deal rows.** The Deal model exists in schema but nothing creates Deals
- **0 Communications have `dealId` populated.** Email-to-deal linkage is unwired
- The AI scrub action vocabulary includes `move-deal-stage`, `update-deal`, `create-meeting`, `update-meeting` — but only `create-todo` and `mark-todo-done` are actually executed at approval time. Everything else is rejected with "unsupported action type" at `src/lib/ai/agent-actions.ts:75-84`
- The AI scrub heuristic linker at `src/lib/ai/scrub-linker.ts:82-86` loads ALL deals (including closed) and passes only `{id, propertyAddress}` to the AI — stage is invisible to the model
- Existing email extractors at `src/lib/msgraph/email-extractors.ts` extract `propertyName` only; the address is in the body but not parsed
- Classifier code (`src/lib/msgraph/email-filter*.ts`) has been edited 6+ times since the 22K rows were classified on 2026-04-23/24, with no version stamp on rows. Re-classification is needed before AI scrub backfill

**Key conceptual model (read this carefully):**
- **Listing-side deal**: Matt represents the seller/landlord. Source-of-truth = Buildout, plus syndication on Crexi/LoopNet. Every lead from any of those platforms is by definition a lead on a property Matt is listing.
- **Buyer-rep deal**: Matt represents the buyer/tenant hunting for property. No platform tracks these; they live entirely in email. Detected from tour-scheduling + LOI-drafting signals (~80% precision).
- **Lead** (existing feature): Contact with `leadStatus` populated, auto-created from platform-inquiry emails. A Lead is the *inquirer relationship*. The Deal is the *property listing relationship*. Many Leads → one Deal (one property, many people inquiring).

**The address-as-join-key insight (Matt's correction):**
Buildout sends NO email when a listing is created. We initially thought this required Buildout API integration. But every Crexi/LoopNet/Buildout LEAD email contains the property address in the body in structured form, just not currently extracted. Since platforms only send leads on properties Matt is listing, the address IS proof a listing-side Deal exists. Extracting + normalizing the address gives us a join key that auto-creates Deals on first inquiry — no Buildout API needed for Phase 1.

**Address formats observed in the corpus:**
- Buildout: `Listing Address 303 North Broadway, Billings, MT 59101` (~90% of cases real address; ~10% substitute property name like `Rockets | Gourmet Wraps & Sodas, Billings, MT`)
- Crexi: `Regarding listing at 13 Colorado Ave, Laurel, Yellowstone County, MT 59044` (always has county)
- LoopNet leads: `303 N Broadway | Billings, MT 59101` (pipe-separated)
- LoopNet "favorited" emails: address only in subject (`Alex Wright favorited 303 N Broadway`)

Same property across platforms varies: `N` ↔ `North`, `St` ↔ `Street`, `|` ↔ `,`, county presence. Standard CRE normalization (lowercase + strip punctuation + expand directionals + expand street types + strip county) collapses them reliably.

---

## Phase ordering and parallelization map

```
Phase 1 (schema migration) — FOUNDATIONAL, blocks 4–10
   │
   ├─→ Phase 2 (re-classify 22K rows) ─── independent, parallel-safe with 3
   │
   ├─→ Phase 3 (address normalize utility) ─── parallel-safe with 2, 7
   │      │
   │      └─→ Phase 4 (extractor parsers) → Phase 5 (lead→deal hook) → Phase 6 (backfill)
   │
   ├─→ Phase 7 (AgentAction handlers) ─── parallel-safe with 3, 4
   │      │
   │      ├─→ Phase 8 (Buildout deal-stage parser)
   │      ├─→ Phase 9 (contact role lifecycle)
   │      └─→ Phase 10 (buyer-rep detection)
   │
   └─→ Phase 11 (Claude-Code subscription harness) ─── independent, parallel-safe
          │
          └─→ Phase 12 (validation sample) → Phase 13 (bulk backfill) → Phase 14 (forward cron)
```

**Subagent dispatch strategy:**
- After Phase 1 lands, dispatch Phases 2, 3, 7, 11 as four parallel subagents
- After Phase 3 lands, dispatch Phase 4
- After Phase 4 lands, dispatch Phase 5; Phase 6 is sequential after 5
- After Phase 7 lands, dispatch Phases 8, 9, 10 as three parallel subagents
- After all of 1-10 land, dispatch Phase 12 (single sample run); 13 and 14 are sequential

---

## Conventions used throughout this plan

- **Test runner:** vitest. Run individual tests with `pnpm test path/to/file.test.ts`. Run all with `pnpm test`.
- **Test file location:** beside the source file (`foo.ts` → `foo.test.ts`).
- **Migration naming:** `prisma/migrations/YYYYMMDDhhmmss_descriptive_name/migration.sql`. Use `20260501000000` and later for timestamps from this plan to come after existing future-dated migrations.
- **Commit message style:** matches repo log — `feat(scope): summary` or `fix(scope): summary`.
- **DB read access from scripts:** `set -a && source .env.local && set +a && node script.mjs`. The Prisma client reads `DATABASE_URL`.
- **No NEW abstractions unless required.** Don't add interfaces, factories, or wrappers when a direct call works.
- **No comments unless WHY is non-obvious.** Names should explain WHAT.

---

## Amendments after audit (2026-04-29)

After Phase 1 landed, an external code-review pass surfaced four issues that have been corrected in this plan in-place. Quick reference for any agent dispatched to a downstream phase:

1. **Phase 1 follow-up: TypeScript build fixes + DB unique constraint.** The original Phase 1 made `Deal.propertyAddress` and `Deal.propertyType` nullable, breaking 7 type-level consumers. Repair commits add narrow-by-filter on the deal board / list / dashboard / scrub-linker / todo-context callsites and add a partial unique index on `property_key WHERE deal_type='seller_rep' AND archived_at IS NULL AND property_key IS NOT NULL`.

5. **Phase 5 race-recovery on the unique constraint.** `upsertDealForLead` now matches the unique index's `dealType='seller_rep'` scope in its `findFirst`, and catches Postgres `P2002` on `create` (re-runs findFirst and links to whichever deal won the race). A new unit test for the race-recovery path was added to Task 5.1.

2. **Phase 3 rewritten.** The original Phase 3 created a new `address-normalize.ts` going `n → north`. The repo already has `normalizeBuildoutProperty` in `full-kit/src/lib/buildout/property-normalizer.ts` going `north → n` — the inverse direction. Two normalizers would prevent lead-derived Deals from joining to Buildout-side data. Phase 3 is now a single test task that adds cross-platform parity coverage to the existing function. Phase 4 imports `normalizeBuildoutProperty` directly.

3. **Phase 7/10.4 `executedBy` removed.** The `AgentAction` model has no `executedBy` field; only `executedAt`. The `reviewer` parameter still exists in handler signatures (used by `AI_FEEDBACK_SOURCE_TYPES` audit downstream) but does NOT get persisted on the action row.

4. **Phase 11 `applyScrubResult` signature corrected.** The real signature is `{communicationId, queueRowId, leaseToken, scrubOutput, suggestedActions}` — no `modelUsed`, no `usage`. Token logging via `ScrubApiCall` is the real provider's responsibility (not done by `applyScrubResult` itself), so the subscription path bypasses that audit row entirely.

The original Phase 1 commits remain on-branch (`047c7c7`, `fe5b0ed`, `397807c`) — they're still correct, just incomplete. The repair commits land on top.

---

# Phase 1: Schema migration — Deal model extensions + new enums

**Why this phase:** Every downstream phase depends on schema fields that don't exist today. The `propertyAddress` non-null constraint blocks buyer-rep deals (no address at engagement). The lack of `dealType` makes it impossible to route handlers correctly. The lack of `propertyKey` makes address-based join impossible. No `outcome`/`closedAt` means won/lost is ambiguous.

**Files:**
- Modify: `full-kit/prisma/schema.prisma` (Deal model + enums)
- Create: `full-kit/prisma/migrations/20260501000000_deal_pipeline_extensions/migration.sql`

### Task 1.1: Add `DealType` and `DealOutcome` enums to schema

**Files:**
- Modify: `full-kit/prisma/schema.prisma` (insert after the existing `DealStage` enum, around line 31)

- [ ] **Step 1: Add the two enums to schema.prisma**

Insert after the closing `}` of `enum DealStage`:

```prisma
enum DealType {
  seller_rep
  buyer_rep
  tenant_rep
}

enum DealOutcome {
  won
  lost
  withdrawn
  expired
}

enum DealSource {
  manual
  lead_derived
  buildout_event
  buyer_rep_inferred
  ai_suggestion
}
```

- [ ] **Step 2: Verify schema parses**

Run: `cd full-kit && pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Commit**

```bash
git add full-kit/prisma/schema.prisma
git commit -m "feat(schema): add DealType, DealOutcome, DealSource enums"
```

### Task 1.2: Extend Deal model with new fields

**Files:**
- Modify: `full-kit/prisma/schema.prisma:424-463` (the `model Deal` block)

- [ ] **Step 1: Edit the Deal model to add fields and relax constraints**

Find the existing `model Deal { ... }` block and replace with:

```prisma
model Deal {
  id              String       @id @default(uuid())
  contactId       String       @map("contact_id")
  propertyAddress String?      @map("property_address")
  propertyType    PropertyType? @map("property_type")
  squareFeet      Int?         @map("square_feet")
  stage           DealStage    @default(prospecting)
  value           Decimal?     @db.Decimal(14, 2)
  listedDate      DateTime?    @map("listed_date")
  closingDate     DateTime?    @map("closing_date")
  closedAt        DateTime?    @map("closed_at")
  outcome         DealOutcome?
  dealType        DealType     @default(seller_rep) @map("deal_type")
  dealSource      DealSource   @default(manual) @map("deal_source")
  propertyKey     String?      @map("property_key")
  propertyAliases Json?        @default("[]") @map("property_aliases")
  unit            String?
  searchCriteria  Json?        @map("search_criteria")
  keyContacts     Json?        @default("{}") @map("key_contacts")
  category        Category     @default(business)
  tags            Json?        @default("[]")
  notes           String?      @db.Text
  createdBy       String?      @map("created_by")
  archivedAt      DateTime?    @map("archived_at")
  commissionRate  Decimal?     @default(0.03) @map("commission_rate") @db.Decimal(5, 4)
  probability     Int?
  stageChangedAt  DateTime?    @map("stage_changed_at")

  contact        Contact         @relation(fields: [contactId], references: [id], onDelete: Restrict)
  documents      DealDocument[]
  communications Communication[]
  meetings       Meeting[]
  todos          Todo[]
  agentMemories  AgentMemory[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([contactId])
  @@index([stage])
  @@index([propertyType])
  @@index([propertyAddress])
  @@index([propertyKey])
  @@index([dealType])
  @@index([dealSource])
  @@index([closedAt])
  @@index([listedDate])
  @@index([closingDate])
  @@index([stageChangedAt])
  @@map("deals")
}
```

Two structural changes from the existing model:
- `propertyAddress` and `propertyType` made nullable (buyer-rep deals during search phase have neither)
- New fields: `closedAt`, `outcome`, `dealType`, `dealSource`, `propertyKey`, `propertyAliases`, `unit`, `searchCriteria`

- [ ] **Step 2: Validate schema**

Run: `cd full-kit && pnpm prisma validate`
Expected: schema valid

- [ ] **Step 3: Generate migration without applying**

Run: `cd full-kit && pnpm prisma migrate dev --create-only --name deal_pipeline_extensions`
Expected: creates `prisma/migrations/20260501000000_deal_pipeline_extensions/migration.sql` (or similar timestamp)

- [ ] **Step 4: Inspect the generated migration**

Run: `cat full-kit/prisma/migrations/*deal_pipeline_extensions*/migration.sql`
Expected: SQL that adds the columns, creates the enums, alters NULL constraints on `property_address` and `property_type`. No DROP statements.

- [ ] **Step 5: Apply migration**

Run: `cd full-kit && pnpm prisma migrate dev`
Expected: migration applied; `prisma generate` ran automatically

- [ ] **Step 6: Sanity-check via DB query**

Run from full-kit/:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const cols = await db.\$queryRaw\`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name='deals' AND column_name IN
      ('property_address','property_type','property_key','deal_type','deal_source','closed_at','outcome','search_criteria')
    ORDER BY column_name
  \`;
  console.log(cols);
  await db.\$disconnect();
});
"
```
Expected: 8 rows. `property_address` is_nullable=YES. `property_type` is_nullable=YES. `deal_type` and `deal_source` are USER-DEFINED (enum). `property_key` data_type=text.

- [ ] **Step 7: Commit**

```bash
git add full-kit/prisma/schema.prisma full-kit/prisma/migrations/
git commit -m "feat(schema): extend Deal with dealType, dealSource, propertyKey, outcome, closedAt"
```

### Task 1.3: Document the migration in CLAUDE-style notes (optional)

Skip if no `CLAUDE.md` migration log exists. Otherwise add an entry. *No further action.*

---

# Phase 2: Re-classify the existing 22K rows + stamp classifierVersion

**Parallel-safe with:** Phase 3, Phase 7, Phase 11. Does not depend on Phase 1.

**Why this phase:** All 22,597 existing rows were classified on 2026-04-23/24. The classifier code (`src/lib/msgraph/email-filter*.ts`) has been edited 6+ times since (notably commit `45a4220` "Treat Buildout lead emails as real leads" on 2026-04-27, which changed classification output). No version stamp exists on any row. Stale classifications mean the AI scrub backfill (Phase 13) would process the wrong rows. Fix this BEFORE backfill.

The classifier is rules-based (not LLM) — re-classification is essentially free.

**Files:**
- Create: `full-kit/scripts/reclassify-communications.mjs`
- Create: `full-kit/scripts/reclassify-communications.test.mjs` (smoke test only — main correctness comes from existing classifier tests)

### Task 2.1: Find the current classifier entry point and the rule-set version constant

- [ ] **Step 1: Locate the classifier function and version constant**

Run: `grep -rn "EMAIL_FILTER_RULE_SET_VERSION\|classifyEmail" full-kit/src/lib/msgraph/ | head -20`
Expected: should show `classifyEmail` in `email-filter.ts` (or similar) and the version constant in `email-filter-rules.ts`. Verify `EMAIL_FILTER_RULE_SET_VERSION = "2026-04-26.2"` is the current value.

- [ ] **Step 2: Read the classifier signature**

Run: `grep -A 20 "export.*classifyEmail" full-kit/src/lib/msgraph/email-filter*.ts`
Expected: a function that takes a message-shaped input (subject, body, sender, headers, folder) and returns `{ classification, tier1Rule, ... }`.

Record the exact function name, file path, and input/output shape — used in the script.

### Task 2.2: Write the re-classify script (dry-run mode first)

**Files:**
- Create: `full-kit/scripts/reclassify-communications.mjs`

- [ ] **Step 1: Create the script with dry-run as default**

Write to `full-kit/scripts/reclassify-communications.mjs`:

```javascript
// Re-runs the current rule-based classifier against every communication
// and reports what would change. With --apply, writes the new
// classification + tier1Rule + classifierRuleSetVersion to metadata.
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/reclassify-communications.mjs            # dry-run
//   node scripts/reclassify-communications.mjs --apply    # write
//   node scripts/reclassify-communications.mjs --batch=500 --apply
//
// Idempotent: re-running with same classifier code is a no-op for any row
// already stamped with the current ruleSetVersion.

import { PrismaClient } from "@prisma/client"
import { classifyEmail } from "../src/lib/msgraph/email-filter.js"
import { EMAIL_FILTER_RULE_SET_VERSION } from "../src/lib/msgraph/email-filter-rules.js"

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const batchSize = Number(
  args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 1000
)

const db = new PrismaClient()

async function main() {
  const total = await db.communication.count({ where: { channel: "email" } })
  console.log(
    `Total email rows: ${total}; mode: ${apply ? "APPLY" : "DRY-RUN"}; batch: ${batchSize}`
  )

  const counters = {
    examined: 0,
    skippedAlreadyCurrent: 0,
    classificationChanged: 0,
    tier1RuleChanged: 0,
    unchanged: 0,
    written: 0,
  }
  const transitions = new Map()

  let cursor = null
  while (true) {
    const rows = await db.communication.findMany({
      where: { channel: "email" },
      select: { id: true, subject: true, body: true, date: true, metadata: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id

    for (const row of rows) {
      counters.examined++
      const meta = row.metadata ?? {}
      const stampedVersion = meta.classifierRuleSetVersion
      if (stampedVersion === EMAIL_FILTER_RULE_SET_VERSION) {
        counters.skippedAlreadyCurrent++
        continue
      }

      const result = classifyEmail({
        subject: row.subject,
        body: row.body,
        from: meta.from,
        toRecipients: meta.toRecipients,
        ccRecipients: meta.ccRecipients,
        parentFolderId: meta.parentFolderId,
        importance: meta.importance,
        isRead: meta.isRead,
      })

      const oldCls = meta.classification ?? "unclassified"
      const oldRule = meta.tier1Rule ?? "unknown"
      const clsChanged = oldCls !== result.classification
      const ruleChanged = oldRule !== result.tier1Rule
      if (clsChanged) counters.classificationChanged++
      if (ruleChanged) counters.tier1RuleChanged++
      if (!clsChanged && !ruleChanged) counters.unchanged++

      const tKey = `${oldCls}->${result.classification}`
      transitions.set(tKey, (transitions.get(tKey) ?? 0) + 1)

      if (apply) {
        await db.communication.update({
          where: { id: row.id },
          data: {
            metadata: {
              ...meta,
              classification: result.classification,
              tier1Rule: result.tier1Rule,
              classifierRuleSetVersion: EMAIL_FILTER_RULE_SET_VERSION,
              reclassifiedAt: new Date().toISOString(),
            },
          },
        })
        counters.written++
      }
    }

    process.stdout.write(`\rprocessed: ${counters.examined}/${total}`)
  }
  console.log("\n--- summary ---")
  console.log(JSON.stringify({ counters, transitions: Object.fromEntries(transitions) }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
```

Note: `import { classifyEmail }` and the rule-set-version import paths must match the actual exports from Task 2.1's investigation. If the runtime uses TypeScript-only modules, replace `.js` with the appropriate path or run the script via tsx (`pnpm tsx scripts/reclassify-communications.mjs`).

- [ ] **Step 2: Run dry-run**

Run from `full-kit/`:
```bash
set -a && source .env.local && set +a && node scripts/reclassify-communications.mjs
```
Expected: progress counter, then a summary JSON showing examined=22597, skippedAlreadyCurrent=0, and a `transitions` map showing how many rows shift between classifications. Note any large unexpected shifts (e.g., signal→noise on hundreds of rows = investigate before applying).

- [ ] **Step 3: Spot-check a few transitioning rows manually**

For each non-trivial transition (e.g., 50+ rows moving from `noise → signal`), pick 3 example rows and inspect:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const rows = await db.communication.findMany({
    where: { channel: 'email', metadata: { path: ['classification'], equals: 'noise' } },
    select: { id: true, subject: true, metadata: true },
    take: 5
  });
  console.log(JSON.stringify(rows, null, 2));
  await db.\$disconnect();
});"
```
Confirm the new classification is reasonable.

- [ ] **Step 4: Run with --apply on a small batch first**

Run: `node scripts/reclassify-communications.mjs --batch=200 --apply`
Wait for completion. Expected: `written` counter > 0.

- [ ] **Step 5: Verify the version stamp landed**

Run from full-kit/:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const stamped = await db.\$queryRaw\`
    SELECT COUNT(*)::int as c
    FROM communications
    WHERE metadata->>'classifierRuleSetVersion' IS NOT NULL
  \`;
  console.log(stamped);
  await db.\$disconnect();
});"
```
Expected: count matches the `written` value from the apply run.

- [ ] **Step 6: Run --apply for the full set**

Run: `node scripts/reclassify-communications.mjs --apply`
Wait for completion (likely 5-15 minutes for 22K rows).

- [ ] **Step 7: Verify final state**

Run the script once more without `--apply`. Expected: `skippedAlreadyCurrent` = 22597, `examined` = 22597, all other counters = 0. (Idempotency check.)

- [ ] **Step 8: Commit script**

```bash
git add full-kit/scripts/reclassify-communications.mjs
git commit -m "feat(scripts): add reclassify-communications + version stamp"
```

---

# Phase 3: Cross-platform coverage for the existing normalizer

> **Amended after audit (2026-04-29):** the original Phase 3 specified a brand-new `address-normalize.ts` utility that expanded `n → north`. That direction is opposite of what the existing repo does. `full-kit/src/lib/buildout/property-normalizer.ts` already implements `normalizeBuildoutProperty(raw, bodyText)` going `north → n` and is the function used to compute Buildout's existing `normalizedPropertyKey`. Creating a second normalizer would split keys and prevent lead-derived Deals from joining to Buildout-side data.
>
> Phase 3 is rewritten to **reuse the existing utility** and add test coverage for the cross-platform inputs Phase 4 will feed it. Phase 4's extractor changes import `normalizeBuildoutProperty` from `@/lib/buildout/property-normalizer` rather than a new file.

**Parallel-safe with:** Phase 2, Phase 7, Phase 11. No DB or Prisma dependency.

**Why this phase:** Verify that `normalizeBuildoutProperty` produces a consistent `normalizedPropertyKey` across the four platform formats Phase 4 will pass it (Buildout `Listing Address`, Crexi `Regarding listing at` with county, LoopNet pipe-separator, LoopNet subject-only "favorited"). Catch any normalizer gaps now so they're fixed before Phase 4 wires the extractors to it.

**Files:**
- Modify: `full-kit/src/lib/buildout/property-normalizer.ts` (only if a test exposes a real bug — extend the existing function, don't fork)
- Modify: `full-kit/src/lib/buildout/buildout-foundations.test.ts` (or add a new test file beside it — match repo convention)

### Task 3.1: Add cross-platform parity tests for `normalizeBuildoutProperty`

**Files:**
- Read first: `full-kit/src/lib/buildout/property-normalizer.ts` (the existing `normalizeBuildoutProperty(raw, bodyText)` function — note the `ROAD_SUFFIXES` table at line 12 and the `firstAddress` helper at line 146)
- Modify: `full-kit/src/lib/buildout/buildout-foundations.test.ts` (or create a sibling test file if the existing one is large — match the convention you see)

- [ ] **Step 1: Write parity tests**

The existing function takes `(raw: string | null | undefined, bodyText = "")` and returns `{normalizedPropertyKey, propertyAddressRaw, aliases, addressMissing, ...} | null`. Phase 4 will pass this function the property name (from email subject) plus the body text.

Add a `describe` block named "cross-platform property key parity" with these tests:

```typescript
import { describe, expect, it } from "vitest"

import { normalizeBuildoutProperty } from "./property-normalizer"

describe("normalizeBuildoutProperty — cross-platform parity", () => {
  it("Buildout 'Listing Address' line and LoopNet pipe format produce the same key", () => {
    const buildoutBody = "Hello,\n\nName Samuel Blum\nListing Address 303 North Broadway, Billings, MT 59101\nView Lead Details"
    const loopnetBody = "New Lead\nFrom: Alex Wright\n303 N Broadway | Billings, MT 59101"
    const buildout = normalizeBuildoutProperty("US Bank Building", buildoutBody)
    const loopnet = normalizeBuildoutProperty("303 N Broadway", loopnetBody)
    expect(buildout?.normalizedPropertyKey).toEqual(loopnet?.normalizedPropertyKey)
  })

  it("Crexi 'Regarding listing at' with county strips county and matches no-county form", () => {
    const withCounty = normalizeBuildoutProperty(
      "Montana Paint Building",
      "Regarding listing at 2610 Montana Ave, Billings, Yellowstone County, MT 59101"
    )
    const without = normalizeBuildoutProperty(
      "Montana Paint Building",
      "2610 Montana Ave, Billings, MT 59101"
    )
    expect(withCounty?.normalizedPropertyKey).toEqual(without?.normalizedPropertyKey)
  })

  it("LoopNet 'favorited' subject-only path produces a key that prefixes the full body-derived key", () => {
    const subjectOnly = normalizeBuildoutProperty("303 N Broadway", "")
    const full = normalizeBuildoutProperty(
      "303 N Broadway",
      "303 N Broadway | Billings, MT 59101"
    )
    expect(subjectOnly).not.toBeNull()
    expect(full).not.toBeNull()
    expect(full!.normalizedPropertyKey.startsWith(subjectOnly!.normalizedPropertyKey)).toBe(
      true
    )
  })

  it("returns addressMissing=true when the input is a property name only", () => {
    const result = normalizeBuildoutProperty(
      "Rockets | Gourmet Wraps & Sodas",
      "Listing Address Rockets | Gourmet Wraps & Sodas, Billings, MT"
    )
    expect(result?.addressMissing).toBe(true)
    expect(result?.normalizedPropertyKey).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the tests**

```
cd full-kit && pnpm test src/lib/buildout/buildout-foundations.test.ts -t "cross-platform"
```

If any test fails, the existing normalizer has a real gap that Phase 4 would have hit. Choose ONE response:
- **The gap is small and fixable** (e.g., `firstAddress` regex misses a specific format) → fix it inline in `property-normalizer.ts`, add a comment explaining why, and re-run.
- **The gap requires bigger changes** → STOP and report DONE_WITH_CONCERNS with the failing test output. Don't expand the function's scope without coordinating.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/buildout/buildout-foundations.test.ts full-kit/src/lib/buildout/property-normalizer.ts
git commit -m "test(buildout): add cross-platform parity tests for normalizeBuildoutProperty"
```

Phase 4 imports `normalizeBuildoutProperty` directly (no new utility file). The original Phase 3 plan to create a separate `address-normalize.ts` is dropped — that would have created two normalizers with opposite directional conventions.

(Removed: original Task 3.2 which would have created a duplicate `normalizeAddress` function. The existing `normalizeBuildoutProperty` covers this responsibility.)

```
# DROPPED — superseded by single Task 3.1 above
```


---

# Phase 4: Email extractor improvements — extract address from lead emails

**Depends on:** Phase 3.

**Why this phase:** The Crexi/LoopNet/Buildout extractors at `src/lib/msgraph/email-extractors.ts` only pull `propertyName` today. The address is in the email body in structured form for every platform. We add address extraction + normalization to each extractor so `metadata.extracted.propertyKey` and `metadata.extracted.propertyAddress` land on every parsed lead row.

**Files:**
- Modify: `full-kit/src/lib/msgraph/email-extractors.ts`
- Modify: `full-kit/src/lib/msgraph/email-extractors.test.ts`

### Task 4.1: Locate and read the existing extractors

- [ ] **Step 1: Read the file**

Run: `cat full-kit/src/lib/msgraph/email-extractors.ts | head -250`
Identify the three functions: `extractCrexiLead`, `extractLoopNetLead`, `extractBuildoutEvent`. Note their return-type shape; the new fields go into the existing returned object.

- [ ] **Step 2: Read the existing tests for shape conventions**

Run: `cat full-kit/src/lib/msgraph/email-extractors.test.ts | head -100`
Note the test fixtures and how parsed results are asserted.

### Task 4.2: Add address extraction to Buildout extractor

**Files:**
- Modify: `full-kit/src/lib/msgraph/email-extractors.test.ts` (add tests)
- Modify: `full-kit/src/lib/msgraph/email-extractors.ts` (modify `extractBuildoutEvent`)

- [ ] **Step 1: Add failing tests**

Append to `email-extractors.test.ts`:

```typescript
describe("extractBuildoutEvent — address extraction", () => {
  it("extracts Listing Address from a real lead body", () => {
    const body = `Hello,

Samuel Blum has viewed your Property Page.

Name    Samuel Blum
Email   samuel@cigprop.com
Phone Number    845.659.6659
When    4/21/26 - 2:08pm CDT
Listing Address 303 North Broadway, Billings, MT 59101
View Lead Details
`
    const result = extractBuildoutEvent({
      subject: "A new Lead has been added - US Bank Building",
      body,
      from: { address: "support@buildout.com" },
    })
    expect(result?.propertyAddress).toEqual("303 North Broadway, Billings, MT 59101")
    expect(result?.propertyKey).toEqual("303 north broadway billings mt 59101")
  })

  it("falls back to fallbackName when address line is a property name", () => {
    const body = `Hello,

Listing Address Rockets | Gourmet Wraps & Sodas, Billings, MT
`
    const result = extractBuildoutEvent({
      subject: "A new Lead has been added - Rockets | Gourmet Wraps & Sodas",
      body,
      from: { address: "support@buildout.com" },
    })
    expect(result?.propertyAddress).toEqual(
      "Rockets | Gourmet Wraps & Sodas, Billings, MT"
    )
    expect(result?.propertyKey).toBeNull()
    expect(result?.propertyFallbackName).toEqual(
      "rockets gourmet wraps sodas billings mt"
    )
  })

  it("returns null propertyAddress when no Listing Address line present", () => {
    const result = extractBuildoutEvent({
      subject: "Deal stage updated on Alpenglow Healthcare LLC Lease",
      body: "Alpenglow Healthcare LLC Lease was updated from Transacting to Closed",
      from: { address: "support@buildout.com" },
    })
    expect(result?.propertyAddress).toBeUndefined()
    expect(result?.propertyKey).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests (expect fail)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "address extraction"`
Expected: 3 failing tests.

- [ ] **Step 3: Modify `extractBuildoutEvent` to extract the address**

In `email-extractors.ts`, add an import at the top:

```typescript
import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"
```

Inside `extractBuildoutEvent`, after the existing parsing produces the return object, add:

```typescript
// Extract the labelled "Listing Address" line for high-fidelity address text,
// then delegate canonical-key derivation to the existing Buildout normalizer
// (single source of truth across lead-derived and Buildout-event Deal joins).
const addressMatch = body.match(/Listing Address\s+(.+?)(?:\r?\n|<|$)/)
const addressFromLabel = addressMatch?.[1]?.trim()
const normalized = normalizeBuildoutProperty(
  result.propertyName ?? addressFromLabel ?? "",
  addressFromLabel ?? body
)
if (normalized) {
  result.propertyAddress = normalized.propertyAddressRaw ?? addressFromLabel
  result.propertyKey = normalized.normalizedPropertyKey
  result.propertyAliases = normalized.aliases
  result.propertyAddressMissing = normalized.addressMissing
}
```

Where `result` is whatever the function already builds. Add `propertyAddress`, `propertyKey`, `propertyFallbackName` to the return-type interface near the top of the file.

- [ ] **Step 4: Run tests (expect pass)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "address extraction"`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(extractors): extract Listing Address from Buildout lead emails"
```

### Task 4.3: Add address extraction to Crexi extractor

- [ ] **Step 1: Add failing tests**

Append to `email-extractors.test.ts`:

```typescript
describe("extractCrexiLead — address extraction", () => {
  it("extracts the 'Regarding listing at' address with county", () => {
    const body = `Regarding listing at 13 Colorado Ave, Laurel, Yellowstone County, MT 59044

Hi, I would like to know more about this listing.

JACKY BRADLEY
442.890.7354
jackybradley67@outlook.com`
    const result = extractCrexiLead({
      subject: "JACKY BRADLEY requesting Information on 13 Colorado Ave in Laurel",
      body,
      from: { address: "emails@notifications.crexi.com" },
    })
    expect(result?.propertyAddress).toEqual(
      "13 Colorado Ave, Laurel, Yellowstone County, MT 59044"
    )
    // Crexi includes county; normalizer strips it → matches no-county form
    expect(result?.propertyKey).toEqual("13 colorado avenue laurel mt 59044")
  })
})
```

- [ ] **Step 2: Run test (expect fail)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "extractCrexiLead — address"`
Expected: failing.

- [ ] **Step 3: Modify `extractCrexiLead`**

Add inside the function, after existing parsing:

```typescript
const addressMatch = body.match(/Regarding listing at\s+(.+?)(?:\r?\n|<|$)/)
const addressFromLabel = addressMatch?.[1]?.trim()
const normalized = normalizeBuildoutProperty(
  result.propertyName ?? addressFromLabel ?? "",
  addressFromLabel ?? body
)
if (normalized) {
  result.propertyAddress = normalized.propertyAddressRaw ?? addressFromLabel
  result.propertyKey = normalized.normalizedPropertyKey
  result.propertyAliases = normalized.aliases
  result.propertyAddressMissing = normalized.addressMissing
}
```

(Add the same `import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"` import if it isn't already at the top of the file from Task 4.2.)

- [ ] **Step 4: Run test (expect pass)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "extractCrexiLead — address"`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(extractors): extract address from Crexi 'Regarding listing at' line"
```

### Task 4.4: Add address extraction to LoopNet extractor

- [ ] **Step 1: Add failing tests**

```typescript
describe("extractLoopNetLead — address extraction", () => {
  it("extracts pipe-separated address from LoopNet Lead body", () => {
    const body = `New Lead
From: Alex Wright | +1 239-851-1000 | wrightcommercial@gmail.com
To: Matt Robertson, Eve Harris
303 N Broadway | Billings, MT 59101

Hi, Matt, can you please send me any and all information you have on this.`
    const result = extractLoopNetLead({
      subject: "LoopNet Lead for 303 N Broadway",
      body,
      from: { address: "leads@loopnet.com" },
    })
    expect(result?.propertyAddress).toEqual("303 N Broadway | Billings, MT 59101")
    expect(result?.propertyKey).toEqual("303 north broadway billings mt 59101")
  })

  it("falls back to subject for 'favorited' emails with no body address", () => {
    const result = extractLoopNetLead({
      subject: "Alex Wright favorited 303 N Broadway",
      body: "Hi Matt, Your listing has been favorited by Alex Wright.",
      from: { address: "no-reply@loopnet.com" },
    })
    expect(result?.propertyAddress).toEqual("303 N Broadway")
    expect(result?.propertyKey).toEqual("303 north broadway")
  })
})
```

- [ ] **Step 2: Run test (expect fail)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "extractLoopNetLead — address"`
Expected: failing.

- [ ] **Step 3: Modify `extractLoopNetLead`**

Add inside the function after existing parsing:

```typescript
// LoopNet "Lead" emails: a line of "${street} | ${city}, ${state} ${zip}"
let addressLine: string | null = null
const pipeLineMatch = body.match(
  /^([0-9][^\r\n|]*?\s\|\s[A-Z][^\r\n]+?,\s[A-Z]{2}\s\d{5})/m
)
if (pipeLineMatch) {
  addressLine = pipeLineMatch[1].trim()
} else {
  // "Favorited" emails — fall back to subject
  const subjectMatch = subject.match(/favorited\s+(.+)$/i)
  if (subjectMatch) addressLine = subjectMatch[1].trim()
}
if (addressLine) {
  const normalized = normalizeBuildoutProperty(
    result.propertyName ?? addressLine,
    addressLine
  )
  if (normalized) {
    result.propertyAddress = normalized.propertyAddressRaw ?? addressLine
    result.propertyKey = normalized.normalizedPropertyKey
    result.propertyAliases = normalized.aliases
    result.propertyAddressMissing = normalized.addressMissing
  }
}
```

- [ ] **Step 4: Run tests (expect pass)**

Run: `cd full-kit && pnpm test src/lib/msgraph/email-extractors.test.ts -t "extractLoopNetLead — address"`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(extractors): extract address from LoopNet body and subject fallback"
```

---

# Phase 5: Lead → Deal auto-creation hook

**Depends on:** Phase 1, Phase 3, Phase 4.

**Why this phase:** When a Crexi/LoopNet/Buildout lead is parsed and its Contact is created/linked, also look up Deal by `propertyKey`. If exists → link `Communication.dealId`. If not → create a `dealType="seller_rep"`, `dealSource="lead_derived"` Deal at `stage="marketing"`. This is the central automation Matt called out: every platform lead becomes a real Deal.

**Files:**
- Create: `full-kit/src/lib/deals/lead-to-deal.ts`
- Create: `full-kit/src/lib/deals/lead-to-deal.test.ts`
- Modify: `full-kit/src/lib/backfill/lead-apply-backfill.ts` (call the new function from `createLeadContact`)

### Task 5.1: Test-first — write the lead-to-deal test suite

**Files:**
- Create: `full-kit/src/lib/deals/lead-to-deal.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { upsertDealForLead } from "./lead-to-deal"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    communication: {
      update: vi.fn(),
    },
  },
}))

describe("upsertDealForLead", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new Deal when none matches propertyKey", async () => {
    db.deal.findFirst.mockResolvedValue(null)
    db.deal.create.mockResolvedValue({ id: "deal-1" })
    db.communication.update.mockResolvedValue({})

    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: "303 north broadway billings mt 59101",
      propertyAddress: "303 North Broadway, Billings, MT 59101",
      propertySource: "buildout",
    })

    expect(result.created).toBe(true)
    expect(result.dealId).toEqual("deal-1")
    expect(db.deal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-1",
        propertyKey: "303 north broadway billings mt 59101",
        propertyAddress: "303 North Broadway, Billings, MT 59101",
        dealType: "seller_rep",
        dealSource: "lead_derived",
        stage: "marketing",
        propertyAliases: [],
      }),
    })
    expect(db.communication.update).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { dealId: "deal-1" },
    })
  })

  it("links the Communication to an existing Deal when propertyKey matches", async () => {
    db.deal.findFirst.mockResolvedValue({
      id: "deal-existing",
      propertyAliases: [],
    })
    db.communication.update.mockResolvedValue({})

    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: "303 north broadway billings mt 59101",
      propertyAddress: "303 N Broadway | Billings, MT 59101",
      propertySource: "loopnet",
    })

    expect(result.created).toBe(false)
    expect(result.dealId).toEqual("deal-existing")
    expect(db.deal.create).not.toHaveBeenCalled()
    expect(db.communication.update).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { dealId: "deal-existing" },
    })
  })

  it("returns null when propertyKey is missing (no auto-deal)", async () => {
    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: null,
      propertyAddress: null,
      propertySource: "buildout",
    })

    expect(result.dealId).toBeNull()
    expect(db.deal.create).not.toHaveBeenCalled()
    expect(db.communication.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests (expect fail)**

Run: `cd full-kit && pnpm test src/lib/deals/lead-to-deal.test.ts`
Expected: all fail with import-not-found.

### Task 5.2: Implement `upsertDealForLead`

**Files:**
- Create: `full-kit/src/lib/deals/lead-to-deal.ts`

- [ ] **Step 1: Write implementation**

```typescript
import { db } from "@/lib/prisma"

export type LeadDealUpsertInput = {
  contactId: string
  communicationId: string
  propertyKey: string | null
  propertyAddress: string | null
  propertySource: "buildout" | "crexi" | "loopnet"
}

export type LeadDealUpsertResult = {
  dealId: string | null
  created: boolean
}

export async function upsertDealForLead(
  input: LeadDealUpsertInput
): Promise<LeadDealUpsertResult> {
  if (!input.propertyKey) {
    return { dealId: null, created: false }
  }

  // Match the partial-unique-index scope from the Phase 1 repair migration:
  // (deal_type='seller_rep' AND archived_at IS NULL AND property_key IS NOT NULL).
  // Filtering by dealType ensures we don't link a lead to a stale buyer-rep
  // deal that happens to share the same propertyKey.
  const findExisting = () =>
    db.deal.findFirst({
      where: {
        propertyKey: input.propertyKey,
        dealType: "seller_rep",
        archivedAt: null,
      },
      select: { id: true, propertyAliases: true },
    })

  const existing = await findExisting()
  if (existing) {
    await db.communication.update({
      where: { id: input.communicationId },
      data: { dealId: existing.id },
    })
    return { dealId: existing.id, created: false }
  }

  // Race window: another worker may insert a matching seller_rep Deal between
  // findFirst and create. The partial unique index makes that race safe — the
  // second create throws P2002, which we catch and treat as "found existing"
  // by re-running findFirst.
  let createdDealId: string
  try {
    const created = await db.deal.create({
      data: {
        contactId: input.contactId,
        propertyKey: input.propertyKey,
        propertyAddress: input.propertyAddress,
        dealType: "seller_rep",
        dealSource: "lead_derived",
        stage: "marketing",
        propertyAliases: [],
      },
      select: { id: true },
    })
    createdDealId = created.id
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const racedTo = await findExisting()
      if (!racedTo) throw err // unique violation but no row found — re-throw
      await db.communication.update({
        where: { id: input.communicationId },
        data: { dealId: racedTo.id },
      })
      return { dealId: racedTo.id, created: false }
    }
    throw err
  }
  await db.communication.update({
    where: { id: input.communicationId },
    data: { dealId: createdDealId },
  })
  return { dealId: createdDealId, created: true }
}
```

Required imports for the implementation file:

```typescript
import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
```

(The `Prisma` namespace import is what gives you `Prisma.PrismaClientKnownRequestError` for the P2002 catch.)

> **Phase 5 amendment after Phase 1 repair:** the unique partial index on `(property_key) WHERE deal_type='seller_rep' AND archived_at IS NULL AND property_key IS NOT NULL` was added in Phase 1 follow-up commit `10a5b58`. It's the DB-level guarantee that this `findFirst+create` flow can race safely. Add a unit test (alongside Task 5.1's tests) for the race-recovery path: mock `db.deal.create` to throw a `P2002` Prisma error on first call, then assert `upsertDealForLead` re-runs `findFirst` and returns the raced-to id with `created: false`. The test sits at `lead-to-deal.test.ts` and looks like:
>
> ```typescript
> it("recovers when create races with another worker (P2002)", async () => {
>   const p2002 = Object.assign(new Error("Unique constraint failed"), {
>     code: "P2002",
>   })
>   Object.setPrototypeOf(p2002, Prisma.PrismaClientKnownRequestError.prototype)
>
>   db.deal.findFirst
>     .mockResolvedValueOnce(null) // first findFirst — no deal yet
>     .mockResolvedValueOnce({ id: "deal-raced", propertyAliases: [] }) // post-throw findFirst
>   db.deal.create.mockRejectedValue(p2002)
>   db.communication.update.mockResolvedValue({})
>
>   const result = await upsertDealForLead({
>     contactId: "contact-1",
>     communicationId: "comm-1",
>     propertyKey: "303 north broadway billings mt 59101",
>     propertyAddress: "303 N Broadway",
>     propertySource: "loopnet",
>   })
>
>   expect(result.created).toBe(false)
>   expect(result.dealId).toEqual("deal-raced")
>   expect(db.communication.update).toHaveBeenCalledWith({
>     where: { id: "comm-1" },
>     data: { dealId: "deal-raced" },
>   })
> })
> ```

- [ ] **Step 2: Run tests (expect pass)**

Run: `cd full-kit && pnpm test src/lib/deals/lead-to-deal.test.ts`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/deals/lead-to-deal.ts full-kit/src/lib/deals/lead-to-deal.test.ts
git commit -m "feat(deals): add upsertDealForLead — auto-create or link Deal by propertyKey"
```

### Task 5.3: Wire `upsertDealForLead` into the lead-apply backfill

**Files:**
- Modify: `full-kit/src/lib/backfill/lead-apply-backfill.ts`

- [ ] **Step 1: Locate the createLeadContact function**

Run: `grep -n "createLeadContact\|export.*function" full-kit/src/lib/backfill/lead-apply-backfill.ts | head -20`
Identify line numbers and the surrounding function that creates the Contact + records `metadata.backfill.leadApply`.

- [ ] **Step 2: Add an import at top of file**

```typescript
import { upsertDealForLead } from "@/lib/deals/lead-to-deal"
```

- [ ] **Step 3: After the Contact is successfully created/linked, call upsertDealForLead**

In the existing flow, locate where `Communication.contactId` is updated (the lead is "applied"). Immediately after, add:

```typescript
const extracted = communication.metadata?.extracted ?? {}
if (extracted.propertyKey || extracted.propertyAddress) {
  const dealResult = await upsertDealForLead({
    contactId: contactId,
    communicationId: communication.id,
    propertyKey: extracted.propertyKey ?? null,
    propertyAddress: extracted.propertyAddress ?? null,
    propertySource: extracted.platform,
  })
  // Stash for caller's outcome record
  outcome.dealId = dealResult.dealId
  outcome.dealCreated = dealResult.created
}
```

(Exact variable names like `contactId`, `communication`, `outcome` must match the surrounding code — adjust to local names.)

- [ ] **Step 4: Add a unit/integration test that proves the wire-up**

Append to `full-kit/src/lib/backfill/lead-apply-backfill.test.ts` (or create if it doesn't exist):

```typescript
describe("createLeadContact wires through to upsertDealForLead", () => {
  it("creates a Deal when an extracted propertyKey is present", async () => {
    // Use existing test fixture or build a minimal one. Assert that after
    // running createLeadContact for a Buildout lead with extracted.propertyKey,
    // a Deal row exists with propertyKey matching and dealType="seller_rep".
  })
})
```

(Spell out the fixture using the patterns already in the test file; do not invent new mocking strategies.)

- [ ] **Step 5: Run tests**

Run: `cd full-kit && pnpm test src/lib/backfill/lead-apply-backfill.test.ts`
Expected: all pre-existing tests still pass + the new test passes.

- [ ] **Step 6: Commit**

```bash
git add full-kit/src/lib/backfill/lead-apply-backfill.ts full-kit/src/lib/backfill/lead-apply-backfill.test.ts
git commit -m "feat(lead-apply): auto-create Deal from extracted propertyKey"
```

---

# Phase 6: Backfill propertyKey + retroactive Deal creation on existing 22K rows

**Depends on:** Phase 4, Phase 5.

**Why this phase:** Phases 4 and 5 only affect rows ingested *after* deploy. The 22K existing rows have no `propertyKey` extracted and no Deals. We re-run the new extractors and the lead-to-deal hook against the existing corpus.

**Files:**
- Create: `full-kit/scripts/backfill-property-keys.mjs`

### Task 6.1: Write the backfill script

- [ ] **Step 1: Write script (dry-run by default)**

```javascript
// Re-run the (now address-aware) lead extractors against existing
// communications and call upsertDealForLead for each. Idempotent —
// existing dealId on a Communication is left untouched.
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/backfill-property-keys.mjs           # dry-run
//   node scripts/backfill-property-keys.mjs --apply

import { PrismaClient } from "@prisma/client"
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "../src/lib/msgraph/email-extractors.js"
import { upsertDealForLead } from "../src/lib/deals/lead-to-deal.js"

const apply = process.argv.includes("--apply")
const db = new PrismaClient()

async function main() {
  const rows = await db.communication.findMany({
    where: {
      channel: "email",
      direction: "inbound",
      OR: [
        { metadata: { path: ["tier1Rule"], equals: "buildout-support" } },
        { metadata: { path: ["tier1Rule"], equals: "buildout-notification" } },
        { metadata: { path: ["tier1Rule"], equals: "crexi-notifications" } },
        { metadata: { path: ["tier1Rule"], equals: "loopnet-leads" } },
      ],
      dealId: null,
    },
    select: {
      id: true,
      subject: true,
      body: true,
      contactId: true,
      metadata: true,
    },
  })
  console.log(`Found ${rows.length} candidate rows`)

  const counters = { reExtracted: 0, dealCreated: 0, dealLinked: 0, skippedNoContact: 0, skippedNoKey: 0 }
  for (const row of rows) {
    const tier = row.metadata?.tier1Rule
    let result = null
    if (tier === "buildout-support" || tier === "buildout-notification") {
      result = extractBuildoutEvent({
        subject: row.subject,
        body: row.body,
        from: row.metadata?.from,
      })
    } else if (tier === "crexi-notifications") {
      result = extractCrexiLead({
        subject: row.subject,
        body: row.body,
        from: row.metadata?.from,
      })
    } else if (tier === "loopnet-leads") {
      result = extractLoopNetLead({
        subject: row.subject,
        body: row.body,
        from: row.metadata?.from,
      })
    }
    if (!result) continue
    counters.reExtracted++
    if (!row.contactId) {
      counters.skippedNoContact++
      continue
    }
    if (!result.propertyKey) {
      counters.skippedNoKey++
      continue
    }
    if (apply) {
      // Persist the newly-extracted address into metadata.extracted
      await db.communication.update({
        where: { id: row.id },
        data: {
          metadata: {
            ...row.metadata,
            extracted: {
              ...(row.metadata?.extracted ?? {}),
              propertyAddress: result.propertyAddress,
              propertyKey: result.propertyKey,
            },
          },
        },
      })
      const dealResult = await upsertDealForLead({
        contactId: row.contactId,
        communicationId: row.id,
        propertyKey: result.propertyKey,
        propertyAddress: result.propertyAddress ?? null,
        propertySource:
          tier === "crexi-notifications"
            ? "crexi"
            : tier === "loopnet-leads"
              ? "loopnet"
              : "buildout",
      })
      if (dealResult.created) counters.dealCreated++
      else if (dealResult.dealId) counters.dealLinked++
    }
  }
  console.log(JSON.stringify(counters, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
```

- [ ] **Step 2: Dry-run**

Run from `full-kit/`:
```bash
set -a && source .env.local && set +a && node scripts/backfill-property-keys.mjs
```
Expected: counters showing `reExtracted` for some count of rows (likely 100-150 across all platforms based on the corpus census), `dealCreated`/`dealLinked` = 0 in dry-run.

- [ ] **Step 3: Apply**

Run: `node scripts/backfill-property-keys.mjs --apply`
Expected: counters with `dealCreated` > 0.

- [ ] **Step 4: Verify Deals were created**

Run from full-kit/:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const grouped = await db.deal.groupBy({
    by: ['dealType','dealSource','stage'],
    _count: { _all: true },
  });
  console.log(JSON.stringify(grouped, null, 2));
  await db.\$disconnect();
});"
```
Expected: rows showing `dealType: seller_rep`, `dealSource: lead_derived`, `stage: marketing` with a count > 0.

- [ ] **Step 5: Verify Communications were linked**

Run:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const c = await db.communication.count({ where: { dealId: { not: null } } });
  console.log({linkedCommunications: c});
  await db.\$disconnect();
});"
```
Expected: count > 0, matching the sum of `dealCreated + dealLinked` from Step 3.

- [ ] **Step 6: Commit**

```bash
git add full-kit/scripts/backfill-property-keys.mjs
git commit -m "feat(scripts): backfill propertyKey + create Deals from existing leads"
```

---

# Phase 7: AgentAction handlers — wire move-deal-stage, update-deal, create-deal

**Parallel-safe with:** Phase 3, Phase 4. Depends on Phase 1.

**Why this phase:** The AI scrub already produces `move-deal-stage` and `update-deal` AgentActions, but `approveAgentAction` at `src/lib/ai/agent-actions.ts:75-84` rejects everything except `create-todo` and `mark-todo-done`. Phases 8, 9, 10 all produce these action types — this phase makes approval execute them.

**Files:**
- Modify: `full-kit/src/lib/ai/agent-actions.ts`
- Create: `full-kit/src/lib/ai/agent-actions-deal.ts`
- Create: `full-kit/src/lib/ai/agent-actions-deal.test.ts`

### Task 7.1: Test-first — handler for move-deal-stage

- [ ] **Step 1: Write tests**

Create `full-kit/src/lib/ai/agent-actions-deal.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      update: vi.fn(),
    },
  },
}))

describe("moveDealStageFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("transitions stage and stamps stageChangedAt", async () => {
    db.deal.findUnique.mockResolvedValue({
      id: "deal-1",
      stage: "offer",
    })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

    const result = await moveDealStageFromAction(
      {
        id: "action-1",
        actionType: "move-deal-stage",
        payload: {
          dealId: "deal-1",
          fromStage: "offer",
          toStage: "under_contract",
          reason: "PSA fully executed",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({
        stage: "under_contract",
        stageChangedAt: expect.any(Date),
      }),
    })
  })

  it("rejects when fromStage doesn't match current stage (concurrency safety)", async () => {
    db.deal.findUnique.mockResolvedValue({
      id: "deal-1",
      stage: "under_contract",
    })

    await expect(
      moveDealStageFromAction(
        {
          id: "action-1",
          actionType: "move-deal-stage",
          payload: {
            dealId: "deal-1",
            fromStage: "offer",
            toStage: "under_contract",
            reason: "...",
          },
        },
        "matt@nai.test"
      )
    ).rejects.toThrow(/stage mismatch/i)
  })

  it("stamps closedAt and outcome when transitioning to closed", async () => {
    db.deal.findUnique.mockResolvedValue({ id: "deal-1", stage: "closing" })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

    await moveDealStageFromAction(
      {
        id: "action-1",
        actionType: "move-deal-stage",
        payload: {
          dealId: "deal-1",
          fromStage: "closing",
          toStage: "closed",
          reason: "Close completed",
          outcome: "won",
        },
      },
      "matt@nai.test"
    )
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({
        stage: "closed",
        outcome: "won",
        closedAt: expect.any(Date),
      }),
    })
  })
})

describe("updateDealFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("applies allowed field updates", async () => {
    db.deal.findUnique.mockResolvedValue({ id: "deal-1" })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

    await updateDealFromAction(
      {
        id: "action-1",
        actionType: "update-deal",
        payload: {
          dealId: "deal-1",
          fields: {
            value: 2100000,
            closingDate: "2026-06-30T00:00:00.000Z",
          },
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: {
        value: 2100000,
        closingDate: new Date("2026-06-30T00:00:00.000Z"),
      },
    })
  })

  it("rejects updates to forbidden fields (id, contactId)", async () => {
    db.deal.findUnique.mockResolvedValue({ id: "deal-1" })
    await expect(
      updateDealFromAction(
        {
          id: "action-1",
          actionType: "update-deal",
          payload: {
            dealId: "deal-1",
            fields: { contactId: "another-contact" },
            reason: "...",
          },
        },
        "matt@nai.test"
      )
    ).rejects.toThrow(/forbidden field/i)
  })
})
```

- [ ] **Step 2: Run tests (expect fail)**

Run: `cd full-kit && pnpm test src/lib/ai/agent-actions-deal.test.ts`
Expected: tests fail (module not found).

### Task 7.2: Implement the deal-action handlers

**Files:**
- Create: `full-kit/src/lib/ai/agent-actions-deal.ts`

- [ ] **Step 1: Write implementation**

```typescript
import type { AgentAction, DealStage, DealOutcome } from "@prisma/client"

import { db } from "@/lib/prisma"

import { AgentActionReviewError } from "./agent-actions"
import type { AgentActionReviewResult } from "./agent-actions"

const ALLOWED_UPDATE_FIELDS = new Set([
  "value",
  "closingDate",
  "listedDate",
  "squareFeet",
  "probability",
  "commissionRate",
  "notes",
  "tags",
  "unit",
])

type MoveStagePayload = {
  dealId: string
  fromStage: DealStage
  toStage: DealStage
  reason: string
  outcome?: DealOutcome
}

type UpdateDealPayload = {
  dealId: string
  fields: Record<string, unknown>
  reason: string
}

export async function moveDealStageFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as MoveStagePayload
  const deal = await db.deal.findUnique({
    where: { id: payload.dealId },
    select: { id: true, stage: true },
  })
  if (!deal) {
    throw new AgentActionReviewError(`deal ${payload.dealId} not found`, 404)
  }
  if (deal.stage !== payload.fromStage) {
    throw new AgentActionReviewError(
      `stage mismatch: deal is currently ${deal.stage}, action expected ${payload.fromStage}`,
      409,
      "stage_mismatch"
    )
  }

  const data: Record<string, unknown> = {
    stage: payload.toStage,
    stageChangedAt: new Date(),
  }
  if (payload.toStage === "closed") {
    data.closedAt = new Date()
    if (payload.outcome) data.outcome = payload.outcome
  }

  await db.deal.update({ where: { id: payload.dealId }, data })
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })
  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}

export async function updateDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as UpdateDealPayload
  const deal = await db.deal.findUnique({
    where: { id: payload.dealId },
    select: { id: true },
  })
  if (!deal) {
    throw new AgentActionReviewError(`deal ${payload.dealId} not found`, 404)
  }

  const data: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(payload.fields)) {
    if (!ALLOWED_UPDATE_FIELDS.has(field)) {
      throw new AgentActionReviewError(
        `forbidden field in update-deal payload: ${field}`,
        400,
        "forbidden_update_field"
      )
    }
    if (field === "closingDate" || field === "listedDate") {
      data[field] = typeof value === "string" ? new Date(value) : value
    } else {
      data[field] = value
    }
  }

  await db.deal.update({ where: { id: payload.dealId }, data })
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })
  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}
```

- [ ] **Step 2: Run tests**

Run: `cd full-kit && pnpm test src/lib/ai/agent-actions-deal.test.ts`
Expected: all pass.

### Task 7.3: Wire the handlers into approveAgentAction

**Files:**
- Modify: `full-kit/src/lib/ai/agent-actions.ts:75-84` (the unsupported-action-type rejection)

- [ ] **Step 1: Read the current rejection block**

Run: `sed -n '70,95p' full-kit/src/lib/ai/agent-actions.ts`

- [ ] **Step 2: Replace the rejection with a dispatcher**

Find:

```typescript
  if (
    action.actionType !== "create-todo" &&
    action.actionType !== "mark-todo-done"
  ) {
    throw new AgentActionReviewError(
      "unsupported action type",
      400,
      "unsupported_action_type"
    )
  }

  if (action.actionType === "mark-todo-done") {
    return markTodoDoneFromAction(action, reviewer)
  }
  return createTodoFromAction(action, reviewer)
```

Replace with:

```typescript
  switch (action.actionType) {
    case "create-todo":
      return createTodoFromAction(action, reviewer)
    case "mark-todo-done":
      return markTodoDoneFromAction(action, reviewer)
    case "move-deal-stage":
      return moveDealStageFromAction(action, reviewer)
    case "update-deal":
      return updateDealFromAction(action, reviewer)
    default:
      throw new AgentActionReviewError(
        `unsupported action type: ${action.actionType}`,
        400,
        "unsupported_action_type"
      )
  }
```

Add the import at top of file:

```typescript
import {
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"
```

- [ ] **Step 3: Verify existing approveAgentAction tests still pass**

Run: `cd full-kit && pnpm test src/lib/ai/agent-actions`
Expected: all pre-existing tests pass + new deal tests pass.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/lib/ai/agent-actions.ts full-kit/src/lib/ai/agent-actions-deal.ts full-kit/src/lib/ai/agent-actions-deal.test.ts
git commit -m "feat(agent-actions): execute move-deal-stage and update-deal on approval"
```

---

# Phase 8: Buildout deal-stage email parser

**Depends on:** Phase 1, Phase 7. Parallel-safe with Phase 9, Phase 10 after Phase 7 lands.

**Why this phase:** Buildout sends "Deal stage updated on X" emails when listings transition stages (e.g., "Transacting → Closed"). These are high-fidelity signals that should auto-propose `move-deal-stage` AgentActions referencing the matching Deal.

**Files:**
- Create: `full-kit/src/lib/msgraph/buildout-stage-parser.ts`
- Create: `full-kit/src/lib/msgraph/buildout-stage-parser.test.ts`
- Modify: `full-kit/src/lib/backfill/lead-apply-backfill.ts` (add a call to the parser for `tier1Rule = buildout-support` rows with `kind = deal-stage-update`)

### Task 8.1: Test-first — Buildout stage transitions

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest"

import {
  parseBuildoutStageTransition,
  mapBuildoutStageToDealStage,
} from "./buildout-stage-parser"

describe("parseBuildoutStageTransition", () => {
  it("extracts from/to stage from typical body", () => {
    const result = parseBuildoutStageTransition(
      "Alpenglow Healthcare LLC Lease was updated from Transacting to Closed"
    )
    expect(result).toEqual({
      fromStageRaw: "Transacting",
      toStageRaw: "Closed",
    })
  })

  it("returns null when body lacks the pattern", () => {
    expect(parseBuildoutStageTransition("Some other content")).toBeNull()
  })
})

describe("mapBuildoutStageToDealStage", () => {
  it("maps Transacting → under_contract", () => {
    expect(mapBuildoutStageToDealStage("Transacting")).toEqual("under_contract")
  })
  it("maps Closed → closed", () => {
    expect(mapBuildoutStageToDealStage("Closed")).toEqual("closed")
  })
  it("maps Marketing → marketing", () => {
    expect(mapBuildoutStageToDealStage("Marketing")).toEqual("marketing")
  })
  it("returns null for unknown stages", () => {
    expect(mapBuildoutStageToDealStage("Frobnicating")).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests (expect fail)**

Run: `cd full-kit && pnpm test src/lib/msgraph/buildout-stage-parser.test.ts`
Expected: fail.

### Task 8.2: Implement the parser

```typescript
import type { DealStage } from "@prisma/client"

const TRANSITION_RE = /was updated from\s+(\w+(?:\s\w+)*)\s+to\s+(\w+(?:\s\w+)*)/

export type BuildoutStageTransition = {
  fromStageRaw: string
  toStageRaw: string
}

export function parseBuildoutStageTransition(
  body: string
): BuildoutStageTransition | null {
  const match = body.match(TRANSITION_RE)
  if (!match) return null
  return { fromStageRaw: match[1].trim(), toStageRaw: match[2].trim() }
}

const BUILDOUT_TO_DEAL_STAGE: Record<string, DealStage> = {
  prospecting: "prospecting",
  marketing: "marketing",
  showings: "showings",
  offer: "offer",
  transacting: "under_contract",
  "under contract": "under_contract",
  "due diligence": "due_diligence",
  closing: "closing",
  closed: "closed",
}

export function mapBuildoutStageToDealStage(raw: string): DealStage | null {
  return BUILDOUT_TO_DEAL_STAGE[raw.toLowerCase()] ?? null
}
```

- [ ] **Step 1: Save file, run tests**

Run: `cd full-kit && pnpm test src/lib/msgraph/buildout-stage-parser.test.ts`
Expected: pass.

- [ ] **Step 2: Commit**

```bash
git add full-kit/src/lib/msgraph/buildout-stage-parser.ts full-kit/src/lib/msgraph/buildout-stage-parser.test.ts
git commit -m "feat(buildout): parse 'Deal stage updated' email body into typed transition"
```

### Task 8.3: Wire stage-transition email → AgentAction proposal

**Files:**
- Create: `full-kit/src/lib/deals/buildout-stage-action.ts`
- Create: `full-kit/src/lib/deals/buildout-stage-action.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { proposeStageMoveFromBuildoutEmail } from "./buildout-stage-action"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: { findFirst: vi.fn() },
    agentAction: { create: vi.fn() },
  },
}))

describe("proposeStageMoveFromBuildoutEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a move-deal-stage AgentAction when a deal matches by name", async () => {
    db.deal.findFirst.mockResolvedValue({
      id: "deal-1",
      stage: "offer",
    })
    db.agentAction.create.mockResolvedValue({ id: "action-1" })

    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Alpenglow Healthcare LLC Lease",
      fromStageRaw: "Transacting",
      toStageRaw: "Closed",
    })

    expect(result.created).toBe(true)
    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "move-deal-stage",
        status: "pending",
        tier: "approve",
        sourceCommunicationId: "comm-1",
        payload: expect.objectContaining({
          dealId: "deal-1",
          fromStage: "offer",
          toStage: "closed",
          outcome: "won",
        }),
      }),
    })
  })

  it("returns no-action when no deal matches", async () => {
    db.deal.findFirst.mockResolvedValue(null)
    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Unknown Building",
      fromStageRaw: "Marketing",
      toStageRaw: "Showings",
    })
    expect(result.created).toBe(false)
    expect(db.agentAction.create).not.toHaveBeenCalled()
  })

  it("returns no-action when toStage is unmappable", async () => {
    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Whatever",
      fromStageRaw: "Marketing",
      toStageRaw: "FrobnicationStage",
    })
    expect(result.created).toBe(false)
  })
})
```

- [ ] **Step 2: Run (expect fail)**

Run: `cd full-kit && pnpm test src/lib/deals/buildout-stage-action.test.ts`

- [ ] **Step 3: Implement**

```typescript
import { db } from "@/lib/prisma"

import { mapBuildoutStageToDealStage } from "@/lib/msgraph/buildout-stage-parser"

export type ProposeStageMoveInput = {
  communicationId: string
  propertyName: string
  fromStageRaw: string
  toStageRaw: string
}

export async function proposeStageMoveFromBuildoutEmail(
  input: ProposeStageMoveInput
): Promise<{ created: boolean; actionId: string | null }> {
  const toStage = mapBuildoutStageToDealStage(input.toStageRaw)
  const fromStage = mapBuildoutStageToDealStage(input.fromStageRaw)
  if (!toStage || !fromStage) return { created: false, actionId: null }

  const deal = await db.deal.findFirst({
    where: {
      OR: [
        { propertyAddress: { contains: input.propertyName, mode: "insensitive" } },
        { propertyAliases: { array_contains: [input.propertyName] } },
      ],
      archivedAt: null,
    },
    select: { id: true, stage: true },
  })
  if (!deal) return { created: false, actionId: null }

  const outcome = toStage === "closed" ? "won" : undefined
  const action = await db.agentAction.create({
    data: {
      actionType: "move-deal-stage",
      status: "pending",
      tier: "approve",
      sourceCommunicationId: input.communicationId,
      payload: {
        dealId: deal.id,
        fromStage,
        toStage,
        reason: `Buildout email reported transition from ${input.fromStageRaw} to ${input.toStageRaw}`,
        ...(outcome ? { outcome } : {}),
      },
    },
  })
  return { created: true, actionId: action.id }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
cd full-kit && pnpm test src/lib/deals/buildout-stage-action.test.ts
git add full-kit/src/lib/deals/buildout-stage-action.ts full-kit/src/lib/deals/buildout-stage-action.test.ts
git commit -m "feat(deals): propose move-deal-stage from Buildout stage-update emails"
```

### Task 8.4: Hook into the email-ingestion path

- [ ] **Step 1: Find where Buildout-event extracted data is written to communications**

Run: `grep -n "buildout-support\|buildout-notification\|deal-stage-update" full-kit/src/lib/backfill/lead-apply-backfill.ts | head -10`
Identify where Buildout `deal-stage-update` rows are processed (or where they're skipped today).

- [ ] **Step 2: Wire the call after the event is parsed**

Add after the Buildout event extraction:

```typescript
if (extracted.kind === "deal-stage-update" && extracted.fromStageRaw && extracted.toStageRaw && extracted.propertyName) {
  await proposeStageMoveFromBuildoutEmail({
    communicationId: communication.id,
    propertyName: extracted.propertyName,
    fromStageRaw: extracted.fromStageRaw,
    toStageRaw: extracted.toStageRaw,
  })
}
```

(Update `extractBuildoutEvent` if needed to populate `fromStageRaw`/`toStageRaw` by calling the Phase 8.2 parser.)

- [ ] **Step 3: Run all msgraph + backfill tests**

Run: `cd full-kit && pnpm test src/lib/msgraph src/lib/backfill src/lib/deals`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/backfill/lead-apply-backfill.ts
git commit -m "feat(buildout): hook stage-transition email parsing into ingestion"
```

---

# Phase 9: Contact role lifecycle on deal events

**Depends on:** Phase 1, Phase 7. Parallel-safe with Phases 8, 10.

**Why this phase:** When a Deal is created or transitions stage, the linked Contact's role/lifecycle state should reflect that. Today the Clients page reads from filesystem vault notes, not from Contact role + active Deal state. This phase wires Contact updates into deal events so the data source becomes coherent.

**Files:**
- Modify: `full-kit/prisma/schema.prisma` (add `clientType` enum + Contact field)
- Create: `full-kit/prisma/migrations/20260501010000_contact_client_type/migration.sql`
- Create: `full-kit/src/lib/contacts/sync-contact-role.ts`
- Create: `full-kit/src/lib/contacts/sync-contact-role.test.ts`
- Modify: `full-kit/src/lib/deals/lead-to-deal.ts` (call sync after Deal create)
- Modify: `full-kit/src/lib/ai/agent-actions-deal.ts` (call sync on stage closed)

### Task 9.1: Add ClientType enum + Contact.clientType field

- [ ] **Step 1: Add enum to schema.prisma**

After `enum LeadStatus`:

```prisma
enum ClientType {
  prospect
  active_listing_client
  active_buyer_rep_client
  past_client
  cooperating_broker
  service_provider
  other
}
```

- [ ] **Step 2: Add field to Contact model**

In the Contact model, add:

```prisma
  clientType ClientType? @map("client_type")
```

And add to indexes:

```prisma
  @@index([clientType])
```

- [ ] **Step 3: Generate + apply migration**

Run: `cd full-kit && pnpm prisma migrate dev --name contact_client_type`
Expected: migration applies, generates client.

- [ ] **Step 4: Commit**

```bash
git add full-kit/prisma/schema.prisma full-kit/prisma/migrations/
git commit -m "feat(schema): add ClientType enum and Contact.clientType"
```

### Task 9.2: Implement sync-contact-role

**Files:**
- Create: `full-kit/src/lib/contacts/sync-contact-role.ts`
- Create: `full-kit/src/lib/contacts/sync-contact-role.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { syncContactRoleFromDeals } from "./sync-contact-role"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: { findMany: vi.fn() },
    contact: { update: vi.fn() },
  },
}))

describe("syncContactRoleFromDeals", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets active_listing_client when contact has any active listing-side deal", async () => {
    db.deal.findMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_listing_client" },
    })
  })

  it("sets active_buyer_rep_client when contact has any active buyer-rep deal", async () => {
    db.deal.findMany.mockResolvedValue([
      { dealType: "buyer_rep", stage: "showings", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_buyer_rep_client" },
    })
  })

  it("prefers active_buyer_rep_client when contact has both flows active", async () => {
    db.deal.findMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
      { dealType: "buyer_rep", stage: "offer", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_buyer_rep_client" },
    })
  })

  it("sets past_client when all deals are closed and at least one is won", async () => {
    db.deal.findMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "closed", outcome: "won" },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "past_client" },
    })
  })

  it("leaves clientType null when no deals exist", async () => {
    db.deal.findMany.mockResolvedValue([])
    await syncContactRoleFromDeals("contact-1")
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: null },
    })
  })
})
```

- [ ] **Step 2: Run (expect fail)**

Run: `cd full-kit && pnpm test src/lib/contacts/sync-contact-role.test.ts`

- [ ] **Step 3: Implement**

```typescript
import type { ClientType } from "@prisma/client"

import { db } from "@/lib/prisma"

export async function syncContactRoleFromDeals(contactId: string): Promise<void> {
  const deals = await db.deal.findMany({
    where: { contactId, archivedAt: null },
    select: { dealType: true, stage: true, outcome: true },
  })

  let nextRole: ClientType | null = null

  if (deals.length === 0) {
    nextRole = null
  } else {
    const hasActiveBuyerRep = deals.some(
      (d) => d.dealType === "buyer_rep" && d.stage !== "closed"
    )
    const hasActiveListing = deals.some(
      (d) => d.dealType === "seller_rep" && d.stage !== "closed"
    )
    const allClosed = deals.every((d) => d.stage === "closed")
    const anyWon = deals.some((d) => d.outcome === "won")

    if (hasActiveBuyerRep) nextRole = "active_buyer_rep_client"
    else if (hasActiveListing) nextRole = "active_listing_client"
    else if (allClosed && anyWon) nextRole = "past_client"
    else nextRole = "prospect"
  }

  await db.contact.update({
    where: { id: contactId },
    data: { clientType: nextRole },
  })
}
```

- [ ] **Step 4: Run tests, commit**

```bash
cd full-kit && pnpm test src/lib/contacts/sync-contact-role.test.ts
git add full-kit/src/lib/contacts/sync-contact-role.ts full-kit/src/lib/contacts/sync-contact-role.test.ts
git commit -m "feat(contacts): syncContactRoleFromDeals derives clientType from deals"
```

### Task 9.3: Wire sync into the deal mutation paths

- [ ] **Step 1: Modify upsertDealForLead in `lead-to-deal.ts`**

After the Communication update block (whether on existing-link or create), call:

```typescript
import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"

// ...at end of function, before return:
await syncContactRoleFromDeals(input.contactId)
```

- [ ] **Step 2: Modify moveDealStageFromAction in `agent-actions-deal.ts`**

After updating the deal, look up the deal's contactId and call sync:

```typescript
const dealAfter = await db.deal.findUnique({
  where: { id: payload.dealId },
  select: { contactId: true },
})
if (dealAfter) await syncContactRoleFromDeals(dealAfter.contactId)
```

- [ ] **Step 3: Update existing tests for both functions to assert sync was called**

(Add assertions in the existing test files.)

- [ ] **Step 4: Run all tests, commit**

```bash
cd full-kit && pnpm test src/lib/deals src/lib/ai
git add full-kit/src/lib/deals/lead-to-deal.ts full-kit/src/lib/ai/agent-actions-deal.ts \
  full-kit/src/lib/deals/lead-to-deal.test.ts full-kit/src/lib/ai/agent-actions-deal.test.ts
git commit -m "feat(deals): sync Contact.clientType on deal create + stage move"
```

### Task 9.4: One-shot backfill of clientType against existing contacts

- [ ] **Step 1: Add a script**

Create `full-kit/scripts/backfill-contact-client-type.mjs`:

```javascript
import { PrismaClient } from "@prisma/client"
import { syncContactRoleFromDeals } from "../src/lib/contacts/sync-contact-role.js"

const db = new PrismaClient()

async function main() {
  const contacts = await db.contact.findMany({ select: { id: true } })
  console.log(`Syncing ${contacts.length} contacts`)
  for (const c of contacts) {
    await syncContactRoleFromDeals(c.id)
  }
  console.log("done")
}

main()
  .catch((e) => {
    console.error(e); process.exitCode = 1
  })
  .finally(() => db.$disconnect())
```

- [ ] **Step 2: Run it**

```bash
cd full-kit && set -a && source .env.local && set +a && node scripts/backfill-contact-client-type.mjs
```

- [ ] **Step 3: Spot-check distribution**

```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const grouped = await db.contact.groupBy({
    by: ['clientType'], _count: { _all: true }
  });
  console.log(grouped);
  await db.\$disconnect();
});"
```

- [ ] **Step 4: Commit**

```bash
git add full-kit/scripts/backfill-contact-client-type.mjs
git commit -m "feat(scripts): backfill clientType on existing contacts"
```

---

# Phase 10: Buyer-rep deal detection from email signals

**Depends on:** Phase 1, Phase 7. Parallel-safe with Phases 8, 9.

**Why this phase:** Buyer-rep deals (where Matt represents the buyer/tenant hunting for a property) live entirely in email today. Empirical signals identified: tour-scheduling outbound to non-NAI broker domains (~70-80% precision), and LOI-drafting outbound (~85% precision). These auto-create `dealType="buyer_rep"` Deals at appropriate stages.

**Files:**
- Create: `full-kit/src/lib/deals/buyer-rep-detector.ts`
- Create: `full-kit/src/lib/deals/buyer-rep-detector.test.ts`
- Modify: `full-kit/src/lib/ai/scrub-applier.ts` (call detector for outbound emails)

### Task 10.1: Test-first — buyer-rep signal classifier

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest"

import {
  classifyBuyerRepSignal,
  isExternalBrokerDomain,
} from "./buyer-rep-detector"

describe("isExternalBrokerDomain", () => {
  it("returns false for internal NAI", () => {
    expect(isExternalBrokerDomain("partner@naibusinessproperties.com")).toBe(false)
  })

  it("returns true for known peer-broker domains", () => {
    expect(isExternalBrokerDomain("anyone@cushwake.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@jll.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@colliers.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@cbre.com")).toBe(true)
  })

  it("returns false for client-looking domains", () => {
    expect(isExternalBrokerDomain("client@gmail.com")).toBe(false)
  })
})

describe("classifyBuyerRepSignal", () => {
  it("classifies tour scheduling as 'tour'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Re: Tour scheduling for 2621 Overland",
      body: "Can we schedule the showing for Tuesday at 2pm?",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toEqual("tour")
    expect(result.proposedStage).toEqual("showings")
  })

  it("classifies LOI drafting as 'loi'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "LOI draft for 303 N Broadway — please review",
      body: "Attached is the letter of intent for our review.",
      recipientDomains: ["cushwake.com"],
    })
    expect(result.signalType).toEqual("loi")
    expect(result.proposedStage).toEqual("offer")
  })

  it("returns null for inbound emails (signals are outbound-only)", () => {
    const result = classifyBuyerRepSignal({
      direction: "inbound",
      subject: "Re: Tour scheduling",
      body: "...",
      recipientDomains: [],
    })
    expect(result.signalType).toBeNull()
  })

  it("returns null when recipient is internal NAI", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Re: Tour scheduling",
      body: "...",
      recipientDomains: ["naibusinessproperties.com"],
    })
    expect(result.signalType).toBeNull()
  })
})
```

- [ ] **Step 2: Run (expect fail)**

Run: `cd full-kit && pnpm test src/lib/deals/buyer-rep-detector.test.ts`

### Task 10.2: Implement detector

```typescript
import type { DealStage } from "@prisma/client"

const KNOWN_BROKER_DOMAINS = new Set([
  "cushwake.com",
  "cushmanwakefield.com",
  "jll.com",
  "colliers.com",
  "cbre.com",
  "marcusmillichap.com",
  "newmark.com",
  "kwcommercial.com",
  "sior.com",
  "sperrycga.com",
])

const NAI_DOMAINS = new Set(["naibusinessproperties.com"])

const TOUR_PATTERNS = [
  /\b(tour|showing|walk[\s-]?through)\b/i,
  /\b(schedule|available|time slot)\b/i,
]

const LOI_PATTERNS = [
  /\bLOI\b/,
  /\bletter of intent\b/i,
  /\boffer (sheet|draft)\b/i,
]

export function isExternalBrokerDomain(emailOrDomain: string): boolean {
  const lower = emailOrDomain.toLowerCase()
  const domain = lower.includes("@") ? lower.split("@")[1] : lower
  if (NAI_DOMAINS.has(domain)) return false
  if (KNOWN_BROKER_DOMAINS.has(domain)) return true
  return false
}

export type BuyerRepSignalInput = {
  direction: "inbound" | "outbound"
  subject: string
  body: string
  recipientDomains: string[]
}

export type BuyerRepSignalResult = {
  signalType: "tour" | "loi" | null
  proposedStage: DealStage | null
  confidence: number
}

export function classifyBuyerRepSignal(
  input: BuyerRepSignalInput
): BuyerRepSignalResult {
  if (input.direction !== "outbound") {
    return { signalType: null, proposedStage: null, confidence: 0 }
  }
  const allInternal = input.recipientDomains.every((d) =>
    NAI_DOMAINS.has(d.toLowerCase())
  )
  if (allInternal || input.recipientDomains.length === 0) {
    return { signalType: null, proposedStage: null, confidence: 0 }
  }

  const text = `${input.subject}\n${input.body}`
  if (LOI_PATTERNS.some((re) => re.test(text))) {
    return { signalType: "loi", proposedStage: "offer", confidence: 0.85 }
  }
  if (
    TOUR_PATTERNS[0].test(text) &&
    TOUR_PATTERNS[1].test(text)
  ) {
    return { signalType: "tour", proposedStage: "showings", confidence: 0.75 }
  }
  return { signalType: null, proposedStage: null, confidence: 0 }
}
```

- [ ] **Step 1: Run tests, commit**

```bash
cd full-kit && pnpm test src/lib/deals/buyer-rep-detector.test.ts
git add full-kit/src/lib/deals/buyer-rep-detector.ts full-kit/src/lib/deals/buyer-rep-detector.test.ts
git commit -m "feat(deals): add buyer-rep signal detector for tour and LOI emails"
```

### Task 10.3: Buyer-rep deal-create proposal action

**Files:**
- Create: `full-kit/src/lib/deals/buyer-rep-action.ts`
- Create: `full-kit/src/lib/deals/buyer-rep-action.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { proposeBuyerRepDeal } from "./buyer-rep-action"

vi.mock("@/lib/prisma", () => ({
  db: {
    agentAction: { create: vi.fn() },
  },
}))

describe("proposeBuyerRepDeal", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a create-deal AgentAction at tier=approve for tour signal", async () => {
    db.agentAction.create.mockResolvedValue({ id: "action-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-1",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "create-deal",
        status: "pending",
        tier: "approve",
        sourceCommunicationId: "comm-1",
        payload: expect.objectContaining({
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
        }),
      }),
    })
  })
})
```

- [ ] **Step 2: Implement**

```typescript
import type { DealStage } from "@prisma/client"

import { db } from "@/lib/prisma"

export type ProposeBuyerRepInput = {
  communicationId: string
  contactId: string
  signalType: "tour" | "loi"
  proposedStage: DealStage
  confidence: number
}

export async function proposeBuyerRepDeal(
  input: ProposeBuyerRepInput
): Promise<{ created: boolean; actionId: string | null }> {
  const action = await db.agentAction.create({
    data: {
      actionType: "create-deal",
      status: "pending",
      tier: "approve",
      sourceCommunicationId: input.communicationId,
      payload: {
        contactId: input.contactId,
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: input.proposedStage,
        signalType: input.signalType,
        confidence: input.confidence,
        reason: `Buyer-rep ${input.signalType} signal detected with confidence ${input.confidence}`,
      },
    },
  })
  return { created: true, actionId: action.id }
}
```

- [ ] **Step 3: Run, commit**

```bash
cd full-kit && pnpm test src/lib/deals/buyer-rep-action.test.ts
git add full-kit/src/lib/deals/buyer-rep-action.ts full-kit/src/lib/deals/buyer-rep-action.test.ts
git commit -m "feat(deals): proposeBuyerRepDeal creates approval-tier create-deal AgentAction"
```

### Task 10.4: Add `create-deal` handler to approveAgentAction

**Files:**
- Modify: `full-kit/src/lib/ai/agent-actions-deal.ts`
- Modify: `full-kit/src/lib/ai/agent-actions.ts` (dispatch)

- [ ] **Step 1: Add tests for createDealFromAction**

```typescript
describe("createDealFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a buyer-rep Deal", async () => {
    db.deal.create.mockResolvedValue({ id: "deal-new" })
    db.agentAction.update.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-1",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          signalType: "tour",
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(db.deal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-1",
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: "showings",
      }),
    })
  })
})
```

- [ ] **Step 2: Implement createDealFromAction**

Append to `agent-actions-deal.ts`:

```typescript
type CreateDealPayload = {
  contactId: string
  dealType: "seller_rep" | "buyer_rep" | "tenant_rep"
  dealSource: "lead_derived" | "buyer_rep_inferred" | "buildout_event" | "ai_suggestion" | "manual"
  stage: DealStage
  propertyKey?: string
  propertyAddress?: string
  searchCriteria?: Record<string, unknown>
  reason: string
}

export async function createDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as CreateDealPayload
  const deal = await db.deal.create({
    data: {
      contactId: payload.contactId,
      dealType: payload.dealType,
      dealSource: payload.dealSource,
      stage: payload.stage,
      propertyKey: payload.propertyKey,
      propertyAddress: payload.propertyAddress,
      searchCriteria: payload.searchCriteria as never,
    },
    select: { id: true },
  })
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })
  await syncContactRoleFromDeals(payload.contactId)
  return { status: "executed", todoId: deal.id, actionId: action.id }
}
```

Add `import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"` at top.

- [ ] **Step 3: Add `create-deal` case to the switch in `agent-actions.ts`**

```typescript
    case "create-deal":
      return createDealFromAction(action, reviewer)
```

Plus the import.

- [ ] **Step 4: Run all tests, commit**

```bash
cd full-kit && pnpm test src/lib/ai src/lib/deals
git add full-kit/src/lib/ai/agent-actions.ts full-kit/src/lib/ai/agent-actions-deal.ts full-kit/src/lib/ai/agent-actions-deal.test.ts
git commit -m "feat(agent-actions): execute create-deal at approval"
```

### Task 10.5: Hook the buyer-rep detector into ingestion

- [ ] **Step 1: Find the right insertion point**

The detector should run on every newly-ingested *outbound* email. Inspect `src/lib/msgraph/persistMessage.ts` (or wherever messages persist) and `src/lib/ai/scrub-applier.ts`. The cleanest insertion point is after the email is persisted and the contact is linked (probably in the same per-message orchestrator).

Run: `grep -rn "direction.*outbound\|persistMessage\|processOneMessage" full-kit/src/lib/msgraph/ | head -10`

- [ ] **Step 2: Add the call**

Insert after the contact is linked:

```typescript
import { classifyBuyerRepSignal } from "@/lib/deals/buyer-rep-detector"
import { proposeBuyerRepDeal } from "@/lib/deals/buyer-rep-action"

// ...inside processOneMessage, after contactId is established:
if (direction === "outbound" && contactId) {
  const signal = classifyBuyerRepSignal({
    direction,
    subject: message.subject ?? "",
    body: message.body ?? "",
    recipientDomains: extractRecipientDomains(message.metadata),
  })
  if (signal.signalType) {
    await proposeBuyerRepDeal({
      communicationId: communication.id,
      contactId,
      signalType: signal.signalType,
      proposedStage: signal.proposedStage,
      confidence: signal.confidence,
    })
  }
}
```

(Define `extractRecipientDomains` as a small local helper that pulls domains from `metadata.toRecipients`.)

- [ ] **Step 3: Run all tests, commit**

```bash
cd full-kit && pnpm test
git add full-kit/src/lib/msgraph/
git commit -m "feat(buyer-rep): propose create-deal from outbound tour/LOI signals"
```

---

# Phase 11: Claude-Code subscription harness for AI scrub

**Parallel-safe with:** Phases 1, 2, 3, 7. Independent of all other phases.

**Why this phase:** Validate AI scrub output quality on 50-100 representative emails at $0 spend before committing to bulk API spend. The scrub-applier and validator are already built — this phase wires them to a JSONL-based input/output pipeline that an in-conversation Claude Code session (Opus, no API key) can drive.

**Files:**
- Create: `full-kit/scripts/scrub-export.mjs`
- Create: `full-kit/scripts/scrub-import.mjs`
- Create: `docs/ai-scrub-validation/README.md`

### Task 11.1: scrub-export.mjs — claim N rows, write JSONL

- [ ] **Step 1: Write export script**

```javascript
// Claims N pending scrub queue rows (or specific communicationIds), builds
// the same perEmailPrompt + globalMemory the real provider uses, and writes
// a JSONL to tmp/scrub-batch-<runId>.jsonl. The Claude Code session reads
// that file and writes a results JSONL.
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/scrub-export.mjs --limit=25 --runId=batch-001
//   node scripts/scrub-export.mjs --communicationIds=id1,id2,id3 --runId=batch-002

import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"
import { claimScrubQueueRows } from "../src/lib/ai/scrub-queue.js"
import { buildPromptInputs } from "../src/lib/ai/scrub.js" // verify export name

const args = process.argv.slice(2)
const limit = Number(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 25
)
const idsArg = args.find((a) => a.startsWith("--communicationIds="))
const ids = idsArg?.split("=")[1]?.split(",") ?? null
const runId =
  args.find((a) => a.startsWith("--runId="))?.split("=")[1] ?? `batch-${Date.now()}`

const db = new PrismaClient()

async function main() {
  const claimed = await claimScrubQueueRows({
    limit,
    ...(ids ? { communicationIds: ids } : {}),
  })
  if (claimed.length === 0) {
    console.log("Nothing to claim.")
    return
  }

  mkdirSync("tmp", { recursive: true })
  const outPath = join("tmp", `scrub-batch-${runId}.jsonl`)
  const lines = []
  for (const claim of claimed) {
    const inputs = await buildPromptInputs(claim.communicationId)
    lines.push(
      JSON.stringify({
        queueRowId: claim.id,
        communicationId: claim.communicationId,
        leaseToken: claim.leaseToken,
        perEmailPrompt: inputs.perEmailPrompt,
        globalMemory: inputs.globalMemory,
        scrubToolSchema: inputs.scrubToolSchema, // copy of SCRUB_TOOL.input_schema
      })
    )
  }
  writeFileSync(outPath, lines.join("\n") + "\n")
  console.log(`Wrote ${lines.length} rows to ${outPath}`)
  console.log(`runId: ${runId}`)
}

main()
  .catch((e) => {
    console.error(e); process.exitCode = 1
  })
  .finally(() => db.$disconnect())
```

If `buildPromptInputs` doesn't exist as an exported name, find the equivalent in `src/lib/ai/scrub.ts` (the function that produces `perEmailPrompt` + `globalMemory` for one communication) and either export it or add a new exported helper that reuses the existing logic.

- [ ] **Step 2: Run export against a small sample**

```bash
cd full-kit && set -a && source .env.local && set +a && node scripts/scrub-export.mjs --limit=5 --runId=smoketest
```

Expected: writes `full-kit/tmp/scrub-batch-smoketest.jsonl` with 5 lines. Each line has all required fields.

- [ ] **Step 3: Inspect a sample line**

```bash
head -c 1000 full-kit/tmp/scrub-batch-smoketest.jsonl | python -c "import sys, json; print(json.dumps(json.loads(sys.stdin.read().split(chr(10))[0]), indent=2))" 2>/dev/null || head -c 1000 full-kit/tmp/scrub-batch-smoketest.jsonl
```

Verify the prompt looks complete (system + user content visible).

- [ ] **Step 4: Commit**

```bash
git add full-kit/scripts/scrub-export.mjs
git commit -m "feat(scripts): scrub-export — claim queue rows, emit JSONL for offline review"
```

### Task 11.2: scrub-import.mjs — feed results JSONL through scrub-applier

```javascript
// Reads tmp/scrub-results-<runId>.jsonl and feeds each row through the
// existing scrub-validator + scrub-applier pipeline. The toolInput is
// validated, then split into scrubOutput + suggestedActions to match
// applyScrubResult's actual signature. No ScrubApiCall row is written
// (that's the real provider's job — the subscription path bypasses
// token-budget tracking entirely; the runId is the audit trail).
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/scrub-import.mjs --runId=batch-001

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"
import { applyScrubResult } from "../src/lib/ai/scrub-applier.js"
import { validateScrubResult } from "../src/lib/ai/scrub-validator.js"

const args = process.argv.slice(2)
const runId = args.find((a) => a.startsWith("--runId="))?.split("=")[1]
if (!runId) {
  console.error("--runId required")
  process.exit(1)
}

const db = new PrismaClient()

async function main() {
  const path = join("tmp", `scrub-results-${runId}.jsonl`)
  const content = readFileSync(path, "utf8")
  const lines = content.split("\n").filter(Boolean)
  console.log(`Importing ${lines.length} results from ${path}`)

  // Real applyScrubResult signature (verified against scrub-applier.ts):
  //   { communicationId, queueRowId, leaseToken, scrubOutput, suggestedActions }
  // — no `modelUsed`, no `usage`. Token logging via ScrubApiCall is the real
  // provider's responsibility (claude.ts / openai.ts call sites). The
  // subscription path bypasses that audit row entirely; the runId in the
  // batch filename + commit history is the equivalent audit trail.

  const counters = { applied: 0, validationFailed: 0, errors: 0 }
  for (const line of lines) {
    try {
      const { queueRowId, communicationId, leaseToken, toolInput } =
        JSON.parse(line)
      const validation = validateScrubResult(toolInput)
      if (!validation.ok) {
        counters.validationFailed++
        console.error(`Validation failed for ${communicationId}:`, validation.errors)
        continue
      }
      // Split the validated tool output into the two shapes applyScrubResult expects.
      // (Inspect scrub-types.ts for the exact field names — `suggestedActions` is the
      // action array; everything else is enrichment that goes into `scrubOutput`.)
      const { suggestedActions = [], ...scrubOutput } = validation.value
      await applyScrubResult({
        queueRowId,
        communicationId,
        leaseToken,
        scrubOutput,
        suggestedActions,
      })
      counters.applied++
    } catch (err) {
      counters.errors++
      console.error("Import error:", err.message)
    }
  }
  console.log(JSON.stringify(counters, null, 2))
}

main()
  .catch((e) => {
    console.error(e); process.exitCode = 1
  })
  .finally(() => db.$disconnect())
```

If the existing scrub-applier doesn't accept `modelUsed` and `usage` as parameters, audit `src/lib/ai/scrub-applier.ts` and either extend the signature (with defaults) or add a new lower-level helper that the scrub-import script calls directly.

- [ ] **Step 1: Save script, commit**

```bash
git add full-kit/scripts/scrub-import.mjs
git commit -m "feat(scripts): scrub-import — apply offline-reviewed scrub results to DB"
```

### Task 11.3: Document the workflow

- [ ] **Step 1: Write `docs/ai-scrub-validation/README.md`**

```markdown
# AI Scrub Validation Workflow (Claude Code subscription path)

## Purpose
Validate AI scrub output quality on 50-100 emails at $0 API spend before committing to a bulk API run.

## Steps

1. **Export a batch:**
   ```
   cd full-kit
   set -a && source .env.local && set +a
   node scripts/scrub-export.mjs --limit=25 --runId=batch-001
   ```
   Produces `tmp/scrub-batch-batch-001.jsonl`.

2. **Process the batch in this Claude Code session:**
   - Read the JSONL.
   - For each row, evaluate the `perEmailPrompt` + `globalMemory` against the `scrubToolSchema` and produce a JSON object matching `record_email_scrub` schema.
   - Write results to `tmp/scrub-results-batch-001.jsonl`, one JSON line per row:
     ```json
     {"queueRowId":"...", "communicationId":"...", "leaseToken":"...", "toolInput":{...}, "modelUsed":"claude-code-opus-4.7"}
     ```

3. **Apply results:**
   ```
   node scripts/scrub-import.mjs --runId=batch-001
   ```

4. **Hand-grade the output:**
   - Open the affected Communications in the dashboard
   - Check the resulting AgentActions in the approval queue
   - Note any cases where the AI proposed wrong actions, missed obvious actions, or hallucinated dates/IDs
   - Record findings in `docs/ai-scrub-validation/run-<runId>.md`

5. **Decide:** if quality is good, proceed to Phase 13 (bulk API backfill). If not, fix the prompt + bump PROMPT_VERSION + re-export.

## Caveats

- Model used here is Opus 4.7, not Haiku 4.5 — output quality will be HIGHER than production. A "looks fine in Claude Code" result is necessary but not sufficient evidence that Haiku will perform.
- **No `ScrubApiCall` audit row is written** for the subscription path. `applyScrubResult` doesn't write that row; the real provider (`claude.ts` / `openai.ts`) does, and we're bypassing both. The `runId` in the batch filenames + the commit log are the equivalent audit trail. Budget tracker is therefore also bypassed.
- The `modelUsed` field in the JSONL is audit metadata only; `applyScrubResult` ignores it. It just records which Claude Code session model produced each row in case we need to compare runs across model versions.
- The cache is cold (no Anthropic prompt-cache hits) — irrelevant for this path but means cache instrumentation should be re-verified before the Phase 13 bulk run.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ai-scrub-validation/README.md
git commit -m "docs: AI scrub validation workflow via Claude Code subscription"
```

---

# Phase 12: Validation sample run (50-100 emails)

**Depends on:** Phases 1-11.

**Why this phase:** Run the harness end-to-end. This is operator-driven (a human plus the Claude Code session) — not subagent-dispatchable.

### Task 12.1: Pick the sample

- [ ] **Step 1: Identify a stratified sample of communicationIds**

Run from full-kit/:
```bash
set -a && source .env.local && set +a && node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const sample = await db.\$queryRaw\`
    (SELECT id FROM communications WHERE channel='email' AND metadata->>'classification'='signal' AND metadata->'scrub' IS NULL ORDER BY random() LIMIT 25)
    UNION ALL
    (SELECT id FROM communications WHERE channel='email' AND metadata->>'classification'='uncertain' AND metadata->'scrub' IS NULL ORDER BY random() LIMIT 25)
  \`;
  console.log(sample.map(r => r.id).join(','));
  await db.\$disconnect();
});" > tmp/validation-ids.txt
```

- [ ] **Step 2: Enqueue these rows into the scrub queue**

```bash
node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const ids = require('fs').readFileSync('tmp/validation-ids.txt', 'utf8').trim().split(',');
  await db.scrubQueue.createMany({
    data: ids.map(id => ({ communicationId: id, status: 'pending' })),
    skipDuplicates: true,
  });
  console.log('enqueued:', ids.length);
  await db.\$disconnect();
});"
```

- [ ] **Step 3: Run scrub-export**

```bash
set -a && source .env.local && set +a
COMM_IDS=$(cat tmp/validation-ids.txt)
node scripts/scrub-export.mjs --communicationIds=$COMM_IDS --runId=validation-001
```

### Task 12.2: Operator-driven step

- [ ] **Step 1 (operator):** open `tmp/scrub-batch-validation-001.jsonl` in the Claude Code session, evaluate each prompt, write results to `tmp/scrub-results-validation-001.jsonl`.

- [ ] **Step 2:** `node scripts/scrub-import.mjs --runId=validation-001`

- [ ] **Step 3 (operator):** review output in dashboard, hand-grade, decide on Phase 13.

---

# Phase 13: Bulk AI scrub backfill (~8K emails via API)

**Depends on:** Phase 12 sign-off.

### Task 13.1: Set the API key + flip provider

- [ ] **Step 1: Add `ANTHROPIC_API_KEY` to `.env.local`**

(Via Vercel dashboard for prod or local file for dev.)

- [ ] **Step 2: Verify the existing scrub-provider routes to Claude when ANTHROPIC_API_KEY is set**

Re-read `src/lib/ai/scrub-provider.ts:11`. Confirm.

### Task 13.2: Backfill the scrub queue + run the batch worker

- [ ] **Step 1: Enqueue all eligible rows**

```bash
cd full-kit && set -a && source .env.local && set +a
curl -X POST -H "x-admin-token: $SCRUB_ADMIN_TOKEN" \
  "$BASE_URL/api/integrations/scrub/backfill?dryRun=false&limit=10000"
```

Or via direct script using `backfillScrubQueue` from `src/lib/ai/scrub-queue.ts`.

- [ ] **Step 2: Verify queue size**

```bash
node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const c = await db.scrubQueue.count({ where: { status: 'pending' } });
  console.log({pending: c});
  await db.\$disconnect();
});"
```

Expected: count near the eligible total from Phase 0 (probably ~6-8K after re-classification).

- [ ] **Step 3: Run the batch worker (existing endpoint)**

Find the existing scrub-batch route (likely `/api/integrations/scrub/run` or similar) and trigger repeatedly until queue drains. Or run a small wrapper script that calls `runScrubBatch` from `src/lib/ai/scrub.ts` in a loop until pending=0.

- [ ] **Step 4: Monitor budget tracker**

Tail the `ScrubApiCall` table for token usage. Stop if cost exceeds expected ceiling ($30 hard cap recommended for an 8K-email run).

- [ ] **Step 5: Once drained, verify scrub coverage**

```bash
node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient();
  const r = await db.\$queryRaw\`
    SELECT COUNT(*) FILTER (WHERE metadata->'scrub' IS NOT NULL)::int AS scrubbed,
           COUNT(*) FILTER (WHERE metadata->>'classification' IN ('signal','uncertain') AND metadata->'scrub' IS NULL)::int AS unscrubbed_eligible
    FROM communications WHERE channel='email'
  \`;
  console.log(r);
  await db.\$disconnect();
});"
```

Expected: `unscrubbed_eligible` near zero.

- [ ] **Step 6: Commit any related infrastructure changes**

```bash
git add ...
git commit -m "ops(scrub): bulk backfill of $N emails completed (run id: $RUN_ID)"
```

---

# Phase 14: Forward ingestion cron + ongoing scrub

**Depends on:** Phase 13.

**Why this phase:** With the historical backfill done, set up the ongoing pull of new mail + scrub on a schedule.

**Files:**
- Modify: `vercel.json` (add cron schedule) OR existing cron config file
- Modify: `full-kit/src/app/api/integrations/email-sync/route.ts` (verify it's idempotent and only pulls delta)

### Task 14.1: Configure cron schedule

- [ ] **Step 1: Find the existing cron config**

Run: `find full-kit -name "vercel.json" -o -name "cron.config*" -o -name "schedule.config*" | head -5`

- [ ] **Step 2: Add a schedule entry**

Add (or modify) to run every 15 minutes:

```json
{
  "crons": [
    {
      "path": "/api/integrations/email-sync",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/integrations/scrub/run",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify the email-sync route exists and works on a delta basis**

Run: `cat full-kit/src/app/api/integrations/email-sync/route.ts`
Confirm it uses `fetchEmailDelta` (per existing commits) so it only pulls new mail, not the full inbox each cron tick.

- [ ] **Step 4: Smoke-test by manually invoking the endpoint**

```bash
curl -X POST -H "x-admin-token: $SCRUB_ADMIN_TOKEN" "$BASE_URL/api/integrations/email-sync"
```

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "ops(cron): schedule email-sync + scrub-run every 15 minutes"
```

---

# Out-of-scope (separate plans)

The following were discussed but are **not** included in this plan:

1. **Buildout API integration**: needed to detect listings that never receive any inquiry, to sync price/description changes, and for full listing-side completeness. Phase 1-13 deliver ~95% of listing-side automation via lead-derived Deal creation. The remaining ~5% (zero-engagement listings) is real but lower-priority. Separate plan.

2. **Plaud / SMS / phone-log ingestion**: not yet in DB. Email is the only signal source for the foreseeable future per current state. Separate plans per channel.

3. **Attachment OCR for LOI/PSA term extraction**: the email-text quantification covers ~50-65% of deal-value signals. Lease rates, cap rates, NOI live in attachments. OCR-based extraction is a separate effort.

4. **Leads UI changes** (Linked Deal badge, Promote-to-Deal button): the data layer in this plan supports it; the UI work is a separate plan once Phase 5 lands.

---

## Self-review checklist

After landing each phase, run:

```bash
cd full-kit && pnpm test
```

Expected: all tests pass. If any pre-existing test starts failing during a phase, the phase isn't done — fix the regression before committing.

After Phase 6, the DB should show:
- 22,597 communications still present
- Some non-zero number of Deals (one per unique propertyKey across the corpus, likely 50-100)
- Some non-zero number of Communications with `dealId`

After Phase 13, the DB should show:
- Most signal+uncertain communications have `metadata.scrub` populated
- A populated `ScrubApiCall` audit log
- Some non-zero number of pending AgentActions (todos, deal stage moves) for review

After Phase 14, an hour-of-real-time should add a few new communications without manual intervention.
