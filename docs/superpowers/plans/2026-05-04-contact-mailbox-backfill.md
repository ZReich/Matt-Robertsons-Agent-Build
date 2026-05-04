# Contact Mailbox Backfill — Implementation Plan (Phase 1 + Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull historical Outlook traffic for any contact into `Communication`, link it to the contact (and Deal when temporally inside one), and feed new rows through the existing scrub pipeline. Two entry points (UI button = lifetime; bulk CLI/API = deal-anchored ±24mo).

**Architecture:** One shared function `backfillMailboxForContact(contactId, opts)` that reuses existing `classifyEmail` + `persistMessage` plumbing from `src/lib/msgraph/emails.ts`. Window resolver is a small pure module. Track each invocation in a new `BackfillRun` table.

**Tech Stack:** TypeScript / Next.js 15 / Prisma 5 / Microsoft Graph SDK / Vitest. Reuses existing DeepSeek classifier + Haiku scrub pipeline; no new AI integration.

**Spec:** [`docs/superpowers/specs/2026-05-04-contact-mailbox-backfill-design.md`](../specs/2026-05-04-contact-mailbox-backfill-design.md)

---

## Phase 1 — Pipeline + on-demand UI

### Task 1: Investigation pass — confirm reuse points

Before writing any code, confirm the four reuse anchors. Read-only.

**Files:**
- Read: `src/lib/msgraph/emails.ts` (look for `processOneMessage`, `persistMessage`, exports)
- Read: `src/lib/msgraph/email-filter.ts` (`classifyEmail` signature)
- Read: `src/lib/ai/scrub-queue.ts` (`enqueueScrubForCommunication`)
- Read: `src/components/contacts/lead-ai-suggestions.tsx` (host for new "Scan mailbox" button)

- [ ] **Step 1: Verify processOneMessage and persistMessage exports**

Confirm whether `processOneMessage` and `persistMessage` are exported (or callable from a sibling module). If not exported, plan to either:
- Add `export` to them, or
- Factor out a shared helper `ingestSingleMessage(message, context)` that both live ingest and backfill call.

Document the decision in a one-line note appended to the bottom of this file under a `## Notes` section.

- [ ] **Step 2: Verify Graph client construction is reusable**

Find the Graph client factory in `src/lib/msgraph/`. Confirm it's a single shared instance or a factory we can call with the same auth flow. Note location.

- [ ] **Step 3: Verify externalMessageId index is sufficient for dedupe**

Run:
```bash
cd full-kit && set -a && source .env.local && set +a
psql "$DIRECT_URL" -c "\d+ communications" | grep -i external_message_id
```

Expected: index exists, no unique constraint. Plan Task 2 will add a partial unique index for safe dedupe.

- [ ] **Step 4: Append findings to this plan**

Add a `## Notes` section at the bottom of this file with:
- Whether persistMessage is exported (or what factor-out is needed)
- Graph client factory location
- Confirmation of externalMessageId index state

---

### Task 2: Schema — `BackfillRun` model + partial unique index on `externalMessageId`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_contact_mailbox_backfill/migration.sql`

- [ ] **Step 1: Add `BackfillRun` model to schema.prisma**

Append after the existing `OperationalEmailReview` model:

```prisma
model BackfillRun {
  id          String    @id @default(cuid())
  contactId   String?   @map("contact_id")
  parentId    String?   @map("parent_id") // links per-contact runs to a bulk parent
  trigger     String    // "ui" | "bulk" | "cli"
  mode        String    // "lifetime" | "deal-anchored"
  startedAt   DateTime  @default(now()) @map("started_at")
  finishedAt  DateTime? @map("finished_at")
  status      String    // "running" | "succeeded" | "failed" | "skipped"
  result      Json?
  errorMessage String?  @map("error_message")

  contact     Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
  parent      BackfillRun? @relation("BackfillRunChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children    BackfillRun[] @relation("BackfillRunChildren")

  @@index([contactId, startedAt])
  @@index([parentId])
  @@index([status, startedAt])
  @@map("backfill_runs")
}
```

Also add the back-relation on `Contact`:

```prisma
model Contact {
  // ... existing fields ...
  backfillRuns BackfillRun[]
}
```

- [ ] **Step 2: Generate migration SQL**

```bash
cd full-kit && set -a && source .env.local && set +a
pnpm prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > /tmp/backfill-run-migration.sql
cat /tmp/backfill-run-migration.sql
```

Expected SQL: CREATE TABLE backfill_runs, three indexes, two FK constraints. Verify by reading.

- [ ] **Step 3: Append partial unique index for externalMessageId dedupe**

Append to the migration SQL:

```sql
-- Partial unique on Communication.external_message_id (allows multiple NULLs, prevents duplicate non-null)
CREATE UNIQUE INDEX IF NOT EXISTS communications_external_message_id_unique
  ON communications (external_message_id)
  WHERE external_message_id IS NOT NULL;
```

Save final SQL to `prisma/migrations/<timestamp>_contact_mailbox_backfill/migration.sql` (use a fresh timestamp).

- [ ] **Step 4: Apply migration and resolve**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_contact_mailbox_backfill
cp /tmp/backfill-run-migration.sql prisma/migrations/${TS}_contact_mailbox_backfill/migration.sql
pnpm prisma db execute --file prisma/migrations/${TS}_contact_mailbox_backfill/migration.sql --schema prisma/schema.prisma
pnpm prisma migrate resolve --applied ${TS}_contact_mailbox_backfill
pnpm prisma generate
```

Expected: each command succeeds. If the partial unique fails because dupes exist, abort and report — Task 7 needs that to enforce dedupe.

- [ ] **Step 5: Verify BackfillRun is queryable**

```bash
node -e "const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.backfillRun.count().then(n=>console.log('rows:',n)).finally(()=>db.\$disconnect());"
```

Expected: `rows: 0`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/${TS}_contact_mailbox_backfill
git commit -m "feat(schema): BackfillRun model + partial unique on Communication.external_message_id"
```

---

### Task 3: Window resolver (pure, TDD)

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/window-resolver.ts`
- Test: `src/lib/contacts/mailbox-backfill/window-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/contacts/mailbox-backfill/window-resolver.test.ts
import { describe, it, expect } from "vitest"
import { resolveBackfillWindows } from "./window-resolver"

