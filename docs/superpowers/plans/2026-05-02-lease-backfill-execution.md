# Lease-Lifecycle Backfill Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each Phase has a build agent and an adversarial-audit agent. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dormant AI extraction pipeline (classifier + lease extractor + PDF reader), then run it across Matt's full ten-year Outlook archive so `LeaseRecord` + `CalendarEvent` rows populate, `Contact.clientType` rolls forward, and renewal alerts surface in the UI.

**Architecture:** Two-stage AI on every Communication — DeepSeek classifies, Haiku extracts on candidates. PDF attachments fall through to a Haiku-vision PDF reader when body extraction misses. An idempotent orchestrator stamps each Communication with its classification result so re-runs are no-ops. Backfill is a resume-safe background runner with a hard cost cap.

**Tech Stack:** Next.js 15 / TypeScript / Prisma 5 / Postgres (Supabase) / DeepSeek (OpenAI-compatible) / Anthropic SDK (Claude Haiku 4.5) / Microsoft Graph / Vitest / pnpm.

**Spec:** [`docs/superpowers/specs/2026-05-02-lease-backfill-execution-design.md`](../specs/2026-05-02-lease-backfill-execution-design.md)

**Predecessor plans (do not redo work in these):**
- [`2026-05-02-lease-lifecycle.md`](2026-05-02-lease-lifecycle.md) — Schema, calendar UI, classifier/extractor scaffolds, email-history backfill engine, renewal alert job. ALL applied. Only the AI prompt bodies + provider HTTP calls remain TODO.
- [`2026-04-29-deal-pipeline-and-ai-backfill.md`](2026-04-29-deal-pipeline-and-ai-backfill.md) — Earlier deal-pipeline groundwork.

---

## Conventions for every Phase

- Always source env first: `cd full-kit && set -a && source .env.local && set +a`
- Tests: `pnpm test` (vitest run). Type check: `pnpm exec tsc --noEmit --pretty false`. Both clean before claiming "done".
- Commit per task with conventional-commit prefix and `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- DRY, YAGNI, TDD. Frequent commits.
- Server-only code lives under `src/lib/...` and starts with `import "server-only"`.
- Use the existing `db` client from `@/lib/prisma` — never instantiate your own `PrismaClient`.
- Cost-incurring AI calls go through `assertWithinScrubBudget()` from `src/lib/ai/budget-tracker.ts` and log to `ScrubApiCall` via `src/lib/ai/scrub-api-log.ts` so the budget tracker actually sees them.

---

## Phase 1 — Wire AI prompts + provider calls + orchestrator

**Goal:** Replace the two `null`-returning stubs with real provider calls, then build the orchestrator that runs Stage 1 → Stage 2 → DB-side-effects for one Communication. Body-only extraction (no PDF yet — Phase 2).

### Task 1.1: Author the closed-deal classifier prompt

**Files:**
- Modify: `full-kit/src/lib/ai/closed-deal-classifier.prompt.md`

- [ ] **Step 1: Replace the TODO sections with a real CRE-aware prompt.**

The prompt must:
- Establish the model's role as a CRE deal-stage classifier reading one Communication at a time.
- Define the four classes precisely (`closed_lease`, `closed_sale`, `lease_in_progress`, `not_a_deal`) with clear inclusion/exclusion language. Use Matt's domain vocabulary: LOI, term sheet, lease commencement, fully executed, closed escrow, recorded deed, commission disbursement.
- Include 6 worked examples (one per class plus 2 ambiguous edge cases) with the expected JSON output for each.
- Spell out the output JSON schema exactly:
  ```json
  {"classification":"closed_lease|closed_sale|lease_in_progress|not_a_deal","confidence":0.0,"signals":["string","..."]}
  ```
- Tell the model to drop confidence below 0.7 when the signal is weak (e.g., subject says "lease executed" but body is empty).
- Forbid speculation: if the email is a marketing blast, newsletter, or vendor pitch, classify `not_a_deal` with high confidence — do not "find" deals that aren't there.
- Instruct the model to output ONLY the JSON, no markdown fences, no prose.

- [ ] **Step 2: Bump the version constant.**

In `closed-deal-classifier.ts`:
```typescript
export const CLOSED_DEAL_CLASSIFIER_VERSION = "2026-05-02.2"
```

- [ ] **Step 3: Commit.**
```bash
git add full-kit/src/lib/ai/closed-deal-classifier.prompt.md full-kit/src/lib/ai/closed-deal-classifier.ts
git commit -m "feat(ai): closed-deal classifier prompt body"
```

### Task 1.2: Wire the classifier provider call

**Files:**
- Modify: `full-kit/src/lib/ai/closed-deal-classifier.ts`
- Test: `full-kit/src/lib/ai/closed-deal-classifier.test.ts`

- [ ] **Step 1: Add a failing test for `callClassifier()` that mocks `fetch` and asserts the request shape (DeepSeek endpoint, model, system+user msgs, JSON-mode response_format).**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callClassifier } from "./closed-deal-classifier"

describe("callClassifier (HTTP)", () => {
  const realFetch = global.fetch
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test"
    process.env.OPENAI_BASE_URL = "https://api.deepseek.com/v1"
    process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL = "deepseek-chat"
  })
  afterEach(() => { global.fetch = realFetch })

  it("posts to DeepSeek with system+user messages and parses JSON output", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "deepseek-chat",
        usage: { prompt_tokens: 120, completion_tokens: 40 },
        choices: [{ message: { content: '{"classification":"closed_lease","confidence":0.92,"signals":["fully executed lease"]}' } }],
      }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const result = await callClassifier("Lease executed for 303 Main", "Attached PDF...")
    expect(result).toEqual({ classification: "closed_lease", confidence: 0.92, signals: ["fully executed lease"] })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe("deepseek-chat")
    expect(body.response_format).toEqual({ type: "json_object" })
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[1].role).toBe("user")
    expect(body.messages[1].content).toContain("303 Main")
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails.**

```bash
cd full-kit && pnpm test closed-deal-classifier -t "posts to DeepSeek"
```
Expected: FAIL — `callClassifier` returns `null`.

- [ ] **Step 3: Implement `callClassifier()` to POST to OpenAI-compatible chat completions with JSON-mode.**

Replace the stub in `full-kit/src/lib/ai/closed-deal-classifier.ts`:

```typescript
import fs from "node:fs/promises"
import path from "node:path"

