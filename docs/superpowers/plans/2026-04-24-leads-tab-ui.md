# Leads Tab UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Leads tab — list (filter/search/sort + per-row unread dot), detail (single-page + sidebar with AI-hook slot), status transitions, Contact → vault-Client conversion, and sidebar badge for unread leads.

**Architecture:** Route mirrors `/pages/clients`. List + detail are Server Components with direct Prisma (Contact is the lead entity). Mutations go through `/api/vault/leads` routes. Convert writes a vault-backed Client markdown file via `createNote<ClientMeta>` and flips `leadStatus='converted'`. Unread is computed from already-loaded fields — no separate subquery. `LeadAISuggestions` is a placeholder component with a pinned interface for the AI scrub spec to fill later.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 5 on Postgres (Supabase), TanStack Table v8, shadcn/ui + Radix, Tailwind, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-23-leads-tab-ui-design.md](../specs/2026-04-23-leads-tab-ui-design.md)

---

## File structure

| Path | Responsibility | Status |
|---|---|---|
| `full-kit/prisma/schema.prisma` | Add `Contact.leadLastViewedAt` + composite index | MODIFY |
| `full-kit/src/lib/leads/unread.ts` | Pure `isUnread()` + `unreadLeadsWhere()` helpers | NEW |
| `full-kit/src/lib/leads/unread.test.ts` | Vitest for the pure function | NEW |
| `full-kit/src/lib/leads/count.ts` | Server helper `getUnreadLeadsCount()` | NEW |
| `full-kit/src/app/api/vault/leads/[id]/route.ts` | PATCH leadStatus / notes | NEW |
| `full-kit/src/app/api/vault/leads/[id]/view/route.ts` | POST mark-viewed | NEW |
| `full-kit/src/app/api/vault/leads/[id]/convert/route.ts` | POST lead → vault Client | NEW |
| `full-kit/src/components/leads/inquiry-quote.tsx` | Server — quote block from extractor metadata | NEW |
| `full-kit/src/components/leads/contact-card.tsx` | Server — sidebar contact info | NEW |
| `full-kit/src/components/leads/notes-card.tsx` | Server — sidebar notes display | NEW |
| `full-kit/src/components/leads/lead-activity-timeline.tsx` | Server — reverse-chrono Communication list | NEW |
| `full-kit/src/components/leads/lead-ai-suggestions.tsx` | Server — AI placeholder slot | NEW |
| `full-kit/src/components/leads/mark-viewed-on-mount.tsx` | Client — fires POST view endpoint on mount | NEW |
| `full-kit/src/components/leads/lead-detail-header.tsx` | Client — status buttons + Convert dialog | NEW |
| `full-kit/src/components/leads/leads-table.tsx` | Client — TanStack table + filter pills + search | NEW |
| `full-kit/src/components/leads/lead-row.tsx` | Client — two-line row rendering | NEW |
| `full-kit/src/components/leads/unread-badge.tsx` | Server — sidebar nav count badge | NEW |
| `full-kit/src/components/leads/source-badge.tsx` | Pure — colored source badge | NEW |
| `full-kit/src/components/leads/status-chip.tsx` | Pure — colored status chip | NEW |
| `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/page.tsx` | RSC — list page | NEW |
| `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/[id]/page.tsx` | RSC — detail page | NEW |
| `full-kit/src/data/navigations.ts` | Add "Leads" under People | MODIFY |

---

## Task 1: Schema migration — Contact.leadLastViewedAt

**Files:**
- Modify: `full-kit/prisma/schema.prisma`
- Create: `full-kit/prisma/migrations/<timestamp>_contact_lead_last_viewed_at/migration.sql` (generated)

- [ ] **Step 1: Add the column and composite index to Contact**

Open `full-kit/prisma/schema.prisma`. In the `Contact` model, add `leadLastViewedAt` immediately after the existing `leadAt` line:

```prisma
  leadLastViewedAt DateTime?    @map("lead_last_viewed_at")
```

And add this composite index at the bottom of the Contact model, alongside the existing single-column indexes (keep the existing `@@index([leadSource])`):

```prisma
  @@index([leadSource, leadStatus, leadLastViewedAt])
```

- [ ] **Step 2: Generate the migration**

Run: `cd full-kit && pnpm exec prisma migrate dev --name contact_lead_last_viewed_at`

Expected: Prisma creates the migration file, applies it, regenerates the client. Output contains `Applied migration` and `Generated Prisma Client`.

- [ ] **Step 3: Verify migration SQL**

Open the generated `migration.sql`. Confirm it contains:
- `ALTER TABLE "contacts" ADD COLUMN "lead_last_viewed_at" TIMESTAMP(3)`
- `CREATE INDEX "contacts_lead_source_lead_status_lead_last_viewed_at_idx" ON "contacts"("lead_source", "lead_status", "lead_last_viewed_at")`

- [ ] **Step 4: Verify typecheck passes**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -v "\.pnpm\|duplicate" | head -20`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add full-kit/prisma/schema.prisma full-kit/prisma/migrations/
git commit -m "feat(prisma): add lead_last_viewed_at to Contact

Powers the hybrid unread definition for the Leads tab: a lead is unread
when leadStatus='new' OR it has inbound Communications newer than
leadLastViewedAt. Composite index (leadSource, leadStatus,
leadLastViewedAt) supports the sidebar unread-count query.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure unread helpers + tests

**Files:**
- Create: `full-kit/src/lib/leads/unread.ts`
- Create: `full-kit/src/lib/leads/unread.test.ts`

- [ ] **Step 1: Write the failing test**

Create `full-kit/src/lib/leads/unread.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isUnread } from "./unread";

function comm(
  direction: "inbound" | "outbound",
  minutesAgo: number,
): { direction: "inbound" | "outbound"; date: Date } {
  return {
    direction,
    date: new Date(Date.now() - minutesAgo * 60_000),
  };
}