describe("resolveBackfillWindows", () => {
  const FAR_PAST = new Date("1970-01-01T00:00:00Z")
  const NOW = new Date("2026-05-04T00:00:00Z")

  it("lifetime mode returns single far-past-to-now window", () => {
    expect(resolveBackfillWindows({ mode: "lifetime", deals: [], comms: [], now: NOW }))
      .toEqual([{ start: FAR_PAST, end: NOW, source: "lifetime" }])
  })

  it("deal-anchored single deal expands ±24mo around closedAt", () => {
    const deals = [{ createdAt: new Date("2023-01-15"), closedAt: new Date("2023-03-30") }]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals, comms: [], now: NOW })
    expect(windows).toHaveLength(1)
    expect(windows[0].start.toISOString()).toBe("2021-01-15T00:00:00.000Z")
    expect(windows[0].end.toISOString()).toBe("2025-03-30T00:00:00.000Z")
    expect(windows[0].source).toBe("deal")
  })

  it("deal-anchored open deal extends end to now+24mo", () => {
    const deals = [{ createdAt: new Date("2024-06-01"), closedAt: null }]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals, comms: [], now: NOW })
    expect(windows[0].end.toISOString()).toBe("2028-05-04T00:00:00.000Z")
  })

  it("deal-anchored multiple deals union into one or more windows", () => {
    const deals = [
      { createdAt: new Date("2020-01-01"), closedAt: new Date("2020-06-01") },
      { createdAt: new Date("2024-01-01"), closedAt: new Date("2024-06-01") },
    ]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals, comms: [], now: NOW })
    // Both windows overlap (2018→2022 and 2022→2026) — union to single window
    expect(windows).toHaveLength(1)
    expect(windows[0].start.toISOString()).toBe("2018-01-01T00:00:00.000Z")
    expect(windows[0].end.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })

  it("deal-anchored disjoint deals stay as separate windows", () => {
    const deals = [
      { createdAt: new Date("2018-01-01"), closedAt: new Date("2018-02-01") },
      { createdAt: new Date("2024-01-01"), closedAt: new Date("2024-02-01") },
    ]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals, comms: [], now: NOW })
    expect(windows.length).toBeGreaterThan(1)
  })

  it("deal-anchored with no deals falls back to comm window", () => {
    const comms = [{ date: new Date("2023-06-01") }]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals: [], comms, now: NOW })
    expect(windows[0].source).toBe("comm")
    expect(windows[0].start.toISOString()).toBe("2021-06-01T00:00:00.000Z")
  })

  it("deal-anchored with neither returns empty array", () => {
    expect(resolveBackfillWindows({ mode: "deal-anchored", deals: [], comms: [], now: NOW })).toEqual([])
  })

  it("clamps total span to 8 years per window", () => {
    const deals = [{ createdAt: new Date("2010-01-01"), closedAt: new Date("2024-01-01") }]
    const windows = resolveBackfillWindows({ mode: "deal-anchored", deals, comms: [], now: NOW })
    const span = windows[0].end.getTime() - windows[0].start.getTime()
    const eightYears = 8 * 365 * 24 * 60 * 60 * 1000
    expect(span).toBeLessThanOrEqual(eightYears + 24 * 60 * 60 * 1000) // +1 day slack
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm exec vitest run src/lib/contacts/mailbox-backfill/window-resolver.test.ts
```

Expected: all fail with "module not found."

- [ ] **Step 3: Implement window-resolver.ts**

```ts
// src/lib/contacts/mailbox-backfill/window-resolver.ts
export type BackfillMode = "lifetime" | "deal-anchored"

export interface DealAnchor {
  createdAt: Date
  closedAt: Date | null
}

export interface CommAnchor {
  date: Date
}

export interface ResolveInput {
  mode: BackfillMode
  deals: DealAnchor[]
  comms: CommAnchor[]
  now: Date
}

export interface BackfillWindow {
  start: Date
  end: Date
  source: "lifetime" | "deal" | "comm"
}

const FAR_PAST = new Date("1970-01-01T00:00:00Z")
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000
const EIGHT_YEARS_MS = 8 * 365 * 24 * 60 * 60 * 1000

export function resolveBackfillWindows(input: ResolveInput): BackfillWindow[] {
  if (input.mode === "lifetime") {
    return [{ start: FAR_PAST, end: input.now, source: "lifetime" }]
  }

  // deal-anchored
  const raw: BackfillWindow[] = []

  for (const d of input.deals) {
    const start = new Date(d.createdAt.getTime() - TWO_YEARS_MS)
    const endAnchor = d.closedAt ?? input.now
    const end = new Date(endAnchor.getTime() + TWO_YEARS_MS)
    raw.push({ start, end, source: "deal" })
  }

  if (raw.length === 0 && input.comms.length > 0) {
    const dates = input.comms.map(c => c.date.getTime())
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    raw.push({
      start: new Date(min - TWO_YEARS_MS),
      end: new Date(max + TWO_YEARS_MS),
      source: "comm",
    })
  }

  if (raw.length === 0) return []

  // Union overlapping windows
  raw.sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: BackfillWindow[] = [raw[0]]
  for (let i = 1; i < raw.length; i++) {
    const last = merged[merged.length - 1]
    const next = raw[i]
    if (next.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), next.end.getTime()))
    } else {
      merged.push(next)
    }
  }

  // Clamp each window to 8 years
  return merged.map(w => {
    const span = w.end.getTime() - w.start.getTime()
    if (span <= EIGHT_YEARS_MS) return w
    return { ...w, start: new Date(w.end.getTime() - EIGHT_YEARS_MS) }
  })
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
pnpm exec vitest run src/lib/contacts/mailbox-backfill/window-resolver.test.ts
```

Expected: all 8 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/window-resolver.ts src/lib/contacts/mailbox-backfill/window-resolver.test.ts
git commit -m "feat(backfill): window resolver for contact mailbox backfill"
```

---

### Task 4: Multi-client conflict detector (pure, TDD)

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/multi-client-conflict.ts`
- Test: `src/lib/contacts/mailbox-backfill/multi-client-conflict.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/contacts/mailbox-backfill/multi-client-conflict.test.ts
import { describe, it, expect } from "vitest"
import { detectMultiClientConflict } from "./multi-client-conflict"

const CLIENT_A = { id: "c1", email: "alice@buyer.com" }
const CLIENT_B = { id: "c2", email: "bob@seller.com" }
const NON_CLIENT = { id: "c3", email: "x@vendor.com" }