let cachedPrompt: string | null = null
async function loadPromptBody(): Promise<string> {
  if (cachedPrompt) return cachedPrompt
  const p = path.join(process.cwd(), "src/lib/ai/closed-deal-classifier.prompt.md")
  cachedPrompt = await fs.readFile(p, "utf8")
  return cachedPrompt
}

function getEndpoint(): string {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")
  return `${base}/chat/completions`
}

export async function callClassifier(
  subject: string,
  body: string
): Promise<ClosedDealClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for callClassifier")
  const model = resolveClassifierModel()
  const systemPrompt = await loadPromptBody()

  const userPayload = `SUBJECT:\n${subject}\n\nBODY:\n${body}`

  const res = await fetch(getEndpoint(), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`classifier provider failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  const validation = validateClosedDealClassification(parsed)
  return validation.ok ? validation.value : null
}
```

- [ ] **Step 4: Run all closed-deal-classifier tests.**

```bash
cd full-kit && pnpm test closed-deal-classifier
```
Expected: all pass, including the existing stub-driven tests (which use `callClassifierFn` injection).

- [ ] **Step 5: Add a 429/5xx single retry with exponential backoff (1s base).**

Wrap the fetch in a tiny retry loop — re-runs once on 429 / 500 / 502 / 503 / 504, honoring `Retry-After` if present. Add a test that asserts a 429 followed by a 200 succeeds and only one retry is attempted.

- [ ] **Step 6: Log the API call to `ScrubApiCall` for budget tracking.**

Use the existing `appendScrubApiCall()` helper from `src/lib/ai/scrub-api-log.ts`. If that helper does not accept a `purpose` discriminator, extend its `purpose` enum to include `"closed_deal_classifier"` and stamp `tokensIn` / `tokensOut` from the response `usage`. Cost: 0.14¢/M in + 0.28¢/M out for DeepSeek; encode in a small `estimateUsd()` helper colocated with the wiring. Add a test asserting the row is written.

- [ ] **Step 7: Commit.**
```bash
git add full-kit/src/lib/ai/closed-deal-classifier.ts full-kit/src/lib/ai/closed-deal-classifier.test.ts full-kit/src/lib/ai/scrub-api-log.ts
git commit -m "feat(ai): wire closed-deal classifier to DeepSeek with JSON-mode + budget logging"
```

### Task 1.3: Author the lease extractor prompt

**Files:**
- Modify: `full-kit/src/lib/ai/lease-extractor.prompt.md`

- [ ] **Step 1: Replace the TODO sections with a real prompt.**

The prompt must:
- Define the role: structured-data extractor for a CRE broker's archive.
- Spell out the input format: `SUBJECT:` / `BODY:` / `CLASSIFICATION:` (closed_lease | closed_sale) / `SIGNALS:` (array passed from Stage 1).
- For each output field: when to populate, when to leave null, format conventions (ISO dates, lower-case enum values).
- Hard rules: for `dealKind: "sale"`, every lease-only field MUST be null. `leaseEndDate` MUST be on or after `leaseStartDate`. If the email body is a thread reply that quotes earlier signed-lease language without confirming this email is the closure, drop confidence to 0.5.
- Provide 4 worked examples: clean lease, clean sale, ambiguous (drop confidence), spurious (the body says "lease" but it's a furniture lease for an office — return `confidence: 0.2` with a `dealKind` guess and let the validator/humans triage).
- Output: ONLY the JSON object, no fences.

- [ ] **Step 2: Bump version.**

```typescript
export const LEASE_EXTRACTOR_VERSION = "2026-05-02.2"
```

- [ ] **Step 3: Commit.**
```bash
git add full-kit/src/lib/ai/lease-extractor.prompt.md full-kit/src/lib/ai/lease-extractor.ts
git commit -m "feat(ai): lease/sale extractor prompt body"
```

### Task 1.4: Wire the lease extractor provider call

**Files:**
- Modify: `full-kit/src/lib/ai/lease-extractor.ts`
- Test: `full-kit/src/lib/ai/lease-extractor.test.ts`

- [ ] **Step 1: Add a failing test that mocks the Anthropic SDK and asserts the request shape (Haiku model, tool-use forced for `extract_lease`, prompt loaded from MD file).**

The Anthropic SDK is already available — see `full-kit/src/lib/ai/claude.ts` for `createAnthropicClient()`. Use `vi.mock("@anthropic-ai/sdk", ...)` to inject a fake client whose `messages.create` returns:
```typescript
{
  model: "claude-haiku-4-5-20251001",
  usage: { input_tokens: 800, output_tokens: 220, cache_read_input_tokens: 0 },
  content: [{
    type: "tool_use",
    name: "extract_lease",
    input: {
      contactName: "Acme Tenant LLC",
      contactEmail: "ops@acme.example",
      propertyAddress: "303 N Main, Kalispell MT",
      closeDate: "2024-06-15",
      leaseStartDate: "2024-07-01",
      leaseEndDate: "2029-06-30",
      leaseTermMonths: 60,
      rentAmount: 8500,
      rentPeriod: "monthly",
      mattRepresented: "owner",
      dealKind: "lease",
      confidence: 0.93,
      reasoning: "Subject 'Lease fully executed' + body lists term, rent, parties.",
    },
  }],
}
```

Assert the validator-narrowed return matches and `modelUsed === "claude-haiku-4-5-20251001"`.

- [ ] **Step 2: Run, confirm fail.**
```bash
cd full-kit && pnpm test lease-extractor
```

- [ ] **Step 3: Implement `callExtractor()` using the existing `createAnthropicClient()`.**

```typescript
import { createAnthropicClient } from "./claude"
import fs from "node:fs/promises"
import path from "node:path"

let cachedPrompt: string | null = null
async function loadPromptBody(): Promise<string> {
  if (cachedPrompt) return cachedPrompt
  const p = path.join(process.cwd(), "src/lib/ai/lease-extractor.prompt.md")
  cachedPrompt = await fs.readFile(p, "utf8")
  return cachedPrompt
}

const EXTRACT_TOOL = {
  name: "extract_lease",
  description: "Emit the structured lease/sale extraction.",
  input_schema: {
    type: "object",
    properties: {
      contactName: { type: "string" },
      contactEmail: { type: ["string", "null"] },
      propertyAddress: { type: ["string", "null"] },
      closeDate: { type: ["string", "null"] },
      leaseStartDate: { type: ["string", "null"] },
      leaseEndDate: { type: ["string", "null"] },
      leaseTermMonths: { type: ["integer", "null"] },
      rentAmount: { type: ["number", "null"] },
      rentPeriod: { type: ["string", "null"], enum: ["monthly", "annual", null] },
      mattRepresented: { type: ["string", "null"], enum: ["owner", "tenant", "both", null] },
      dealKind: { type: "string", enum: ["lease", "sale"] },
      confidence: { type: "number" },
      reasoning: { type: "string" },
    },
    required: ["contactName", "dealKind", "confidence", "reasoning"],
  },
} as const

export async function callExtractor(
  input: LeaseExtractorInput
): Promise<unknown | null> {
  const client = createAnthropicClient()
  const systemPrompt = await loadPromptBody()
  const model = resolveExtractorModel()

  const userContent =
    `SUBJECT:\n${input.subject}\n\n` +
    `BODY:\n${input.body}\n\n` +
    `CLASSIFICATION: ${input.classification}\n` +
    `SIGNALS: ${JSON.stringify(input.signals)}`

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_lease" },
    messages: [{ role: "user", content: userContent }],
  })

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "extract_lease"
  )
  return toolUse?.input ?? null
}
```

(Import `Anthropic` as the SDK default + namespace import.)

- [ ] **Step 4: Run tests, confirm pass.**

- [ ] **Step 5: Add cost logging.**

Cost for Haiku 4.5: input ~$1.00/M, output ~$5.00/M, cache reads $0.10/M (cache writes $1.25/M). Encode in `estimateExtractorUsd()` helper. Append to `ScrubApiCall` with `purpose: "lease_extractor"`. Test that the call is logged.

- [ ] **Step 6: Add retry on 429/5xx (the SDK has built-in retries — confirm it's enabled; if not, add `maxRetries: 2` to the client constructor).**

- [ ] **Step 7: Commit.**

```bash
git add full-kit/src/lib/ai/lease-extractor.ts full-kit/src/lib/ai/lease-extractor.test.ts
git commit -m "feat(ai): wire lease extractor to Claude Haiku with tool-use + budget logging"
```

### Task 1.5: Build the pipeline orchestrator

**Files:**
- Create: `full-kit/src/lib/ai/lease-pipeline-orchestrator.ts`
- Test: `full-kit/src/lib/ai/lease-pipeline-orchestrator.test.ts`
- Modify: `full-kit/src/lib/system-state/automation-settings.ts` (add `leaseExtractorMinConfidence` field, default 0.6)

- [ ] **Step 1: Add the failing test for the happy path: classifier returns `closed_lease`, extractor returns a valid extraction, the orchestrator upserts a `LeaseRecord` and a `CalendarEvent`, transitions the contact, and returns `{ok: true, leaseRecordId, calendarEventId}`.**

Use injected `runClosedDealClassifier` and `runLeaseExtraction` test hooks (add an `options` parameter to the orchestrator that accepts these for tests).

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement `processCommunicationForLease(commId, options?)`.**

Behavior:
1. Read Communication. If `metadata.closedDealClassification?.version === CLOSED_DEAL_CLASSIFIER_VERSION`, return `{ok: false, reason: "already_processed"}`.
2. Run classifier. Stamp result onto `metadata.closedDealClassification` regardless of class. If `not_a_deal` or `lease_in_progress`, return `{ok: false, reason: "not_a_closed_deal"}`.
3. Run extractor. If `validation_failed` or `confidence < settings.leaseExtractorMinConfidence`, stamp `metadata.leaseExtractionAttempt = {failedReason, version, runAt}`, return `{ok: false, reason: "low_confidence"}` (Phase 2 falls back to PDF here).
4. Find-or-create the `Contact`:
   - If `contactEmail` is non-null AND a Contact already has that email → use it.
   - Else if a Contact has the same `name` (case-insensitive) → use it.
   - Else create one with `clientType: extractDealKind === "lease" ? (mattRepresented === "tenant" ? "tenant" : "active_listing_client") : "active_buyer_client"`.
5. Look up `Property` by `propertyAddress` (use existing fuzzy-match helper if any; else direct equality on `address`). Allow `null`.
6. Upsert `LeaseRecord` keyed by `(contactId, propertyId, leaseStartDate)` for leases, `(contactId, closeDate)` for sales — fall back to creating new if no key fields are present (low-confidence guard already filtered most of those). Include `extractionConfidence` and `sourceCommunicationId`.
7. If `leaseEndDate` is non-null AND in the future, upsert a `CalendarEvent` with `eventKind: "lease_renewal"`, `startDate: leaseEndDate`, `leaseRecordId`, linked entities. Idempotency key = `(leaseRecordId, eventKind: "lease_renewal")`.
8. Apply `Contact.clientType` lifecycle: if `closeDate` is in the past AND `dealKind === "lease"` AND tenant-side → `past_tenant_client`; if owner-side → `past_listing_client`. For sales: `past_buyer_client` / `past_seller_client` based on `mattRepresented`. (Use a `nextClientType()` pure helper.)
9. Return `{ok: true, leaseRecordId, calendarEventId, contactId}`.

All DB writes inside a single `db.$transaction`.

- [ ] **Step 4: Tests for: already-processed shortcut, classifier returns `not_a_deal`, low-confidence extraction, missing-property fallback (LeaseRecord with `propertyId: null`), past-dated close (no calendar event), idempotent re-run produces no duplicate rows.**

- [ ] **Step 5: Add `processBacklogClosedDeals(opts)` driver:**

```typescript
export interface BacklogOpts {
  batchSize?: number     // default 50
  throttleMs?: number    // default 250
  maxBatches?: number    // default Infinity
  cursorKey?: string     // SystemState row key, default "closed-deal-backlog-cursor"
}
```

Loops Communications missing the version stamp, oldest first by `receivedAt`, in batches. After each Communication: respect budget (`assertWithinScrubBudget` — bail if `ScrubBudgetError`), respect throttle. Persist cursor (`lastProcessedCommunicationId` + `lastProcessedReceivedAt`) to `SystemState` after each batch. Returns `{processed, leaseRecordsCreated, errors[], stoppedReason: "complete"|"budget"|"max_batches"|"error"}`.

- [ ] **Step 6: Test the backlog driver with a fake DB layer and a mocked orchestrator hook.**

- [ ] **Step 7: Commit.**

```bash
git add full-kit/src/lib/ai/lease-pipeline-orchestrator.ts full-kit/src/lib/ai/lease-pipeline-orchestrator.test.ts full-kit/src/lib/system-state/automation-settings.ts
git commit -m "feat(ai): lease pipeline orchestrator + backlog driver"
```

### Task 1.6: API route for the backlog driver

**Files:**
- Create: `full-kit/src/app/api/lease/process-backlog/route.ts`
- Test: smoke via `curl` after restart (route tests are heavy in this codebase; a manual smoke is fine here).

- [ ] **Step 1: Create POST handler.**

```typescript
import { NextResponse } from "next/server"
import { processBacklogClosedDeals } from "@/lib/ai/lease-pipeline-orchestrator"
import { constantTimeEquals } from "@/lib/msgraph/constant-time-compare"

export async function POST(req: Request) {
  const adminToken = req.headers.get("x-admin-token") ?? ""
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected || !constantTimeEquals(adminToken, expected)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const result = await processBacklogClosedDeals({
    batchSize: typeof body.batchSize === "number" ? body.batchSize : 50,
    throttleMs: typeof body.throttleMs === "number" ? body.throttleMs : 250,
    maxBatches: typeof body.maxBatches === "number" ? body.maxBatches : 10,
  })
  return NextResponse.json({ ok: true, ...result })
}
```

- [ ] **Step 2: Commit.**

### Task 1.7: Phase 1 — full test + typecheck gate

- [ ] **Step 1: Run the full vitest suite.**

```bash
cd full-kit && pnpm test
```
Expected: all pass.

- [ ] **Step 2: Run the typechecker.**
```bash
cd full-kit && pnpm exec tsc --noEmit --pretty false
```
Expected: zero errors.

- [ ] **Step 3: Mark Phase 1 build complete in the parent TodoWrite.**

### Phase 1 acceptance

- Both `callClassifier()` and `callExtractor()` make real HTTP calls to their respective providers.
- Prompts are written, version-bumped, cached on first read.
- `processCommunicationForLease(id)` round-trips one synthetic Communication → `LeaseRecord` + `CalendarEvent` end-to-end (verified by a Vitest integration test using DB).
- `processBacklogClosedDeals` is cursor-driven, idempotent, and budget-aware.
- Full test + typecheck clean.

---

## Phase 1 — Adversarial audit

Dispatched as a fresh `superpowers:code-reviewer` sub-agent immediately after Phase 1 build claims complete. Audit checklist:

- [ ] **Idempotency:** does re-processing a Communication cause duplicate LeaseRecord / CalendarEvent / Contact rows? Show the test that proves no.
- [ ] **Cost guardrails:** does every external API call write a `ScrubApiCall` row with a non-zero `estimatedUsd`? What happens when the budget cap is hit mid-batch? Are partial writes left in inconsistent state?
- [ ] **Sensitive content:** does the `containsRawSensitiveData` gate in the classifier still fire? What about the extractor when it gets a body with raw banking info? Are gated rows stamped so re-runs don't re-attempt them?
- [ ] **Validator strictness:** can the AI return an obviously bad value (e.g., `confidence: 1.5`, `leaseEndDate: "2026-13-99"`) and have it land in DB anyway? Trace the path.
- [ ] **Race conditions:** what if the same Communication is processed by two concurrent backlog runs? Does the metadata stamp + transactional upsert prevent double-writes?
- [ ] **Schema fidelity:** every field written matches the Prisma schema's column type, nullability, and enum constraints. Run `pnpm prisma validate`.
- [ ] **Auth on `/api/lease/process-backlog`:** constant-time compare on the admin token, behavior when token is missing/empty.
- [ ] **Prompt loading:** what if the prompt MD file is missing at runtime? Does the orchestrator fail loudly or silently produce garbage?
- [ ] **Untested branches:** any `if/else` in the orchestrator without a corresponding test? List them.

If audit returns critical/high issues → spawn a follow-up build sub-agent to fix them. Audit re-runs after the fix. No Phase 2 until audit is clean.

---

## Phase 2 — PDF attachment download + Haiku-vision lease extractor

**Goal:** When the body-only extractor returns null/low-confidence and the Communication has a PDF attachment, download the PDF and send it to Haiku for structured extraction. Same output schema as the body extractor.

### Task 2.1: Graph attachment download helper

**Files:**
- Create: `full-kit/src/lib/msgraph/download-attachment.ts`
- Test: `full-kit/src/lib/msgraph/download-attachment.test.ts`

- [ ] **Step 1: Failing test mocking `fetch` for a single Graph `/messages/{id}/attachments/{aid}` call returning a base64 `contentBytes`.**

- [ ] **Step 2: Implement.**

```typescript
import "server-only"
import { getAccessToken } from "./token-manager"
import { GRAPH_BASE_URL } from "./client"

export interface AttachmentBlob {
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: Buffer
}

export async function downloadAttachment(
  messageId: string,
  attachmentId: string
): Promise<AttachmentBlob> {
  const token = await getAccessToken()
  const upn = process.env.MSGRAPH_TARGET_UPN
  if (!upn) throw new Error("MSGRAPH_TARGET_UPN not set")
  const url =
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(upn)}` +
    `/messages/${encodeURIComponent(messageId)}` +
    `/attachments/${encodeURIComponent(attachmentId)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`download attachment failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const json = await res.json() as {
    id?: string; name?: string; contentType?: string; size?: number; contentBytes?: string
  }
  if (!json.contentBytes) throw new Error("attachment payload missing contentBytes")
  return {
    id: json.id ?? attachmentId,
    name: json.name ?? "(unnamed)",
    contentType: json.contentType ?? "application/octet-stream",
    size: json.size ?? 0,
    contentBytes: Buffer.from(json.contentBytes, "base64"),
  }
}
```

- [ ] **Step 3: Test, commit.**

### Task 2.2: PDF lease extractor

**Files:**
- Create: `full-kit/src/lib/ai/pdf-lease-extractor.ts`
- Test: `full-kit/src/lib/ai/pdf-lease-extractor.test.ts`

- [ ] **Step 1: Failing test mocking the Anthropic SDK's `messages.create` and asserting the request body contains a `document` content block (`source.type: "base64"`, `media_type: "application/pdf"`, `data: <base64>`).**

- [ ] **Step 2: Implement `extractLeaseFromPdf({pdf: Buffer, classification, signals, subject})`.**

Skip the call (return `{ok:false, reason:"file_too_large"}`) if `pdf.length > 32 * 1024 * 1024`. Skip non-PDF (`reason: "not_pdf"`) — content-type check is the caller's job, but defend anyway by sniffing the magic bytes (`%PDF-`).

Reuse the same `EXTRACT_TOOL` schema and prompt MD file from Task 1.4 (don't fork the prompt — the tool schema is the contract). The user content carries: classification, signals, subject as text; the PDF as a `document` block with `cache_control: {type: "ephemeral"}` so a re-extraction on the same PDF reads from cache.

Validate via the existing `validateLeaseExtraction` (export it from `lease-extractor.ts`).

Cost log to `ScrubApiCall` with `purpose: "pdf_lease_extractor"`. PDF input is billed by tokens (Anthropic estimates ~1500-3000 tokens per page); cap pages by passing `max_tokens: 1024` on output and rejecting PDFs >50 pages (read page count from the PDF magic — or just rely on file-size cap).

- [ ] **Step 3: Test happy path + oversize + non-PDF + validation-failure paths.**

- [ ] **Step 4: Commit.**

### Task 2.3: Wire PDF fallback into the orchestrator

**Files:**
- Modify: `full-kit/src/lib/ai/lease-pipeline-orchestrator.ts`

- [ ] **Step 1: Add a failing test: classifier returns `closed_lease`, body extractor returns `low_confidence`, Communication has one PDF attachment → orchestrator downloads it, runs `extractLeaseFromPdf`, succeeds, and creates the LeaseRecord/CalendarEvent.**

- [ ] **Step 2: Implement the fallback.**

After the `low_confidence`/`stub_no_response`/`validation_failed` branch:
1. Pull `Communication.attachments` (already an array of `AttachmentMeta`).
2. Filter for `contentType === "application/pdf"` AND `attachmentType === "file"` AND `size <= 32 * 1024 * 1024`.
3. For each (in order): `downloadAttachment(externalMessageId, attachment.id)`, then `extractLeaseFromPdf(...)`. First one to validate wins.
4. If still nothing → stamp `metadata.leaseExtractionAttempt.pdfAttempted = true` so backlog re-runs skip it.

- [ ] **Step 3: Test the chained-fallback paths: only-body works, body fails + PDF works, both fail.**

- [ ] **Step 4: Commit.**

### Task 2.4: Phase 2 test + typecheck gate

- [ ] **Step 1:** `pnpm test`
- [ ] **Step 2:** `pnpm exec tsc --noEmit --pretty false`

### Phase 2 acceptance

- Graph attachment download works (verified against a real Communication with a known PDF — manual smoke).
- `extractLeaseFromPdf` round-trips a 1-page test PDF (vendored under `tests/fixtures/sample-lease.pdf`) end-to-end with the mocked Anthropic SDK.
- Orchestrator falls back to PDF correctly; first-success-wins; failure path is stamped to prevent re-attempts.

---

## Phase 2 — Adversarial audit

Sub-agent checklist:

- [ ] **Cost runaway:** worst-case total spend if the orchestrator loops over a Communication with 10 PDF attachments? Where's the per-Communication cap? Add one if missing.
- [ ] **Memory:** are PDFs streamed or buffered? A 32 MB cap per attachment is fine, but if 50 are processed in parallel → 1.6 GB resident. Confirm the backlog driver runs strictly serial.
- [ ] **PDF magic-byte check:** can a malicious filename + wrong content-type bypass the sniff? What does Haiku do if it gets a non-PDF blob?
- [ ] **Cache hit math:** does `cache_control` on the document block actually hit on repeat runs of the same PDF? Check Anthropic's caching minimums (1024 tokens for Haiku) — small PDFs may not cache.
- [ ] **Token leakage:** does the Graph access token ever reach a log line, error message, or response body?
- [ ] **Idempotency under partial failure:** what if Graph returns a PDF but extraction fails? Does the metadata stamp prevent re-download next run?

Fix-loop until clean.

---

## Phase 3 — Backfill execution

This Phase is **operator-driven**, not sub-agent-driven. The previous Phases produced the tools; this Phase runs them. The runbook lives at `docs/superpowers/notes/2026-05-02-backfill-runbook.md` (created in Task 3.1).

### Task 3.1: Write the runbook

**Files:**
- Create: `docs/superpowers/notes/2026-05-02-backfill-runbook.md`

- [ ] **Step 1: Document every shell step, including:**
  - Bumping `ROUTE_SENSITIVE_TO_CLAUDE=true` and `SCRUB_DAILY_BUDGET_USD=30` in `.env.local`.
  - Restarting the dev server (`pnpm dev`).
  - Confirming the four required env vars are loaded (`echo $ANTHROPIC_API_KEY | wc -c`, etc.).
  - Background email-history scan invocations (inbox + sentitems), with `nohup` so they survive terminal close.
  - Tail commands for the log files.
  - The classification-extraction backlog sweep (POST loop).
  - The renewal-alert sweep (POST `/api/lease/renewal-sweep`).
  - Roll-forward query: `SELECT date_trunc('year', received_at) y, count(*) FROM communications GROUP BY 1 ORDER BY 1;`
  - LeaseRecord / CalendarEvent / Contact distribution queries for the verification report.

- [ ] **Step 2: Commit.**

### Task 3.2: Kick off the email history scan (inbox)

- [ ] **Step 1: Source env, set new flags.**

```bash
cd full-kit
sed -i 's/^ROUTE_SENSITIVE_TO_CLAUDE=.*/ROUTE_SENSITIVE_TO_CLAUDE=true/' .env.local
echo "SCRUB_DAILY_BUDGET_USD=30" >> .env.local  # if not already set
set -a && source .env.local && set +a
```

- [ ] **Step 2: Start dev server in background.**

Use Bash `run_in_background: true`:
```bash
cd full-kit && pnpm dev > .logs/devserver.log 2>&1
```

Wait until `Ready in` appears in the log.

- [ ] **Step 3: Start the inbox scan in background.**

```bash
cd full-kit && node scripts/lease-history-scan.mjs --start-year=2026 --end-year=2016 --folder=inbox > .logs/lease-history-inbox.log 2>&1
```

Use `run_in_background: true`. Monitor via tail.

- [ ] **Step 4: Watch for the first invocation to succeed (sees rows, doesn't error).**

If it errors immediately (auth/perm) → fix before going further.

### Task 3.3: Kick off the email history scan (sentitems)

- [ ] **Step 1: Same as 3.2 with `--folder=sentitems`.**

These two run in parallel — the scan engine throttles to 1 req/sec per folder.

### Task 3.4: Run the classification + extraction backlog sweeps

Do NOT start this until at least 50K Communications have landed (otherwise the orchestrator just waits between batches). Check via `SELECT count(*) FROM communications;`.

- [ ] **Step 1: First small sweep to validate the orchestrator end-to-end on real data.**

```bash
curl -s -X POST http://localhost:3000/api/lease/process-backlog \
  -H "x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"batchSize": 10, "maxBatches": 1, "throttleMs": 500}'
```

- [ ] **Step 2: Inspect the response and 3 created LeaseRecords by hand. If garbage, STOP and revise the prompts.**

- [ ] **Step 3: Run progressively larger sweeps until the budget cap or completion is hit.**

Loop in a script (`scripts/process-closed-deal-backlog.mjs`) — calls the route, prints results, sleeps 5s, calls again, exits when `stoppedReason === "complete"`.

### Task 3.5: Renewal alert sweep

- [ ] **Step 1: Hit `POST /api/lease/renewal-sweep` once.**

Confirm response shows `candidatesFound > 0` and a list of outcomes with `todoId`/`calendarEventId`/`pendingReplyId`.

### Phase 3 acceptance

- Communication count >= 200K (proves backfill traversed years of mail).
- LeaseRecord count >= 50.
- CalendarEvent count of `eventKind="lease_renewal"` matches LeaseRecords with future `leaseEndDate`.
- Renewal sweep produced at least 1 PendingReply for an upcoming-expiration lease.
- Total Anthropic + DeepSeek spend (sum of `ScrubApiCall.estimatedUsd` for the past 24h) <= $100.

---

## Phase 3 — Adversarial audit

Sub-agent runs after backfill completes. Checklist:

- [ ] **Sample 10 LeaseRecords at random (`ORDER BY random() LIMIT 10`). For each, open the source Communication and confirm the extracted fields are correct. Report accuracy %.**
- [ ] **Look for systemic bias: any field where >30% of LeaseRecords have null when the source clearly had it? That's a prompt bug.**
- [ ] **Check for duplicates: `SELECT contact_id, lease_start_date, count(*) FROM lease_records GROUP BY 1,2 HAVING count(*) > 1;`. Should be empty.**
- [ ] **Check budget log: any individual `ScrubApiCall` with `estimatedUsd > 0.50`? Investigate.**
- [ ] **Check error log: how many Communications failed processing? If >5%, identify the failure pattern.**
- [ ] **Check `contact.clientType` distribution before vs after — confirm `past_*_client` populations grew.**

Findings go to `docs/superpowers/notes/2026-05-02-backfill-audit.md`.

---

## Phase 4 — Browser verification

Use the `preview_*` tools. Document each step with screenshots.

### Task 4.1: Calendar tab

- [ ] **Step 1: `preview_start` if not running. Navigate to `/en/apps/calendar`.**
- [ ] **Step 2: `preview_screenshot` — confirm the month grid renders without console errors.**
- [ ] **Step 3: `preview_console_logs` — assert no errors.**
- [ ] **Step 4: `preview_click` on a `lease_renewal` event. Drawer opens.**
- [ ] **Step 5: Inside the drawer, click each action button: Mark complete, Dismiss, Open lease, Open contact. Each navigates correctly or updates state.**
- [ ] **Step 6: Filter chip flow: click `lease_renewal` chip — only renewal events visible. Click `meeting` — meetings visible. Reset.**
- [ ] **Step 7: Date-range nav: click "Next 90 days", "Next 12 months". `preview_snapshot` confirms event counts change.**

### Task 4.2: Dashboard banner

- [ ] **Step 1: Navigate to `/en/dashboards/analytics` (the configured home). `preview_screenshot`.**
- [ ] **Step 2: If the "N leases up this quarter" banner doesn't exist, file a separate task — Component E in the spec lists it but it may not be wired. Document the gap in the verification report.**

### Task 4.3: Pending Replies queue

- [ ] **Step 1: Navigate to `/en/pages/pending-replies`. `preview_screenshot`.**
- [ ] **Step 2: Filter by `outreachKind=lease_renewal`. Confirm 1+ entries.**
- [ ] **Step 3: Click into one. Confirm the draft body is the renewal-outreach style ("It's been a while…"). Approve button visible (Send may 503 due to Mail.Send permission — that's expected).**

### Task 4.4: Contacts list with new clientType filter

- [ ] **Step 1: Navigate to `/en/pages/contacts`. Filter `clientType = past_listing_client`. Confirm count > 0 (post-backfill).**
- [ ] **Step 2: Open one Contact. Navigate to its Lease tab (or whatever the lease-records surface is named). Confirm 1+ LeaseRecord rows with non-null `leaseEndDate`.**

### Task 4.5: Todos page

- [ ] **Step 1: Navigate to `/en/apps/todos`. Search "lease renewing". Confirm 1+ matching Todos created by `lease-renewal-sweep`.**

### Task 4.6: Final report

- [ ] **Step 1: Write `docs/superpowers/notes/2026-05-02-backfill-final-report.md` with:**
  - Final row counts (Communication, LeaseRecord, CalendarEvent, PendingReply by outreachKind, Contact by clientType).
  - Total cost (sum from ScrubApiCall).
  - Sample accuracy from the Phase 3 audit.
  - Browser verification screenshot paths.
  - Open issues (anything that didn't render correctly, any UI gap).

- [ ] **Step 2: Commit the report.**

### Phase 4 acceptance

- Every UI surface in the spec's Component E renders without console errors.
- Every action button round-trips a successful response (or a documented expected error like Mail.Send 503).
- Final report committed.

---

## Self-review checklist

- **Spec coverage:** Every Component (A/B/C/D/E) maps to a Phase (1/1/2/3/4). ✓
- **Placeholders:** Searched the plan — no "TBD" / "implement later" / "similar to X" left. ✓
- **Type consistency:** `LeaseExtraction`, `ClosedDealClassification`, `LeaseRecord` field names match the spec and existing schema. `processCommunicationForLease` signature is consistent across Tasks 1.5 / 2.3. ✓
- **Sub-agent execution model:** Build agents per Phase + adversarial audit gate before next Phase. ✓
- **Cost cap:** `SCRUB_DAILY_BUDGET_USD` raised to $30 for backfill mode; orchestrator pauses cleanly on cap. ✓