describe("isUnread", () => {
  it("returns true when leadStatus is 'new' regardless of views", () => {
    expect(
      isUnread({
        leadStatus: "new",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date("2026-04-23T00:00:00Z"),
        communications: [],
      }),
    ).toBe(true);
  });

  it("returns false when status is past 'new' and no new inbound since last view", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(),
        communications: [comm("inbound", 120)], // 2h ago
      }),
    ).toBe(false);
  });

  it("returns true when a new inbound arrived after last view", () => {
    expect(
      isUnread({
        leadStatus: "contacted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(Date.now() - 3 * 3600_000), // 3h ago
        communications: [comm("inbound", 60)], // 1h ago
      }),
    ).toBe(true);
  });

  it("ignores outbound communications for unread computation", () => {
    expect(
      isUnread({
        leadStatus: "contacted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(Date.now() - 3 * 3600_000),
        communications: [comm("outbound", 60)], // 1h ago, outbound
      }),
    ).toBe(false);
  });

  it("when never viewed, uses leadAt as the comparison baseline", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date(Date.now() - 2 * 3600_000), // 2h ago
        leadLastViewedAt: null,
        communications: [comm("inbound", 60)], // 1h ago (after leadAt)
      }),
    ).toBe(true);
  });

  it("returns false when viewed once and no new inbound has arrived", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date(Date.now() - 4 * 3600_000),
        leadLastViewedAt: new Date(Date.now() - 1 * 3600_000), // 1h ago
        communications: [comm("inbound", 3 * 60)], // 3h ago
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd full-kit && pnpm exec vitest run src/lib/leads/unread.test.ts 2>&1 | tail -10`
Expected: FAIL — `isUnread` is not defined (cannot find module `./unread`).

- [ ] **Step 3: Implement `isUnread`**

Create `full-kit/src/lib/leads/unread.ts`:

```ts
import type { LeadStatus } from ".prisma/client";

export interface IsUnreadInput {
  leadStatus: LeadStatus | null;
  leadAt: Date | null;
  leadLastViewedAt: Date | null;
  communications: Array<{
    direction: "inbound" | "outbound";
    date: Date;
  }>;
}

/**
 * A lead is unread when:
 *   - leadStatus is 'new' (not yet triaged), OR
 *   - there's an inbound Communication whose date is after the comparison
 *     baseline (leadLastViewedAt if viewed, else leadAt).
 */
export function isUnread(input: IsUnreadInput): boolean {
  if (input.leadStatus === "new") return true;

  const baseline = input.leadLastViewedAt ?? input.leadAt;
  if (!baseline) return false;

  return input.communications.some(
    (c) => c.direction === "inbound" && c.date > baseline,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd full-kit && pnpm exec vitest run src/lib/leads/unread.test.ts 2>&1 | tail -10`
Expected: `6 passed`.

- [ ] **Step 5: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/unread" | head -5`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add full-kit/src/lib/leads/unread.ts full-kit/src/lib/leads/unread.test.ts
git commit -m "feat(leads): isUnread pure helper

Hybrid unread rule: leadStatus='new' OR inbound Communication newer
than leadLastViewedAt (falls back to leadAt when never viewed). Pure
function so both the list rendering and the sidebar badge query can
share logic via equivalent Prisma where-clause.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Unread-count server helper

**Files:**
- Create: `full-kit/src/lib/leads/count.ts`

- [ ] **Step 1: Implement the helper**

Create `full-kit/src/lib/leads/count.ts`:

```ts
import { db } from "@/lib/prisma";

/**
 * Count leads that are currently unread. Powers the sidebar nav badge.
 *
 * Equivalent to isUnread() in SQL: either leadStatus='new', OR there
 * exists an inbound Communication whose date is newer than the contact's
 * leadLastViewedAt (falling back to leadAt). Only counts leads that are
 * not converted/dropped — those don't need attention.
 */
export async function getUnreadLeadsCount(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM contacts c
    WHERE c.lead_source IS NOT NULL
      AND c.lead_status NOT IN ('converted', 'dropped')
      AND (
        c.lead_status = 'new'
        OR EXISTS (
          SELECT 1 FROM communications m
          WHERE m.contact_id = c.id
            AND m.direction = 'inbound'
            AND m.date > COALESCE(c.lead_last_viewed_at, c.lead_at)
        )
      )
  `;
  return rows[0]?.n ?? 0;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/count" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/leads/count.ts
git commit -m "feat(leads): getUnreadLeadsCount server helper

Single-query unread count for the sidebar badge. Mirrors the isUnread
pure function's rule in raw SQL using the (leadSource, leadStatus,
leadLastViewedAt) composite index plus an EXISTS over communications.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: API route — PATCH /api/vault/leads/[id]

**Files:**
- Create: `full-kit/src/app/api/vault/leads/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `full-kit/src/app/api/vault/leads/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import type { LeadStatus } from ".prisma/client";

const ALLOWED_STATUSES: LeadStatus[] = [
  "new",
  "vetted",
  "contacted",
  "converted",
  "dropped",
];

interface PatchBody {
  leadStatus?: LeadStatus;
  notes?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (body.leadStatus !== undefined && !ALLOWED_STATUSES.includes(body.leadStatus)) {
    return NextResponse.json(
      { error: "invalid leadStatus" },
      { status: 400 },
    );
  }

  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true, leadSource: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 },
    );
  }

  const updated = await db.contact.update({
    where: { id },
    data: {
      ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    select: {
      id: true,
      leadStatus: true,
      notes: true,
    },
  });

  return NextResponse.json({ ok: true, ...updated });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "vault/leads.*\[id\]/route" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/api/vault/leads/[id]/route.ts"
git commit -m "feat(leads): PATCH /api/vault/leads/[id]

Updates a lead's leadStatus and/or notes. Returns 400 on an unknown
status or when the target Contact is not a lead (no leadSource); 404
when the Contact doesn't exist. Does not touch leadLastViewedAt —
viewing is a separate concern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: API route — POST /api/vault/leads/[id]/view

**Files:**
- Create: `full-kit/src/app/api/vault/leads/[id]/view/route.ts`

- [ ] **Step 1: Create the route**

Create `full-kit/src/app/api/vault/leads/[id]/view/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true, leadSource: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 },
    );
  }

  const now = new Date();
  await db.contact.update({
    where: { id },
    data: { leadLastViewedAt: now },
  });

  return NextResponse.json({ ok: true, leadLastViewedAt: now.toISOString() });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "vault/leads.*/view/route" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/api/vault/leads/[id]/view/route.ts"
git commit -m "feat(leads): POST /api/vault/leads/[id]/view

Idempotently sets Contact.leadLastViewedAt = now(). Called by the
MarkViewedOnMount client island on the detail page. Does not flip
leadStatus — only explicit status-action buttons do that.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: API route — POST /api/vault/leads/[id]/convert

**Files:**
- Create: `full-kit/src/app/api/vault/leads/[id]/convert/route.ts`

- [ ] **Step 1: Create the route**

Create `full-kit/src/app/api/vault/leads/[id]/convert/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { createNote, listNotes, type ClientMeta } from "@/lib/vault";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "lead"
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (contact.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 },
    );
  }

  // Idempotency — if a client already exists for this email, return it.
  if (contact.email) {
    const existing = await listNotes<ClientMeta>("clients");
    const match = existing.find(
      (n) =>
        n.meta.type === "client" &&
        n.meta.email?.toLowerCase() === contact.email?.toLowerCase(),
    );
    if (match) {
      await db.contact.update({
        where: { id },
        data: { leadStatus: "converted" },
      });
      return NextResponse.json(
        {
          ok: true,
          alreadyClient: true,
          clientPath: match.path,
        },
        { status: 200 },
      );
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const slug = slugify(contact.name);
  const meta: ClientMeta = {
    type: "client",
    category: "business",
    name: contact.name,
    ...(contact.company ? { company: contact.company } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.phone ? { phone: contact.phone } : {}),
    ...(contact.role ? { role: contact.role } : {}),
    ...(contact.preferredContact
      ? {
          preferred_contact: contact.preferredContact as ClientMeta["preferred_contact"],
        }
      : {}),
    created: today,
  };

  const note = await createNote<ClientMeta>(
    `clients/${slug}`,
    `${contact.name}.md`,
    meta,
    contact.notes ?? "",
  );

  await db.contact.update({
    where: { id },
    data: { leadStatus: "converted" },
  });

  return NextResponse.json(
    { ok: true, alreadyClient: false, clientPath: note.path },
    { status: 201 },
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "vault/leads.*/convert/route" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/api/vault/leads/[id]/convert/route.ts"
git commit -m "feat(leads): POST /api/vault/leads/[id]/convert

Lead → vault Client. Writes a markdown file at clients/<slug>/<name>.md
with ClientMeta frontmatter built from the Contact row, then flips the
Contact's leadStatus to 'converted'. Idempotent via email match — a
second call returns 200 with alreadyClient:true and the existing path.
The Contact row stays put; Client and Contact coexist for the same
person.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Source badge and status chip primitives

**Files:**
- Create: `full-kit/src/components/leads/source-badge.tsx`
- Create: `full-kit/src/components/leads/status-chip.tsx`

- [ ] **Step 1: Create SourceBadge**

Create `full-kit/src/components/leads/source-badge.tsx`:

```tsx
import type { LeadSource } from ".prisma/client";
import { cn } from "@/lib/utils";

const LABELS: Record<LeadSource, string> = {
  crexi: "crexi",
  loopnet: "loopnet",
  buildout: "buildout",
  email_cold: "email",
  referral: "referral",
};

const CLASSES: Record<LeadSource, string> = {
  crexi:
    "bg-orange-500/15 text-orange-500 border-orange-500/35",
  loopnet:
    "bg-blue-500/15 text-blue-500 border-blue-500/35",
  buildout:
    "bg-violet-500/15 text-violet-500 border-violet-500/35",
  email_cold:
    "bg-gray-500/15 text-gray-500 border-gray-500/35",
  referral:
    "bg-teal-500/15 text-teal-500 border-teal-500/35",
};

export function SourceBadge({ source }: { source: LeadSource }): JSX.Element {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CLASSES[source],
      )}
    >
      {LABELS[source]}
    </span>
  );
}
```

- [ ] **Step 2: Create StatusChip**

Create `full-kit/src/components/leads/status-chip.tsx`:

```tsx
import type { LeadStatus } from ".prisma/client";
import { cn } from "@/lib/utils";

const CLASSES: Record<LeadStatus, string> = {
  new:
    "bg-blue-500/15 text-blue-500 border-blue-500/35",
  vetted:
    "bg-muted text-muted-foreground border-border",
  contacted:
    "bg-amber-500/12 text-amber-600 border-amber-500/30",
  converted:
    "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  dropped:
    "bg-muted/50 text-muted-foreground/70 border-border/50",
};

export function StatusChip({ status }: { status: LeadStatus }): JSX.Element {
  return (
    <span
      className={cn(
        "inline-block rounded border px-2 py-0.5 text-[11px]",
        CLASSES[status],
      )}
    >
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/(source-badge|status-chip)" | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/components/leads/source-badge.tsx full-kit/src/components/leads/status-chip.tsx
git commit -m "feat(leads): source-badge and status-chip primitives

Pure, stateless badge components. Color palette matches the brainstorm
mockup: crexi orange, loopnet blue, buildout violet, email gray,
referral teal. Status chip: new blue, vetted muted, contacted amber,
converted emerald, dropped muted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: LeadAISuggestions placeholder component

**Files:**
- Create: `full-kit/src/components/leads/lead-ai-suggestions.tsx`

- [ ] **Step 1: Create the component**

Create `full-kit/src/components/leads/lead-ai-suggestions.tsx`:

```tsx
import { Sparkles } from "lucide-react";

export interface LeadAISuggestionsProps {
  contactId: string;
  /** Reserved for future split of lead vs contact id. Equals contactId today. */
  leadId?: string;
}

/**
 * Placeholder slot for the AI email-scrub spec to fill.
 *
 * v1: empty state only. Future: renders pending AISuggestion rows with
 * approve/dismiss controls. The AI scrub spec adds the AISuggestion
 * model and fills this component in; nothing else on the Leads tab needs
 * to change when that lands.
 */
export function LeadAISuggestions(
  _props: LeadAISuggestionsProps,
): JSX.Element {
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
        <Sparkles className="size-3.5" />
        AI Suggestions
      </div>
      <p className="text-xs italic text-muted-foreground">
        AI suggestions will appear here once this lead is processed.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/lead-ai-suggestions" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/components/leads/lead-ai-suggestions.tsx
git commit -m "feat(leads): LeadAISuggestions placeholder slot

Pins the sidebar AI-hook interface. v1 renders the empty state only;
the AI email-scrub spec will fill in the pending/approved/dismissed
rows without touching the detail-page layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Inquiry quote, contact card, notes card

**Files:**
- Create: `full-kit/src/components/leads/inquiry-quote.tsx`
- Create: `full-kit/src/components/leads/contact-card.tsx`
- Create: `full-kit/src/components/leads/notes-card.tsx`

- [ ] **Step 1: Create InquiryQuote**

Create `full-kit/src/components/leads/inquiry-quote.tsx`:

```tsx
import type { LeadSource } from ".prisma/client";

interface InquiryQuoteProps {
  source: LeadSource;
  /** Extracted inquirer message (preferred), falls back to email body snippet. */
  message: string | null;
}

const ACCENT: Record<LeadSource, string> = {
  crexi: "border-orange-500",
  loopnet: "border-blue-500",
  buildout: "border-violet-500",
  email_cold: "border-gray-500",
  referral: "border-teal-500",
};

export function InquiryQuote({ source, message }: InquiryQuoteProps): JSX.Element {
  if (!message) {
    return (
      <div className="rounded-r-md border-l-4 border-border bg-muted/20 px-4 py-3 text-sm italic text-muted-foreground">
        No inquiry message extracted.
      </div>
    );
  }
  return (
    <blockquote
      className={`rounded-r-md border-l-4 ${ACCENT[source]} bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground`}
    >
      "{message}"
    </blockquote>
  );
}
```

- [ ] **Step 2: Create ContactCard**

Create `full-kit/src/components/leads/contact-card.tsx`:

```tsx
import type { Contact } from ".prisma/client";

interface ContactCardProps {
  contact: Pick<
    Contact,
    "email" | "phone" | "company" | "role" | "leadSource" | "leadAt"
  >;
}

function Row({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function ContactCard({ contact }: ContactCardProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contact
      </div>
      <Row label="Email" value={contact.email} />
      <Row label="Phone" value={contact.phone} />
      <Row label="Company" value={contact.company} />
      <Row label="Role" value={contact.role} />
      <Row
        label="Source"
        value={
          contact.leadSource && contact.leadAt
            ? `${contact.leadSource} · ${contact.leadAt.toLocaleDateString()}`
            : null
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Create NotesCard**

Create `full-kit/src/components/leads/notes-card.tsx`:

```tsx
interface NotesCardProps {
  notes: string | null;
}

export function NotesCard({ notes }: NotesCardProps): JSX.Element {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Notes
      </div>
      {notes && notes.trim().length > 0 ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{notes}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/(inquiry-quote|contact-card|notes-card)" | head -10`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/components/leads/inquiry-quote.tsx full-kit/src/components/leads/contact-card.tsx full-kit/src/components/leads/notes-card.tsx
git commit -m "feat(leads): inquiry-quote, contact-card, notes-card primitives

Three dumb server components that render pieces of the detail page.
InquiryQuote picks an accent color from the lead source; ContactCard
skips rows with null fields; NotesCard shows the Contact.notes text
(plain, not markdown — leads use plain notes, not vault markdown).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: LeadActivityTimeline for Prisma Communications

**Files:**
- Create: `full-kit/src/components/leads/lead-activity-timeline.tsx`

- [ ] **Step 1: Create the component**

The project-wide `ActivityTimeline` expects `VaultNote<CommunicationMeta>[]`. Leads use Prisma `Communication` rows; build a focused renderer.

Create `full-kit/src/components/leads/lead-activity-timeline.tsx`:

```tsx
import type { Communication } from ".prisma/client";
import { ArrowDownLeft, ArrowUpRight, Mail, Phone, MessageSquare, Smartphone } from "lucide-react";
import type { ReactNode } from "react";

interface LeadActivityTimelineProps {
  communications: Communication[];
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  text: <MessageSquare className="size-3.5" />,
  whatsapp: <Smartphone className="size-3.5" />,
};

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function snippet(text: string | null, max = 320): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function LeadActivityTimeline({ communications }: LeadActivityTimelineProps): JSX.Element {
  if (communications.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">No activity yet.</p>
    );
  }

  const sorted = [...communications].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  return (
    <div className="divide-y divide-border">
      {sorted.map((c) => {
        const isInbound = c.direction === "inbound";
        return (
          <div key={c.id} className="py-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={
                  isInbound ? "flex items-center gap-1 text-emerald-600" : "flex items-center gap-1 text-blue-600"
                }
              >
                {isInbound ? (
                  <ArrowDownLeft className="size-3" />
                ) : (
                  <ArrowUpRight className="size-3" />
                )}
                {isInbound ? "inbound" : "outbound"}
              </span>
              <span>{CHANNEL_ICONS[c.channel] ?? null}</span>
              {c.subject ? (
                <span className="text-foreground">{c.subject}</span>
              ) : null}
              <span className="ml-auto">{formatDate(c.date)}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {snippet(c.body)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/lead-activity-timeline" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/components/leads/lead-activity-timeline.tsx
git commit -m "feat(leads): LeadActivityTimeline for Prisma Communications

Focused reverse-chrono renderer that takes Prisma Communication[] rows
directly, so the lead detail page doesn't need to adapt shapes into
VaultNote<CommunicationMeta>. Inbound rows get emerald arrows, outbound
blue, matching the brainstorm mockup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: MarkViewedOnMount client island

**Files:**
- Create: `full-kit/src/components/leads/mark-viewed-on-mount.tsx`

- [ ] **Step 1: Create the island**

Create `full-kit/src/components/leads/mark-viewed-on-mount.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface MarkViewedOnMountProps {
  leadId: string;
}

/**
 * Fires the mark-viewed endpoint once on mount, then refreshes the
 * router so the nav-badge count re-queries. Silent on error — this is
 * best-effort state reconciliation, not user-visible.
 */
export function MarkViewedOnMount({ leadId }: MarkViewedOnMountProps): null {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/vault/leads/${leadId}/view`, {
          method: "POST",
        });
        if (!cancelled && res.ok) {
          router.refresh();
        }
      } catch {
        /* best-effort — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, router]);
  return null;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/mark-viewed-on-mount" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/components/leads/mark-viewed-on-mount.tsx
git commit -m "feat(leads): MarkViewedOnMount client island

Small client-only component that POSTs to the view endpoint on mount
and calls router.refresh() so the sidebar unread badge re-queries.
Silent on error — a failed mark-viewed isn't worth surfacing to the user.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: LeadDetailHeader with status buttons + convert dialog

**Files:**
- Create: `full-kit/src/components/leads/lead-detail-header.tsx`

- [ ] **Step 1: Create the component**

Create `full-kit/src/components/leads/lead-detail-header.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadSource, LeadStatus } from ".prisma/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { StatusChip } from "./status-chip";
import { SourceBadge } from "./source-badge";

interface LeadDetailHeaderProps {
  leadId: string;
  name: string;
  company: string | null;
  metaLine: string;
  leadSource: LeadSource;
  leadStatus: LeadStatus;
}

export function LeadDetailHeader({
  leadId,
  name,
  company,
  metaLine,
  leadSource,
  leadStatus,
}: LeadDetailHeaderProps): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function patchStatus(next: LeadStatus): Promise<void> {
    const res = await fetch(`/api/vault/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadStatus: next }),
    });
    if (!res.ok) {
      toast({
        title: "Could not update lead",
        description: `Server returned ${res.status}`,
      });
      return;
    }
    toast({ title: `Marked as ${next}` });
    startTransition(() => router.refresh());
  }

  async function doConvert(): Promise<void> {
    const res = await fetch(`/api/vault/leads/${leadId}/convert`, {
      method: "POST",
    });
    if (!res.ok) {
      toast({
        title: "Convert failed",
        description: `Server returned ${res.status}`,
      });
      return;
    }
    const body = (await res.json()) as {
      ok: true;
      alreadyClient: boolean;
      clientPath: string;
    };
    toast({
      title: body.alreadyClient ? "Already a client" : "Converted to client",
      description: body.clientPath,
    });
    startTransition(() => router.refresh());
  }

  const disabled = isPending || leadStatus === "converted";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[17px] font-semibold text-foreground">
            {name}
            {company ? <span className="text-muted-foreground"> · {company}</span> : null}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <SourceBadge source={leadSource} />
            <StatusChip status={leadStatus} />
            <span>{metaLine}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "vetted"}
            onClick={() => patchStatus("vetted")}
          >
            Vetted
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "contacted"}
            onClick={() => patchStatus("contacted")}
          >
            Contacted
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "dropped"}
            onClick={() => patchStatus("dropped")}
          >
            Drop
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => setConfirmOpen(true)}
          >
            Convert →
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a client record for <strong>{name}</strong> and
              mark this lead as converted. If a client with the same email
              already exists, it will be reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doConvert}>Convert</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Verify shadcn primitives exist**

Run: `cd full-kit && ls src/components/ui/alert-dialog.tsx src/components/ui/button.tsx 2>&1`
Expected: both files listed. If `alert-dialog.tsx` is missing, run `pnpm dlx shadcn@latest add alert-dialog` before proceeding.

- [ ] **Step 3: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/lead-detail-header" | head -5`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/components/leads/lead-detail-header.tsx
git commit -m "feat(leads): LeadDetailHeader with status buttons + convert dialog

Client island at the top of the detail page. Four status action
buttons (Vetted / Contacted / Drop / Convert→) PATCH the lead via the
vault API; Convert opens a confirm dialog and POSTs to the convert
endpoint. All paths toast a result and router.refresh() so downstream
RSC re-queries reflect the change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Lead detail page

**Files:**
- Create: `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { ContactCard } from "@/components/leads/contact-card";
import { InquiryQuote } from "@/components/leads/inquiry-quote";
import { LeadActivityTimeline } from "@/components/leads/lead-activity-timeline";
import { LeadAISuggestions } from "@/components/leads/lead-ai-suggestions";
import { LeadDetailHeader } from "@/components/leads/lead-detail-header";
import { MarkViewedOnMount } from "@/components/leads/mark-viewed-on-mount";
import { NotesCard } from "@/components/leads/notes-card";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

function extractInquiryMessage(
  metadata: unknown,
  fallback: string | null,
): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    "extracted" in metadata &&
    (metadata as { extracted?: unknown }).extracted &&
    typeof (metadata as { extracted: unknown }).extracted === "object"
  ) {
    const ex = (metadata as { extracted: Record<string, unknown> }).extracted;
    const inquirer = ex.inquirer;
    if (
      inquirer &&
      typeof inquirer === "object" &&
      "message" in inquirer &&
      typeof (inquirer as { message?: unknown }).message === "string"
    ) {
      return (inquirer as { message: string }).message;
    }
  }
  return fallback;
}

export default async function LeadDetailPage({
  params,
}: LeadDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;

  const [contact, communications] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    db.communication.findMany({
      where: { contactId: id },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!contact || contact.leadSource === null) {
    notFound();
  }

  const firstInbound = communications.find((c) => c.direction === "inbound");
  const inquiryMessage = extractInquiryMessage(
    firstInbound?.metadata ?? null,
    firstInbound?.body ?? null,
  );

  const metaLine = contact.leadAt
    ? `new lead · ${contact.leadAt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "new lead";

  return (
    <div className="flex flex-col">
      <MarkViewedOnMount leadId={contact.id} />
      <LeadDetailHeader
        leadId={contact.id}
        name={contact.name}
        company={contact.company}
        metaLine={metaLine}
        leadSource={contact.leadSource}
        leadStatus={contact.leadStatus ?? "new"}
      />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
        <div className="border-r border-border px-6 py-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inquiry
          </div>
          <InquiryQuote source={contact.leadSource} message={inquiryMessage} />
          <div className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </div>
          <LeadActivityTimeline communications={communications} />
        </div>
        <aside className="flex flex-col gap-4 bg-muted/10 px-6 py-4">
          <ContactCard contact={contact} />
          <LeadAISuggestions contactId={contact.id} />
          <NotesCard notes={contact.notes} />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "pages/leads/\[id\]/page" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/[id]/page.tsx"
git commit -m "feat(leads): lead detail page (RSC)

Two-column layout: inquiry quote + activity timeline left, contact
card + AI suggestions + notes right. Header carries status action
buttons + convert dialog. MarkViewedOnMount flips lead_last_viewed_at
on mount so the sidebar badge re-counts after view.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: LeadRow client component

**Files:**
- Create: `full-kit/src/components/leads/lead-row.tsx`

- [ ] **Step 1: Create LeadRow**

Create `full-kit/src/components/leads/lead-row.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { LeadSource, LeadStatus } from ".prisma/client";
import { ChevronRight } from "lucide-react";
import { SourceBadge } from "./source-badge";
import { StatusChip } from "./status-chip";

export interface LeadRowData {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  leadSource: LeadSource;
  leadStatus: LeadStatus;
  leadAt: Date | null;
  snippet: string | null;
  isUnread: boolean;
}

interface LeadRowProps {
  lead: LeadRowData;
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadRow({ lead }: LeadRowProps): JSX.Element {
  return (
    <Link
      href={`/pages/leads/${lead.id}`}
      className="block border-b border-border px-4 py-3 transition-colors hover:bg-muted/30"
    >
      <div className="grid grid-cols-[16px_1.6fr_1fr_auto_auto_auto_16px] items-center gap-3">
        <span>
          {lead.isUnread ? (
            <span className="block size-2 rounded-full bg-red-500" aria-label="unread" />
          ) : null}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {lead.name}
            {lead.company ? (
              <span className="text-muted-foreground"> · {lead.company}</span>
            ) : null}
          </div>
        </div>
        <div className="truncate text-xs text-muted-foreground">{lead.email}</div>
        <SourceBadge source={lead.leadSource} />
        <StatusChip status={lead.leadStatus} />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {lead.leadAt ? formatDate(lead.leadAt) : ""}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      {lead.snippet ? (
        <p className="mt-1 ml-6 line-clamp-1 text-xs text-muted-foreground">
          "{lead.snippet}"
        </p>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/lead-row" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/components/leads/lead-row.tsx
git commit -m "feat(leads): LeadRow two-line row component

Layout B from the brainstorm mockup — meta grid on top, snippet
line-clamped below. Unread dot on the left, chevron on the right.
Whole row is a Next link to the detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: LeadsTable with filters, search, sort

**Files:**
- Create: `full-kit/src/components/leads/leads-table.tsx`

- [ ] **Step 1: Create LeadsTable**

Create `full-kit/src/components/leads/leads-table.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { LeadSource, LeadStatus } from ".prisma/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LeadRow, type LeadRowData } from "./lead-row";

const STATUS_PILLS: Array<{ label: string; value: LeadStatus | "all" }> = [
  { label: "All active", value: "all" },
  { label: "New", value: "new" },
  { label: "Vetted", value: "vetted" },
  { label: "Contacted", value: "contacted" },
];

const SOURCE_PILLS: Array<{ label: string; value: LeadSource | "all" }> = [
  { label: "All sources", value: "all" },
  { label: "Crexi", value: "crexi" },
  { label: "LoopNet", value: "loopnet" },
  { label: "Buildout", value: "buildout" },
  { label: "Email", value: "email_cold" },
  { label: "Referral", value: "referral" },
];

interface LeadsTableProps {
  leads: LeadRowData[];
}

function Pill<T extends string>({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function LeadsTable({ leads }: LeadsTableProps): JSX.Element {
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [source, setSource] = useState<LeadSource | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => (status === "all" ? true : l.leadStatus === status))
      .filter((l) => (source === "all" ? true : l.leadSource === source))
      .filter((l) => {
        if (!q) return true;
        return (
          l.name.toLowerCase().includes(q) ||
          (l.company?.toLowerCase().includes(q) ?? false) ||
          (l.email?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
        const ad = a.leadAt?.getTime() ?? 0;
        const bd = b.leadAt?.getTime() ?? 0;
        return bd - ad;
      });
  }, [leads, status, source, search]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((p) => (
            <Pill
              key={p.value}
              active={status === p.value}
              label={p.label}
              onClick={() => setStatus(p.value)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCE_PILLS.map((p) => (
            <Pill
              key={p.value}
              active={source === p.value}
              label={p.label}
              onClick={() => setSource(p.value)}
            />
          ))}
        </div>
      </div>
      <div className="border-b border-border px-4 py-2">
        <Input
          placeholder="Search name, company, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {leads.length === 0
            ? "No leads yet — they'll show up here as emails arrive from Crexi, LoopNet, or Buildout."
            : "No leads match these filters."}
        </div>
      ) : (
        <div>
          {filtered.map((l) => (
            <LeadRow key={l.id} lead={l} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify shadcn Input exists**

Run: `cd full-kit && ls src/components/ui/input.tsx 2>&1`
Expected: file listed.

- [ ] **Step 3: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "leads/leads-table" | head -5`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/components/leads/leads-table.tsx
git commit -m "feat(leads): LeadsTable with status/source pills and search

Client component. Status pills: All active / New / Vetted / Contacted
(All active excludes converted+dropped — those are filtered at the
RSC level). Source pills: All sources / Crexi / LoopNet / Buildout /
Email / Referral. Default sort: unread first, then lead_at desc.
Empty states distinguish 'no leads ever' from 'no matches for filters'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Leads list page

**Files:**
- Create: `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/page.tsx`

- [ ] **Step 1: Create the page**

Create `full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/page.tsx`:

```tsx
import { db } from "@/lib/prisma";
import { LeadsTable } from "@/components/leads/leads-table";
import type { LeadRowData } from "@/components/leads/lead-row";
import { isUnread } from "@/lib/leads/unread";

function extractInquiryMessage(
  metadata: unknown,
  fallback: string | null,
): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    "extracted" in metadata &&
    (metadata as { extracted?: unknown }).extracted &&
    typeof (metadata as { extracted: unknown }).extracted === "object"
  ) {
    const ex = (metadata as { extracted: Record<string, unknown> }).extracted;
    const inquirer = ex.inquirer;
    if (
      inquirer &&
      typeof inquirer === "object" &&
      "message" in inquirer &&
      typeof (inquirer as { message?: unknown }).message === "string"
    ) {
      return (inquirer as { message: string }).message;
    }
  }
  return fallback;
}

export default async function LeadsListPage(): Promise<JSX.Element> {
  const contacts = await db.contact.findMany({
    where: {
      leadSource: { not: null },
      leadStatus: { notIn: ["converted", "dropped"] },
    },
    orderBy: { leadAt: "desc" },
    include: {
      communications: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  const rows: LeadRowData[] = contacts.map((c) => {
    const firstInbound = c.communications.find((m) => m.direction === "inbound");
    const snippet = extractInquiryMessage(
      firstInbound?.metadata ?? null,
      firstInbound?.subject ?? firstInbound?.body ?? null,
    );
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      leadSource: c.leadSource!,
      leadStatus: c.leadStatus ?? "new",
      leadAt: c.leadAt,
      snippet,
      isUnread: isUnread({
        leadStatus: c.leadStatus,
        leadAt: c.leadAt,
        leadLastViewedAt: c.leadLastViewedAt,
        communications: c.communications.map((m) => ({
          direction: m.direction as "inbound" | "outbound",
          date: m.date,
        })),
      }),
    };
  });

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Inbound inquiries auto-extracted from Crexi, LoopNet, and Buildout.
        </p>
      </div>
      <LeadsTable leads={rows} />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "pages/leads/page" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/[lang]/(dashboard-layout)/pages/leads/page.tsx"
git commit -m "feat(leads): leads list page (RSC)

Direct Prisma query for active leads (leadSource IS NOT NULL, status
not in converted/dropped). Pulls the last 20 communications per
contact so isUnread can run correctly. Passes transformed LeadRowData
into the client table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: UnreadBadge and navigation entry

**Files:**
- Create: `full-kit/src/components/leads/unread-badge.tsx`
- Modify: `full-kit/src/data/navigations.ts`

- [ ] **Step 1: Create the badge component**

Create `full-kit/src/components/leads/unread-badge.tsx`:

```tsx
import { getUnreadLeadsCount } from "@/lib/leads/count";

export async function UnreadBadge(): Promise<JSX.Element | null> {
  const count = await getUnreadLeadsCount();
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
```

- [ ] **Step 2: Add Leads to navigation**

Open `full-kit/src/data/navigations.ts`. Find the `People` group's `items` array and insert the Leads entry between Clients and Contacts:

```ts
{
  title: "Leads",
  href: "/pages/leads",
  iconName: "Target",
},
```

The People group should end up as:

```ts
{
  title: "People",
  items: [
    {
      title: "Clients",
      href: "/pages/clients",
      iconName: "Building2",
    },
    {
      title: "Leads",
      href: "/pages/leads",
      iconName: "Target",
    },
    {
      title: "Contacts",
      href: "/pages/contacts",
      iconName: "Users",
    },
  ],
},
```

- [ ] **Step 3: Confirm `Target` icon is exported by the existing icon-name resolver**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "navigations|iconName" | head -10`
Expected: no errors. If the project's icon-name mapping rejects `"Target"`, open the nav-rendering component (often `src/components/layout/sidebar/sidebar-nav.tsx` or similar), find the Lucide icon map, and add `Target: Target` (importing from `lucide-react`). If `Target` isn't a good visual fit, `Flame` or `Inbox` are acceptable fallbacks that are already commonly imported.

- [ ] **Step 4: Wire the UnreadBadge into the sidebar**

Find the sidebar nav renderer:
```bash
cd full-kit && grep -rn "iconName" src/components/layout/ src/components/sidebar/ 2>/dev/null | head -5
```
The file that maps `iconName` strings to Lucide components and renders `<Link href={item.href}>` is the one to edit.

Inside that component's item-rendering block, just before the `</Link>` or row closer, for items matching `href === "/pages/leads"`, render `<UnreadBadge />`:

```tsx
{item.href === "/pages/leads" ? (
  <Suspense fallback={null}>
    <UnreadBadge />
  </Suspense>
) : null}
```

Import `Suspense` from `"react"` and `UnreadBadge` from `@/components/leads/unread-badge` at the top of the file. The badge is a server component that queries the DB; `Suspense` with `fallback={null}` lets the sidebar render immediately while the count resolves.

- [ ] **Step 5: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "(leads/unread-badge|navigations|sidebar)" | head -10`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add full-kit/src/components/leads/unread-badge.tsx full-kit/src/data/navigations.ts full-kit/src/components/layout/
git commit -m "feat(leads): Leads nav entry with unread badge

Adds 'Leads' between 'Clients' and 'Contacts' under the People group.
UnreadBadge is a server component that calls getUnreadLeadsCount and
renders a small red pill with the count, Suspense-wrapped so it doesn't
block the initial sidebar render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: End-to-end verification checklist

No code — manual verification against local dev.

- [ ] **Step 1: Typecheck + tests green**

Run:
```bash
cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -v "\.pnpm\|duplicate" | head -10
pnpm exec vitest run src/lib/leads/ 2>&1 | tail -5
```
Expected: no new type errors; `6 passed` on the unread tests.

- [ ] **Step 2: Start dev server**

Run: `cd full-kit && pnpm dev`
Wait for `Ready` log line.

- [ ] **Step 3: Verify sidebar "Leads" entry + badge count**

Visit `http://localhost:3000/` (pick any dashboard-layout page). Confirm:
- "Leads" appears in the sidebar under People, between Clients and Contacts
- If any unread leads exist in the DB, a red pill shows a count next to it

If no data exists yet, run the email sync first: `POST /api/integrations/msgraph/emails/sync?daysBack=7` with the admin token (see the email-ingestion verification doc). That populates Contact rows with `leadSource` set once Crexi/LoopNet/Buildout emails arrive.

- [ ] **Step 4: Verify list view**

Visit `http://localhost:3000/pages/leads`. Confirm:
- Heading renders with subtitle
- Status pills and source pills render; clicking changes the visible rows
- Search input filters by name/company/email
- Unread dot shows on rows where `leadStatus='new'` or new inbound comms exist
- Empty state copy shows when no matching leads

- [ ] **Step 5: Verify detail view**

Click into a lead. Confirm:
- Header shows name · company, source badge, status chip, meta line
- Inquiry quote renders with the source-colored left border
- Activity timeline shows all Communications, reverse-chronological
- Right sidebar shows Contact, AI Suggestions placeholder, and Notes
- After a second or two, the page's sidebar-badge count drops by 1 (MarkViewedOnMount fired and nav revalidated)

- [ ] **Step 6: Verify status transitions**

On a lead with status `new`, click **Vetted**. Confirm:
- Toast: "Marked as vetted"
- StatusChip re-renders as `vetted`
- The Vetted button is now disabled (current status)
- Back on the list, the unread dot is gone (assuming no newer inbound comms)

- [ ] **Step 7: Verify convert flow**

On a lead with status `vetted`, click **Convert →**, confirm the dialog, then:
- Toast: "Converted to client" with a path like `clients/<slug>/<name>.md`
- Inspect the filesystem: `full-kit/content/clients/<slug>/<name>.md` exists with proper YAML frontmatter and body
- The lead's status chip reads `converted`
- The lead disappears from the default-filter list (since `notIn ('converted','dropped')` excludes it)

Call convert again on the same lead (via devtools or by direct POST):
```bash
curl -X POST http://localhost:3000/api/vault/leads/<LEAD_ID>/convert
```
Expected: `{ ok: true, alreadyClient: true, clientPath: "<same path>" }` — 200, not 201.

- [ ] **Step 8: Verify mark-viewed persistence**

Query Postgres:
```sql
SELECT name, lead_status, lead_last_viewed_at
FROM contacts
WHERE id = '<LEAD_ID>';
```
Expected: `lead_last_viewed_at` matches the time you opened the detail page (within a few seconds).

- [ ] **Step 9: Commit a verification snapshot**

Write `full-kit/recon-output/post-leads-ui-verification-2026-04-24.md` summarizing:
- Count of leads visible in the list
- Sample conversion path(s)
- Any UI issues found (color contrast, narrow-screen layout, empty-state copy)

```bash
git add full-kit/recon-output/post-leads-ui-verification-2026-04-24.md
git commit -m "docs(recon): post-leads-ui verification snapshot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Spec-coverage self-review

| Spec section | Implemented by |
|---|---|
| Schema change (`leadLastViewedAt` + composite index) | Task 1 |
| File layout (components, routes, pages, nav) | Tasks 3–17 |
| List query + filters + sort + empty state | Tasks 15, 16 |
| Two-line row layout (layout B) | Task 14 |
| Detail page single-page + sidebar layout | Tasks 9–13 |
| Status action buttons + Convert dialog | Task 12 |
| Inquiry quote with source accent | Task 9 |
| Activity timeline for Prisma Communications | Task 10 |
| ContactCard + NotesCard | Task 9 |
| AI hook contract (`LeadAISuggestions`) | Task 8 |
| Unread definition (pure function + SQL mirror) | Tasks 2, 3 |
| Mark-viewed on mount | Task 11 |
| API PATCH / view / convert | Tasks 4, 5, 6 |
| Sidebar nav entry + UnreadBadge | Task 17 |
| Manual verification pass | Task 18 |