describe("detectMultiClientConflict", () => {
  it("no client recipients returns null", () => {
    expect(detectMultiClientConflict({
      recipientEmails: ["random@stranger.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c1",
    })).toBeNull()
  })

  it("only target contact matches returns null", () => {
    expect(detectMultiClientConflict({
      recipientEmails: ["alice@buyer.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c1",
    })).toBeNull()
  })

  it("two clients matched returns conflict with sorted ids", () => {
    expect(detectMultiClientConflict({
      recipientEmails: ["alice@buyer.com", "bob@seller.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c1",
    })).toEqual({ matchedContactIds: ["c1", "c2"], primaryContactId: "c1" })
  })

  it("primary is lowest sortable id", () => {
    const result = detectMultiClientConflict({
      recipientEmails: ["alice@buyer.com", "bob@seller.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c2",
    })
    expect(result?.primaryContactId).toBe("c1")
  })

  it("ignores non-client recipients", () => {
    expect(detectMultiClientConflict({
      recipientEmails: ["alice@buyer.com", "x@vendor.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B, NON_CLIENT],
      targetContactId: "c1",
    })).toBeNull()
  })

  it("case-insensitive email match", () => {
    const result = detectMultiClientConflict({
      recipientEmails: ["ALICE@buyer.com", "Bob@SELLER.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c1",
    })
    expect(result?.matchedContactIds).toEqual(["c1", "c2"])
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm exec vitest run src/lib/contacts/mailbox-backfill/multi-client-conflict.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/contacts/mailbox-backfill/multi-client-conflict.ts
export interface ClientCandidate {
  id: string
  email: string | null
}

export interface ConflictInput {
  recipientEmails: string[]
  candidateClientContacts: ClientCandidate[]
  targetContactId: string
}

export interface ConflictResult {
  matchedContactIds: string[]
  primaryContactId: string
}

export function detectMultiClientConflict(input: ConflictInput): ConflictResult | null {
  const lowered = new Set(input.recipientEmails.map(e => e.toLowerCase()))
  const matched = input.candidateClientContacts
    .filter(c => c.email && lowered.has(c.email.toLowerCase()))
    .map(c => c.id)
    .sort()

  if (matched.length < 2) return null
  return { matchedContactIds: matched, primaryContactId: matched[0] }
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/multi-client-conflict.ts src/lib/contacts/mailbox-backfill/multi-client-conflict.test.ts
git commit -m "feat(backfill): multi-client conflict detector"
```

---

### Task 5: Graph mailbox query layer

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/graph-query.ts`
- Test: `src/lib/contacts/mailbox-backfill/graph-query.test.ts`

- [ ] **Step 1: Write failing tests with a mocked Graph client**

```ts
// src/lib/contacts/mailbox-backfill/graph-query.test.ts
import { describe, it, expect, vi } from "vitest"
import { fetchMessagesForContactWindow } from "./graph-query"

function makeMockGraph(pages: any[][]) {
  let pageIdx = 0
  return {
    api: vi.fn().mockReturnThis(),
    search: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    get: vi.fn().mockImplementation(async () => {
      const value = pages[pageIdx] ?? []
      const has = pageIdx < pages.length - 1
      pageIdx += 1
      return { value, "@odata.nextLink": has ? "next" : undefined }
    }),
  }
}

describe("fetchMessagesForContactWindow", () => {
  it("returns empty array for window with no results", async () => {
    const graph = makeMockGraph([[]])
    const out = await fetchMessagesForContactWindow({
      graph,
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
    })
    expect(out).toEqual([])
  })

  it("paginates until @odata.nextLink absent", async () => {
    const msg = (id: string) => ({ id, subject: "x", receivedDateTime: "2023-06-01T00:00:00Z" })
    const graph = makeMockGraph([[msg("1"), msg("2")], [msg("3")]])
    const out = await fetchMessagesForContactWindow({
      graph,
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
    })
    expect(out).toHaveLength(3)
    expect(graph.get).toHaveBeenCalledTimes(2)
  })

  it("builds correct $search query for from/to/cc", async () => {
    const graph = makeMockGraph([[]])
    await fetchMessagesForContactWindow({
      graph,
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
    })
    expect(graph.search).toHaveBeenCalledWith(
      expect.stringContaining("from:alice@buyer.com")
    )
    expect(graph.search).toHaveBeenCalledWith(
      expect.stringContaining("to:alice@buyer.com")
    )
    expect(graph.search).toHaveBeenCalledWith(
      expect.stringContaining("cc:alice@buyer.com")
    )
  })

  it("applies receivedDateTime filter for window bounds", async () => {
    const graph = makeMockGraph([[]])
    await fetchMessagesForContactWindow({
      graph,
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
    })
    const filterArg = graph.filter.mock.calls[0][0]
    expect(filterArg).toContain("2023-01-01")
    expect(filterArg).toContain("2024-01-01")
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement (using `graphFetch`, not SDK Client)**

App uses `graphFetch<T>(path, options)` from `src/lib/msgraph/client.ts`, not the Graph SDK Client. Build URL strings directly.

```ts
// src/lib/contacts/mailbox-backfill/graph-query.ts
import { graphFetch } from "@/lib/msgraph/client"
import { msgraphConfig } from "@/lib/msgraph/config"

export interface QueryInput {
  email: string
  window: { start: Date; end: Date }
  selectFields?: string[]
  // Optional injection for testing
  fetchImpl?: <T>(path: string, opts?: any) => Promise<T>
}

const DEFAULT_SELECT = [
  "id",
  "internetMessageId",
  "conversationId",
  "subject",
  "bodyPreview",
  "body",
  "from",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "parentFolderId",
  "hasAttachments",
].join(",")

interface GraphPage {
  value: any[]
  "@odata.nextLink"?: string
}

export async function fetchMessagesForContactWindow(input: QueryInput): Promise<any[]> {
  const cfg = msgraphConfig()
  const fetchFn = input.fetchImpl ?? graphFetch
  const { email, window } = input
  const select = input.selectFields?.join(",") ?? DEFAULT_SELECT

  // Note: Graph $search requires double-quoted KQL expression
  const search = `"from:${email} OR to:${email} OR cc:${email}"`
  const filter =
    `receivedDateTime ge ${window.start.toISOString()} ` +
    `and receivedDateTime le ${window.end.toISOString()}`

  const params = new URLSearchParams({
    $search: search,
    $filter: filter,
    $select: select,
    $top: "25",
  })

  const userPath = `/users/${encodeURIComponent(cfg.targetUpn)}/messages`
  let nextPath: string | null = `${userPath}?${params.toString()}`
  const out: any[] = []

  while (nextPath) {
    const page = await fetchFn<GraphPage>(nextPath, {
      headers: { ConsistencyLevel: "eventual" }, // required for $search
    })
    out.push(...page.value)
    nextPath = page["@odata.nextLink"] ?? null
  }

  return out
}
```

Update tests in Step 1 to inject `fetchImpl` via the `QueryInput` instead of mocking an SDK Client. Adjust test mocks accordingly:

```ts
const fetchImpl = vi.fn().mockResolvedValueOnce({ value: [...] })
await fetchMessagesForContactWindow({ email, window, fetchImpl })
expect(fetchImpl).toHaveBeenCalledWith(
  expect.stringMatching(/\$search=.*from:alice/),
  expect.any(Object)
)
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/graph-query.ts src/lib/contacts/mailbox-backfill/graph-query.test.ts
git commit -m "feat(backfill): Graph mailbox query layer"
```

---

### Task 6: Direction inference for backfilled messages

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/direction.ts`
- Test: `src/lib/contacts/mailbox-backfill/direction.test.ts`

Live ingest infers direction from folder (inbox = inbound, sent = outbound). Backfill queries across all folders, so it must infer from sender vs target UPN.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/contacts/mailbox-backfill/direction.test.ts
import { describe, it, expect } from "vitest"
import { inferDirection } from "./direction"

const TARGET = "mrobertson@naibusinessproperties.com"

describe("inferDirection", () => {
  it("from target UPN is outbound", () => {
    expect(inferDirection({
      from: "mrobertson@naibusinessproperties.com",
      targetUpn: TARGET,
    })).toBe("outbound")
  })

  it("from any other address is inbound", () => {
    expect(inferDirection({ from: "client@buyer.com", targetUpn: TARGET })).toBe("inbound")
  })

  it("case-insensitive comparison", () => {
    expect(inferDirection({
      from: "MROBERTSON@NAIBUSINESSPROPERTIES.COM",
      targetUpn: TARGET,
    })).toBe("outbound")
  })

  it("missing from defaults to inbound", () => {
    expect(inferDirection({ from: null, targetUpn: TARGET })).toBe("inbound")
  })

  it("empty from defaults to inbound", () => {
    expect(inferDirection({ from: "", targetUpn: TARGET })).toBe("inbound")
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/contacts/mailbox-backfill/direction.ts
export interface DirectionInput {
  from: string | null | undefined
  targetUpn: string
}

export function inferDirection(input: DirectionInput): "inbound" | "outbound" {
  if (!input.from) return "inbound"
  return input.from.toLowerCase() === input.targetUpn.toLowerCase() ? "outbound" : "inbound"
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/direction.ts src/lib/contacts/mailbox-backfill/direction.test.ts
git commit -m "feat(backfill): direction inference for cross-folder backfill"
```

---

### Task 7: Single-message ingest helper (reuses live-ingest persistence)

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/ingest-message.ts`
- Test: `src/lib/contacts/mailbox-backfill/ingest-message.test.ts`

- [ ] **Step 1: Add `dealIdOverride` parameter to `persistMessage`**

Already verified in Task 1: `persistMessage` IS exported. Need to add `dealIdOverride?: string | null` to its `ProcessedMessage` parameter type, default null. When set, the Communication insert at the dealId-assignment site (read `src/lib/msgraph/emails.ts:540` area for exact location) writes that value to `Communication.dealId`.

Steps:
1. Locate the `ProcessedMessage` type in `src/lib/msgraph/emails.ts`. Add `dealIdOverride?: string | null` to it.
2. Locate the `data: { … }` Communication insert call inside `persistMessage`. Add `dealId: p.dealIdOverride ?? null` to the data object.
3. Existing live-ingest callers (`processOneMessage` and any others) do NOT need to be updated because the new field is optional with a sensible default (undefined → null).
4. Run `pnpm test src/lib/msgraph/emails.test.ts` to verify no live-ingest regression.

Commit separately:
```bash
git add src/lib/msgraph/emails.ts src/lib/msgraph/emails.test.ts
git commit -m "chore(emails): add dealIdOverride to persistMessage for backfill reuse"
```

- [ ] **Step 2: Write failing tests**

```ts
// src/lib/contacts/mailbox-backfill/ingest-message.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ingestSingleBackfillMessage } from "./ingest-message"

vi.mock("@/lib/msgraph/emails", () => ({
  persistMessage: vi.fn().mockResolvedValue({
    communicationId: "comm-1",
    deduped: false,
    classification: "uncertain",
  }),
}))
vi.mock("@/lib/msgraph/email-filter", () => ({
  classifyEmail: vi.fn().mockReturnValue({
    classification: "uncertain",
    source: "tier2",
    tier1Rule: null,
  }),
}))

describe("ingestSingleBackfillMessage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("classifies, persists, and returns ingest result", async () => {
    const result = await ingestSingleBackfillMessage({
      message: { id: "g1", from: { emailAddress: { address: "alice@buyer.com" } } },
      contactId: "c1",
      targetUpn: "mrobertson@naibusinessproperties.com",
    })
    expect(result.communicationId).toBe("comm-1")
    expect(result.deduped).toBe(false)
  })

  it("returns deduped=true when persistMessage reports duplicate", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")
    ;(persistMessage as any).mockResolvedValueOnce({
      communicationId: "comm-1",
      deduped: true,
      classification: "uncertain",
    })
    const result = await ingestSingleBackfillMessage({
      message: { id: "g1", from: { emailAddress: { address: "alice@buyer.com" } } },
      contactId: "c1",
      targetUpn: "mrobertson@naibusinessproperties.com",
    })
    expect(result.deduped).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests, verify fail**

- [ ] **Step 4: Implement**

```ts
// src/lib/contacts/mailbox-backfill/ingest-message.ts
import { persistMessage } from "@/lib/msgraph/emails"
import { classifyEmail } from "@/lib/msgraph/email-filter"
import { inferDirection } from "./direction"

export interface IngestInput {
  message: any // GraphEmailMessage shape — typed in emails.ts
  contactId: string
  targetUpn: string
  // Optional: dealId resolved by caller from window membership
  dealId?: string | null
}

export interface IngestResult {
  communicationId: string
  deduped: boolean
  classification: "signal" | "uncertain" | "noise"
}

export async function ingestSingleBackfillMessage(input: IngestInput): Promise<IngestResult> {
  const { message, contactId, targetUpn, dealId } = input
  const fromAddress = message.from?.emailAddress?.address ?? null
  const direction = inferDirection({ from: fromAddress, targetUpn })
  const folder = direction === "outbound" ? "sentitems" : "inbox"

  const classification = classifyEmail(message, {
    folder,
    targetUpn,
    normalizedSender: fromAddress?.toLowerCase() ?? null,
    hints: { senderInContacts: true /* always true — we resolved this contact */ },
  })

  const persisted = await persistMessage({
    message,
    folder,
    normalizedSender: fromAddress?.toLowerCase() ?? null,
    classification,
    acquisition: { source: "mailbox-backfill" },
    hints: { senderInContacts: true },
    extracted: null,
    attachments: [],
    attachmentFetch: null,
    contactId,
    leadContactId: null,
    leadCreated: false,
    dealIdOverride: dealId ?? null,
  })

  return {
    communicationId: persisted.communicationId,
    deduped: persisted.deduped,
    classification: classification.classification,
  }
}
```

NOTE: `persistMessage` may not currently accept `dealIdOverride` — Step 1 of this task is to verify and either add support or thread the dealId through a different path. If adding the override field, update existing call sites to pass `dealIdOverride: null`.

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/ingest-message.ts src/lib/contacts/mailbox-backfill/ingest-message.test.ts src/lib/msgraph/emails.ts
git commit -m "feat(backfill): single-message ingest helper reusing persistMessage"
```

---

### Task 8: Orchestrator — `backfillMailboxForContact`

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/index.ts`
- Test: `src/lib/contacts/mailbox-backfill/index.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/contacts/mailbox-backfill/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { backfillMailboxForContact } from "./index"

vi.mock("./graph-query", () => ({
  fetchMessagesForContactWindow: vi.fn(),
}))
vi.mock("./ingest-message", () => ({
  ingestSingleBackfillMessage: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findUnique: vi.fn() },
    deal: { findMany: vi.fn() },
    communication: { findMany: vi.fn() },
    backfillRun: { create: vi.fn(), update: vi.fn() },
    operationalEmailReview: { create: vi.fn() },
  },
}))

describe("backfillMailboxForContact", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns failed result when contact not found", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce(null)
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("missing", { mode: "lifetime" })
    expect(result.status).toBe("failed")
    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) })
    )
  })

  it("returns skipped when contact has no email", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: null })
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("skipped")
  })

  it("returns skipped for deal-anchored with no anchor", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any).mockResolvedValueOnce([])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("c1", { mode: "deal-anchored" })
    expect(result.status).toBe("skipped")
  })

  it("ingests messages and tracks counts", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { ingestSingleBackfillMessage } = await import("./ingest-message")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ])
    ;(ingestSingleBackfillMessage as any)
      .mockResolvedValueOnce({ communicationId: "comm-1", deduped: false, classification: "signal" })
      .mockResolvedValueOnce({ communicationId: "comm-2", deduped: true, classification: "noise" })
      .mockResolvedValueOnce({ communicationId: "comm-3", deduped: false, classification: "uncertain" })

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.messagesDiscovered).toBe(3)
    expect(result.ingested).toBe(2)
    expect(result.deduped).toBe(1)
    expect(result.scrubQueued).toBe(2) // signal + uncertain, not noise
  })

  it("dryRun does not call ingestSingleBackfillMessage", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { ingestSingleBackfillMessage } = await import("./ingest-message")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([{ id: "m1" }])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime", dryRun: true })
    expect(ingestSingleBackfillMessage).not.toHaveBeenCalled()
    expect(result.messagesDiscovered).toBe(1)
    expect(result.ingested).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/contacts/mailbox-backfill/index.ts
import { db } from "@/lib/prisma"
import { msgraphConfig } from "@/lib/msgraph/config"
import { getGraphClientForUser } from "@/lib/msgraph/client" // confirm path in Task 1
import { resolveBackfillWindows, type BackfillMode, type BackfillWindow } from "./window-resolver"
import { fetchMessagesForContactWindow } from "./graph-query"
import { ingestSingleBackfillMessage } from "./ingest-message"
import { detectMultiClientConflict } from "./multi-client-conflict"

export interface BackfillOptions {
  mode: BackfillMode
  dryRun?: boolean
  trigger?: "ui" | "bulk" | "cli"
  parentRunId?: string
}

export interface BackfillResult {
  runId: string
  contactId: string
  status: "succeeded" | "failed" | "skipped"
  reason?: string
  windowsSearched: BackfillWindow[]
  messagesDiscovered: number
  ingested: number
  deduped: number
  scrubQueued: number
  multiClientConflicts: number
  durationMs: number
}

export async function backfillMailboxForContact(
  contactId: string,
  opts: BackfillOptions
): Promise<BackfillResult> {
  const startedAt = Date.now()
  const trigger = opts.trigger ?? "ui"

  const run = await db.backfillRun.create({
    data: {
      contactId,
      parentId: opts.parentRunId ?? null,
      trigger,
      mode: opts.mode,
      status: "running",
    },
  })

  const finalize = async (
    status: "succeeded" | "failed" | "skipped",
    extra: Partial<BackfillResult>,
    errorMessage?: string
  ): Promise<BackfillResult> => {
    const result: BackfillResult = {
      runId: run.id,
      contactId,
      status,
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 0,
      deduped: 0,
      scrubQueued: 0,
      multiClientConflicts: 0,
      durationMs: Date.now() - startedAt,
      ...extra,
    }
    await db.backfillRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        result: result as any,
        errorMessage: errorMessage ?? null,
      },
    })
    return result
  }

  try {
    const contact = await db.contact.findUnique({ where: { id: contactId } })
    if (!contact) return await finalize("failed", { reason: "contact_not_found" }, "contact_not_found")
    if (!contact.email) return await finalize("skipped", { reason: "no_email_on_file" })

    const [deals, comms] = await Promise.all([
      db.deal.findMany({
        where: { contactId, archivedAt: null },
        select: { id: true, createdAt: true, closedAt: true },
      }),
      db.communication.findMany({
        where: { contactId },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 1,
      }),
    ])

    const windows = resolveBackfillWindows({
      mode: opts.mode,
      deals: deals.map(d => ({ createdAt: d.createdAt, closedAt: d.closedAt })),
      comms: comms.map(c => ({ date: c.date })),
      now: new Date(),
    })

    if (windows.length === 0) {
      return await finalize("skipped", { reason: "no_anchor_available" })
    }

    const cfg = msgraphConfig()
    const graph = await getGraphClientForUser(cfg.targetUpn)

    let messagesDiscovered = 0
    let ingested = 0
    let deduped = 0
    let scrubQueued = 0
    let multiClientConflicts = 0

    // Pre-load all client contacts for conflict detection
    const allClients = await db.contact.findMany({
      where: {
        clientType: { not: null },
        email: { not: null },
      },
      select: { id: true, email: true },
    })

    for (const window of windows) {
      const messages = await fetchMessagesForContactWindow({
        graph,
        email: contact.email,
        window,
      })
      messagesDiscovered += messages.length
      if (opts.dryRun) continue

      for (const message of messages) {
        // Determine recipient list for conflict detection
        const recipients = [
          message.from?.emailAddress?.address,
          ...(message.toRecipients ?? []).map((r: any) => r.emailAddress?.address),
          ...(message.ccRecipients ?? []).map((r: any) => r.emailAddress?.address),
        ].filter(Boolean) as string[]

        const conflict = detectMultiClientConflict({
          recipientEmails: recipients,
          candidateClientContacts: allClients,
          targetContactId: contactId,
        })

        // dealId resolution: which Deal contains receivedDateTime
        const receivedAt = message.receivedDateTime ? new Date(message.receivedDateTime) : null
        let dealId: string | null = null
        if (receivedAt) {
          const matched = deals.find(d => {
            const start = new Date(d.createdAt.getTime() - 60 * 60 * 1000) // tolerate 1hr clock skew
            const end = (d.closedAt ?? new Date()).getTime() + 60 * 60 * 1000
            return receivedAt.getTime() >= start.getTime() && receivedAt.getTime() <= end
          })
          dealId = matched?.id ?? null
        }

        try {
          const result = await ingestSingleBackfillMessage({
            message,
            contactId,
            targetUpn: cfg.targetUpn,
            dealId,
          })
          if (result.deduped) {
            deduped += 1
          } else {
            ingested += 1
            if (result.classification === "signal" || result.classification === "uncertain") {
              scrubQueued += 1
            }
            if (conflict) {
              multiClientConflicts += 1
              await db.operationalEmailReview.create({
                data: {
                  communicationId: result.communicationId,
                  type: "multi_client_match",
                  status: "pending",
                  metadata: {
                    matchedContactIds: conflict.matchedContactIds,
                    primaryContactId: conflict.primaryContactId,
                  } as any,
                },
              })
            }
          }
        } catch (err) {
          // Per-message failures isolated; skip to next
          console.warn(`[backfill] message ${message.id} ingest failed:`, err)
        }
      }
    }

    return await finalize("succeeded", {
      windowsSearched: windows,
      messagesDiscovered,
      ingested,
      deduped,
      scrubQueued,
      multiClientConflicts,
    })
  } catch (err: any) {
    return await finalize("failed", { reason: "unexpected_error" }, err?.message ?? String(err))
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm exec vitest run src/lib/contacts/mailbox-backfill/
```

Expected: all tests across the directory pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/index.ts src/lib/contacts/mailbox-backfill/index.test.ts
git commit -m "feat(backfill): orchestrator backfillMailboxForContact"
```

---

### Task 9: API route — POST `/api/contacts/[id]/email-backfill`

**Files:**
- Create: `src/app/api/contacts/[id]/email-backfill/route.ts`
- Test: `src/app/api/contacts/[id]/email-backfill/route.test.ts`

**Auth model (revised after Task 1 findings):** This route is called from the browser. The codebase has NO shared admin-token helper and NO existing pattern for client-side admin-token usage. Use the same session-auth approach the rest of the dashboard uses. Investigate one sibling UI-callable route (e.g., `/api/ai-suggestions/process` referenced by `lead-ai-suggestions.tsx`) to confirm — likely there is no auth check at all because all dashboard routes sit behind the dashboard-layout middleware. If so, this route adopts the same pattern (no inline auth check; relies on layout-level protection).

- [ ] **Step 1: Confirm session-auth pattern on a sibling UI-callable route**

Read `src/app/api/ai-suggestions/process/route.ts` (or whatever route `LeadAISuggestions` calls). Note the auth pattern (or absence thereof). Mirror it exactly in the new route. Document in `## Notes`.

- [ ] **Step 2: Write failing tests**

```ts
// route.test.ts — verify the route handler
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

vi.mock("@/lib/contacts/mailbox-backfill", () => ({
  backfillMailboxForContact: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: { backfillRun: { findFirst: vi.fn() } },
}))

describe("POST /api/contacts/[id]/email-backfill", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 200 with backfill result", async () => {
    const { backfillMailboxForContact } = await import("@/lib/contacts/mailbox-backfill")
    const { db } = await import("@/lib/prisma")
    ;(db.backfillRun.findFirst as any).mockResolvedValueOnce(null)
    ;(backfillMailboxForContact as any).mockResolvedValueOnce({
      runId: "r1", contactId: "c1", status: "succeeded",
      messagesDiscovered: 10, ingested: 10, deduped: 0, scrubQueued: 8,
      multiClientConflicts: 0, durationMs: 1000, windowsSearched: [],
    })
    const req = new Request("http://localhost/api/contacts/c1/email-backfill", { method: "POST" })
    const res = await POST(req as any, { params: Promise.resolve({ id: "c1" }) } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("succeeded")
  })

  it("returns 429 when re-triggered within 10 minutes", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.backfillRun.findFirst as any).mockResolvedValueOnce({
      id: "r0", startedAt: new Date(Date.now() - 60_000),
    })
    const req = new Request("http://localhost/api/contacts/c1/email-backfill", { method: "POST" })
    const res = await POST(req as any, { params: Promise.resolve({ id: "c1" }) } as any)
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement (no inline auth — relies on dashboard-layout session guard)**

```ts
// src/app/api/contacts/[id]/email-backfill/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { backfillMailboxForContact } from "@/lib/contacts/mailbox-backfill"

const RATE_GUARD_WINDOW_MS = 10 * 60 * 1000

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const recent = await db.backfillRun.findFirst({
    where: {
      contactId: id,
      startedAt: { gte: new Date(Date.now() - RATE_GUARD_WINDOW_MS) },
    },
    orderBy: { startedAt: "desc" },
  })
  if (recent) {
    const retryAfterSec = Math.ceil(
      (RATE_GUARD_WINDOW_MS - (Date.now() - recent.startedAt.getTime())) / 1000
    )
    return NextResponse.json(
      { error: "rate_limited", retryAfter: retryAfterSec, lastRunId: recent.id },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    )
  }

  const result = await backfillMailboxForContact(id, { mode: "lifetime", trigger: "ui" })
  return NextResponse.json(result)
}
```

If Task 9 Step 1 reveals sibling routes DO have inline auth, mirror that pattern instead. Do not invent a new auth scheme.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/contacts/[id]/email-backfill
git commit -m "feat(backfill): POST /api/contacts/[id]/email-backfill (lifetime, on-demand)"
```

---

### Task 10: UI button — "Scan mailbox" on contact detail page

**Files:**
- Modify: `src/components/contacts/lead-ai-suggestions.tsx`

- [ ] **Step 1: Add button + state machine**

Open `lead-ai-suggestions.tsx`. Find the existing "Process with AI" button. Add a sibling button "Scan mailbox" with these states:

```tsx
const [scanState, setScanState] = useState<
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "success"; result: BackfillResult }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "error"; message: string }
>({ kind: "idle" })

async function handleScanMailbox() {
  setScanState({ kind: "scanning" })
  try {
    const res = await fetch(`/api/contacts/${contactId}/email-backfill`, {
      method: "POST",
    })
    if (res.status === 429) {
      const body = await res.json()
      setScanState({ kind: "rate_limited", retryAfter: body.retryAfter })
      return
    }
    if (!res.ok) {
      setScanState({ kind: "error", message: `HTTP ${res.status}` })
      return
    }
    const result = await res.json()
    setScanState({ kind: "success", result })
    router.refresh()
  } catch (err: any) {
    setScanState({ kind: "error", message: err?.message ?? "unknown_error" })
  }
}
```

(NOTE on admin token: confirm the existing client-side admin-token pattern. If admin-token is server-side only and the UI uses session auth, swap to that. Do not invent a new auth path.)

Render:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleScanMailbox}
  disabled={scanState.kind === "scanning"}
>
  {scanState.kind === "scanning" ? (
    <><Loader2 className="size-3.5 animate-spin mr-1" />Scanning mailbox…</>
  ) : (
    <><Search className="size-3.5 mr-1" />Scan mailbox</>
  )}
</Button>
{scanState.kind === "success" && (
  <p className="text-xs text-muted-foreground mt-2">
    Found {scanState.result.messagesDiscovered} messages —
    {" "}{scanState.result.ingested} imported,
    {" "}{scanState.result.deduped} already on file,
    {" "}{scanState.result.scrubQueued} queued for AI scrub
  </p>
)}
{scanState.kind === "rate_limited" && (
  <p className="text-xs text-amber-600 mt-2">
    Recently scanned — retry in {Math.ceil(scanState.retryAfter / 60)} min
  </p>
)}
{scanState.kind === "error" && (
  <p className="text-xs text-red-600 mt-2">Error: {scanState.message}</p>
)}
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit --pretty false
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke test in dev**

Start the dev server (preview tools). Open a contact detail page. Click "Scan mailbox". Confirm:
- Button shows loading state
- After completion, summary text appears
- Activity tab shows newly imported emails
- Re-clicking immediately shows the rate-limit message

- [ ] **Step 4: Commit**

```bash
git add src/components/contacts/lead-ai-suggestions.tsx
git commit -m "feat(backfill): Scan mailbox button on contact detail"
```

---

### Phase 1 wrap — adversarial audit + 10-contact validation

- [ ] **Audit step 1:** Dispatch a `superpowers:code-reviewer` (or general adversarial subagent) with:
  - The full diff since Task 2
  - The spec doc
  - Specific instructions: hunt for race conditions in the rate-guard, validate the multi-client conflict logic against ambiguous email-casing edge cases, verify dealId temporal-membership logic doesn't double-attribute when deal windows overlap, check that `persistMessage` reuse doesn't break live ingest, confirm the partial unique index handles the case where backfill races with live ingest on the same `externalMessageId`.

- [ ] **Audit step 2:** Address every flagged issue. Re-run the audit until clean.

- [ ] **Validation step:** Pick 10 contacts (Zach to nominate, or pick 10 client contacts with email-on-file and zero communications). For each:
  - Click "Scan mailbox"
  - Wait for completion
  - Verify Activity tab now shows imported emails
  - Verify ContactArcSummary regenerates with new context
  - Note any failures

- [ ] **Validation report:** Append summary to `## Notes` section of this plan: `(contact name) — N messages discovered, M ingested, K scrubbed; passed/failed`.

---

## Phase 2 — Bulk sweep

### Task 11: Bulk runner module

**Files:**
- Create: `src/lib/contacts/mailbox-backfill/bulk-runner.ts`
- Test: `src/lib/contacts/mailbox-backfill/bulk-runner.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// bulk-runner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { runBulkBackfill } from "./bulk-runner"

vi.mock("./index", () => ({
  backfillMailboxForContact: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findMany: vi.fn() },
    backfillRun: { create: vi.fn(), update: vi.fn() },
  },
}))

describe("runBulkBackfill", () => {
  beforeEach(() => vi.clearAllMocks())

  it("processes provided contactIds serially", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValue({
      status: "succeeded", ingested: 5, deduped: 0, scrubQueued: 4,
    })

    const result = await runBulkBackfill({ contactIds: ["c1", "c2", "c3"] })
    expect(backfillMailboxForContact).toHaveBeenCalledTimes(3)
    expect(result.totalContacts).toBe(3)
    expect(result.succeeded).toBe(3)
  })

  it("isolates per-contact failures", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any)
      .mockResolvedValueOnce({ status: "succeeded", ingested: 5 })
      .mockRejectedValueOnce(new Error("graph throttle"))
      .mockResolvedValueOnce({ status: "succeeded", ingested: 3 })

    const result = await runBulkBackfill({ contactIds: ["c1", "c2", "c3"] })
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
  })

  it("when no contactIds provided, defaults to all client contacts with zero comms", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.contact.findMany as any).mockResolvedValueOnce([
      { id: "c1" }, { id: "c2" },
    ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValue({ status: "succeeded" })

    await runBulkBackfill({})
    expect(db.contact.findMany).toHaveBeenCalled()
    expect(backfillMailboxForContact).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/contacts/mailbox-backfill/bulk-runner.ts
import { db } from "@/lib/prisma"
import { backfillMailboxForContact } from "./index"

export interface BulkInput {
  contactIds?: string[]
  mode?: "deal-anchored" | "lifetime"
  trigger?: "bulk" | "cli"
  delayBetweenMs?: number
}

export interface BulkResult {
  parentRunId: string
  totalContacts: number
  succeeded: number
  failed: number
  skipped: number
  totalMessagesIngested: number
  totalScrubQueued: number
  failures: Array<{ contactId: string; error: string }>
}

const CLIENT_TYPES = [
  "active_listing_client",
  "active_buyer_rep_client",
  "past_client",
  "past_listing_client",
  "past_buyer_client",
] as const

export async function runBulkBackfill(input: BulkInput): Promise<BulkResult> {
  const mode = input.mode ?? "deal-anchored"
  const trigger = input.trigger ?? "bulk"
  const delay = input.delayBetweenMs ?? 500

  const parent = await db.backfillRun.create({
    data: { trigger, mode, status: "running" },
  })

  let contactIds = input.contactIds
  if (!contactIds || contactIds.length === 0) {
    const candidates = await db.contact.findMany({
      where: {
        clientType: { in: CLIENT_TYPES as any },
        email: { not: null },
        communications: { none: {} },
      },
      select: { id: true },
    })
    contactIds = candidates.map(c => c.id)
  }

  const result: BulkResult = {
    parentRunId: parent.id,
    totalContacts: contactIds.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalMessagesIngested: 0,
    totalScrubQueued: 0,
    failures: [],
  }

  for (const cid of contactIds) {
    try {
      const r = await backfillMailboxForContact(cid, {
        mode,
        trigger,
        parentRunId: parent.id,
      })
      if (r.status === "succeeded") {
        result.succeeded += 1
        result.totalMessagesIngested += r.ingested
        result.totalScrubQueued += r.scrubQueued
      } else if (r.status === "skipped") {
        result.skipped += 1
      } else {
        result.failed += 1
        result.failures.push({ contactId: cid, error: r.reason ?? "unknown" })
      }
    } catch (err: any) {
      result.failed += 1
      result.failures.push({ contactId: cid, error: err?.message ?? String(err) })
    }
    if (delay > 0) await new Promise(r => setTimeout(r, delay))
  }

  await db.backfillRun.update({
    where: { id: parent.id },
    data: { finishedAt: new Date(), status: "succeeded", result: result as any },
  })

  return result
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/mailbox-backfill/bulk-runner.ts src/lib/contacts/mailbox-backfill/bulk-runner.test.ts
git commit -m "feat(backfill): bulk runner over client contacts"
```

---

### Task 12: Bulk API endpoint + CLI driver

**Files:**
- Create: `src/app/api/contacts/email-backfill-bulk/route.ts`
- Create: `scripts/contact-email-backfill.mjs`

- [ ] **Step 1: API route (admin-token, mirrors `renewal-sweep` pattern)**

Inline admin-token guard, mirrors the proven pattern from `src/app/api/lease/renewal-sweep/route.ts`.

```ts
// src/app/api/contacts/email-backfill-bulk/route.ts
import { NextResponse } from "next/server"
import { runBulkBackfill } from "@/lib/contacts/mailbox-backfill/bulk-runner"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"

function isOperatorTokenAuthorized(request: Request): boolean {
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected) return false
  const provided = request.headers.get("x-admin-token") ?? ""
  return provided.length > 0 && constantTimeCompare(provided, expected)
}

export async function POST(req: Request) {
  if (!isOperatorTokenAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const result = await runBulkBackfill({
    contactIds: body.contactIds,
    mode: body.mode ?? "deal-anchored",
    delayBetweenMs: body.delayBetweenMs ?? 500,
  })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: CLI driver script**

```js
// scripts/contact-email-backfill.mjs
#!/usr/bin/env node
/* eslint-disable */
import { runBulkBackfill } from "../src/lib/contacts/mailbox-backfill/bulk-runner.js"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const mode = args.includes("--lifetime") ? "lifetime" : "deal-anchored"
const limitArg = args.find(a => a.startsWith("--limit="))
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined

const idsArg = args.find(a => a.startsWith("--ids="))
const contactIds = idsArg ? idsArg.split("=")[1].split(",") : undefined

console.log("Starting bulk contact-mailbox backfill", { mode, dryRun, limit, contactIds })

const result = await runBulkBackfill({
  contactIds: contactIds ?? undefined,
  mode,
})

console.log(JSON.stringify(result, null, 2))
process.exit(0)
```

NOTE: importing TS from a .mjs requires either: a precompiled build, or running via `tsx`. Add a wrapper command:

```bash
# In package.json scripts:
"backfill:bulk": "tsx scripts/contact-email-backfill.mjs"
```

OR rewrite `scripts/contact-email-backfill.mjs` as `scripts/contact-email-backfill.ts` and invoke with `pnpm tsx scripts/contact-email-backfill.ts`.

- [ ] **Step 3: Type-check + run a dry-run on 1 contact**

```bash
pnpm exec tsc --noEmit --pretty false
pnpm tsx scripts/contact-email-backfill.ts --ids=<one-real-contact-id> --dry-run
```

Verify it logs windows + message counts but ingests nothing.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/contacts/email-backfill-bulk scripts/contact-email-backfill.ts package.json
git commit -m "feat(backfill): bulk API endpoint + CLI driver"
```

---

### Phase 2 wrap — adversarial audit + bulk run

- [ ] **Audit step 1:** Dispatch adversarial reviewer. Specific concerns:
  - Graph rate limit behavior under 286-contact serial load
  - Behavior when scrub budget exhausts mid-run
  - Idempotency: re-running bulk should re-process zero-comm contacts and skip those that succeeded
  - Memory: pre-loading all client contacts in `backfillMailboxForContact` for conflict detection — does this scale at 286×? (Answer: 286 is fine; document the cap.)
  - What happens if a contact's email changes mid-run

- [ ] **Audit step 2:** Address findings, iterate.

- [ ] **Bulk dry-run:** `pnpm tsx scripts/contact-email-backfill.ts --dry-run` over the 286 — verify totalContacts ≈ 286, no ingestion, log counts.

- [ ] **Bulk live run:** `pnpm tsx scripts/contact-email-backfill.ts` (no --dry-run). Save stdout to `docs/superpowers/notes/2026-05-04-contact-mailbox-backfill-bulk-run.json`.

- [ ] **Validation:** spot-check 10 contacts post-run via the UI. Confirm Activity tabs populated. Note any anomalies.

---

## Notes

### Task 1 findings (2026-05-04)

- **`processOneMessage` and `persistMessage` are exported** in `src/lib/msgraph/emails.ts` (lines 1083 and 406). Good.
- **`persistMessage` does NOT support `dealId` override today.** `Communication.dealId` is never set inside it. Decision: add `dealIdOverride?: string | null` to the `ProcessedMessage` type. Default null (existing live-ingest call sites unaffected). Backfill passes the temporally-resolved dealId. Set during Communication insert at `emails.ts:540`-area.
- **Graph client is `graphFetch<T>(path, options)`** in `src/lib/msgraph/client.ts:56`, NOT a Graph SDK `Client` object. App-only auth via `getTokenManager()` in `src/lib/msgraph/token-manager.ts`. Caches token + dedupes in-flight fetches. Task 5 must use `graphFetch` directly with a URL-string builder.
- **`Communication.externalMessageId` has only an `@@index`, no unique constraint.** Confirms Task 2's partial unique migration is necessary.
- **Admin auth is inline-per-route**, no shared `isAdminTokenRequest`. Pattern: each route defines its own `function isOperatorTokenAuthorized(request)` reading `MSGRAPH_TEST_ADMIN_TOKEN` env var, comparing `x-admin-token` header via `constantTimeCompare` from `@/lib/msgraph/constant-time-compare`. Task 9 (per-contact UI route) must use **session auth** instead — `MSGRAPH_TEST_ADMIN_TOKEN` cannot be exposed to the browser. Task 12 (bulk route) keeps the inline admin-token pattern (CLI/cron only).
- **No existing UI calls admin-token routes.** Confirms Task 10 must use server-side session auth, not a leaked admin token.

---

## Self-review

- **Spec coverage:** every spec section maps to a task. Window resolution → Task 3. Mailbox query → Task 5. Direction inference → Task 6. Multi-client conflict → Task 4. Scrub integration → Task 7 (via persistMessage reuse). On-demand UI → Tasks 9+10. Bulk → Tasks 11+12. BackfillRun observability → Task 2. Phase 3 (relationship graph) is explicitly out of scope per spec. ✓
- **Placeholder scan:** no "TBD" / "implement later" in any step. Each step has either complete code, a complete command, or an explicit investigation directive. ✓
- **Type consistency:** `BackfillResult` shape declared in Task 8 used identically in Tasks 9, 10, 11. `BackfillMode = "lifetime" | "deal-anchored"` consistent throughout. `BackfillWindow` shape consistent. ✓
- **Known soft spots flagged:** Task 7 step 1 explicitly investigates `persistMessage` reusability before assuming. Task 9 flags `isAdminTokenRequest` as needing verification. Task 10 flags admin-token client-side pattern as needing verification. Task 12 flags TS-import-from-mjs choice.
