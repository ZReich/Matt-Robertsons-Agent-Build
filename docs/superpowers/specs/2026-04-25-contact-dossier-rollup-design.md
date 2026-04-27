# Contact/Client Dossier Rollups from Historical Email - Design

**Date:** 2026-04-25
**Author:** Zach Reichert (with Codex/Ralplan)
**Status:** Draft for implementation
**Depends on:** [AI Scrub Backfill Orchestration](2026-04-25-email-ai-scrub-backfill-orchestration-design.md), [Communication Contact Backfill](2026-04-25-communication-contact-backfill-design.md)
**Related:** [AI Email Scrub](2026-04-24-ai-email-scrub-design.md), [Dashboard Hub](2026-04-24-dashboard-hub-design.md), [Pipeline Kanban](2026-04-24-pipeline-kanban-design.md)

---

## Problem

Per-email AI scrub creates summaries, tags, candidate links, and proposed actions, but it does not answer the broader user need: "build out their files" for each contact/client.

Matt needs each Contact/client record to accumulate what the system knows across historical email:

- who the person is,
- what properties/topics they are tied to,
- open loops and likely todos,
- recent sentiment and urgency,
- key dates mentioned,
- likely deal/client context,
- what the AI believes Matt should remember before contacting them.

---

## Decision

Use `AgentMemory` as the v1 storage target for dossiers instead of adding `Contact.dossier` JSON immediately.

Rationale:

- `AgentMemory` already has `memoryType='client_note'`, `contactId`, `dealId`, `priority`, and tags.
- It avoids schema churn while the dossier shape stabilizes.
- It can be regenerated/upserted per contact after scrub output changes.
- It is consistent with the scrub spec's `create-agent-memory` vocabulary.

A future migration may denormalize the latest dossier summary into `Contact.dossier` if UI performance requires it.

---

## Goals

- Generate one current dossier memory per Contact with enough linked/scrubbed email history.
- Prioritize clients/leads first:
  1. Contacts with active Deals.
  2. Contacts with `leadSource IS NOT NULL`.
  3. Contacts with recent signal/uncertain communications.
  4. All remaining linked contacts if budget/time permits.
- Build dossiers from scrub summaries and metadata first, not full email bodies, to reduce cost and privacy exposure.
- Use cheap/fast configured model for normal dossier rollups; reserve stronger reasoning only for high-value active clients or conflicting histories.
- Make dossier generation idempotent and refreshable.
- Surface the data later on Contact detail, Lead cards, and Deal cards.

## Non-goals

- No dossier for unlinked communications; link first.
- No automatic overwriting of user-authored `Contact.notes`.
- No new UI in v1, though this spec defines UI consumption shape.
- No sending emails/texts or changing deal stages from dossier generation.
- No full-body rollup unless `metadata.scrub` is absent and an operator explicitly enables a fallback.

---

## Dossier memory contract

Create or update one `AgentMemory` row per Contact:

```ts
AgentMemory {
  memoryType: "client_note",
  title: `Email dossier - ${contact.name}`,
  content: markdown,
  priority: "medium" | "high" | "urgent" | null,
  contactId: contact.id,
  dealId: singleActiveDealIdOrNull,
  tags: [
    "contact-dossier",
    "email-backfill",
    `dossier-version:v1`,
    `source-count:${n}`
  ],
  lastUsedAt: null
}
```

### Audit/action backlink requirement

Dossier generation is an automatic Supabase write, so it must have a durable
run/audit record. For each materialized dossier, create an `AgentAction` row and
link the generated memory back to it:

```ts
AgentAction {
  actionType: "upsert-contact-dossier",
  tier: "log_only",
  status: "executed",
  summary: `Generated email dossier for ${contact.name}`,
  targetEntity: `contact:${contact.id}`,
  payload: {
    runId,
    dossierVersion: "v1",
    sourceCommunicationIds,
    sourceCount,
    latestSourceCommunicationAt,
    modelUsed,
    confidence
  },
  executedAt: now()
}

AgentMemory.agentActionId = agentAction.id
```

This is not a user approval request; it is an audit trail for an automated
rollup. If generation fails after the model call but before memory write, record
the failed run in `SystemState` or an `AgentAction(status='rejected')` with
feedback so the run is still explainable.

Because there is no unique constraint for `(contactId, memoryType, tag)`, implementation should upsert by query convention:

1. Find `AgentMemory` where `contactId=<id>`, `memoryType='client_note'`, and tags contains `contact-dossier`.
2. Update if exactly one exists.
3. If none exists, create.
4. If multiple exist, update the newest and tag older duplicates with `contact-dossier-superseded` or report for cleanup.

### Markdown content shape

```md
# Email dossier - {Contact Name}

_Last generated: 2026-04-25T...Z_
_Source: {n} scrubbed communications, {m} pending actions, {date range}_
_Confidence: high|medium|low_

## Snapshot
1-2 paragraph summary of relationship and current state.

## Current open loops
- [priority] Task or follow-up, with source communication date/id when available.

## Known interests / properties
- Property/topic, evidence, recency.

## Communication style and preferences
- How they communicate, response expectations, preferred channel if known.

## Sentiment / risk
- Trend and any frustration or urgency.

## Key dates
- Date - why it matters - source.

## Source rollup
- Most recent important emails with dates and short summaries.
```

---

## Source data selection

For each Contact:

1. Select linked `Communication` rows where `contactId=<contact.id>` and `archivedAt IS NULL`.
2. Prefer rows with `metadata.scrub`.
3. Include at most:
   - 50 most recent scrubbed signal/uncertain communications,
   - plus any urgent/replyRequired rows outside that window,
   - plus pending `AgentAction` rows targeting those communications.
4. Include active `Deal` context for the contact.
5. Include existing `AgentMemory` items for the contact except the dossier being regenerated.

Do not include noise rows unless they have an explicit scrub or lead/platform extraction marker.

---

## Model and cost policy

Dossier inputs should be compact structured summaries:

```ts
interface DossierInput {
  contact: { id: string; name: string; company?: string; email?: string; leadSource?: string; leadStatus?: string }
  deals: Array<{ id: string; propertyAddress: string; stage: string; value?: string | null }>
  communications: Array<{
    id: string
    date: string
    direction: "inbound" | "outbound" | null
    subject: string | null
    scrubSummary: string
    topicTags: string[]
    urgency: string
    replyRequired: boolean
    sentiment: string | null
  }>
  pendingActions: Array<{ id: string; actionType: string; summary: string; payload: unknown }>
  existingMemories: Array<{ title: string; content: string }>
}
```

Default model lane: `EMAIL_AI_DOSSIER_MODEL` cheap/fast alias.

Escalate only for:

- active clients with active deal value above configured threshold,
- high urgency/frustrated sentiment involving active deals,
- conflicting summary evidence that the fast model flags as low confidence.

---

## Operational surface

Preferred implementation shape:

```txt
full-kit/src/lib/ai/dossier-rollup.ts
full-kit/src/lib/ai/dossier-rollup.test.ts
full-kit/src/app/api/integrations/dossiers/backfill/route.ts
full-kit/src/app/api/integrations/dossiers/run/route.ts
full-kit/src/app/api/integrations/dossiers/stats/route.ts
```

A queue table is optional. For v1, `SystemState` plus idempotent batch selection is enough if batches are small. Add a dedicated `DossierQueue` only if Vercel runtime limits make resumability unreliable.

Admin route request:

```json
{
  "dryRun": true,
  "limit": 50,
  "priority": "clients-first",
  "onlyContacts": [],
  "runId": "dossier-20260425-001"
}
```

Dry-run reports which contacts are eligible and why, without model calls unless `includePromptPreview=true`.

---

## Refresh policy

- Initial historical backfill runs after scrub backfill and contact-link candidate application.
- Ongoing refresh options:
  - regenerate on demand from Contact detail page,
  - nightly refresh for contacts with new scrubbed communications since last dossier generation,
  - immediate refresh only for high-priority active clients if new urgent/frustrated scrub appears.

Store generation metadata in tags or content header:

- `dossier-version:v1`
- source communication count
- latest source communication date
- model used
- runId

---

## UI consumption contract (future work)

Contact detail page:

- Show latest `AgentMemory(memoryType='client_note', tags contains 'contact-dossier')` as "AI dossier".
- Show generated timestamp and source count.
- Provide "regenerate" action behind admin/operator guard initially.

Lead card / Deal card:

- Show first 1-2 lines from `## Snapshot`.
- Show open-loop count and most urgent open-loop label.
- Never show low-confidence dossier without a "low confidence" badge.

---

## Acceptance criteria

1. Dossier generation only considers linked contacts; no unlinked email is assigned to a dossier.
2. Dossier input is built from scrub metadata by default, not full bodies.
3. One active dossier memory exists per Contact after generation; duplicates are handled safely.
4. Contact notes are not overwritten.
5. Active clients and leads can be prioritized before low-value contacts.
6. Dry-run mode performs no model calls and no database writes.
7. Write mode records enough metadata to identify runId, version, source count, latest source date, and model used.
8. Low-confidence or insufficient-history contacts are skipped or marked low confidence rather than hallucinated.
9. New scrubbed communications can trigger refresh without reprocessing every contact.
10. Every materialized dossier has an `AgentAction(actionType='upsert-contact-dossier')` audit row linked through `AgentMemory.agentActionId`, or a failure record if generation did not commit.

---

## Test plan

### Unit tests

- `buildDossierInput()` selects scrubbed signal/uncertain rows and excludes noise by default.
- Source selection caps normal rows but includes urgent/replyRequired out-of-window rows.
- Pending `AgentAction`s tied to source communications are included.
- Upsert logic creates first dossier, updates existing dossier, and handles duplicates safely.
- Dossier write creates an executed `AgentAction` audit row and links `AgentMemory.agentActionId`.
- Dry-run returns eligible contacts without model calls.
- Low-information contacts are skipped or produce low-confidence output.
- Markdown validator requires Snapshot, Open loops, Known interests/properties, Sentiment/risk, and Source rollup sections.

### Integration checks

```powershell
pnpm test -- dossier-rollup
pnpm exec tsc --noEmit
pnpm lint
```

Manual checks:

1. Run dry-run clients-first with `limit=20`.
2. Review prompt/input preview for 3 active clients and 3 leads.
3. Run write for a tiny batch.
4. Confirm `AgentMemory` rows link to correct `contactId` and optional `dealId`.
5. Confirm Contact detail query can retrieve the latest dossier memory.
6. Confirm regeneration updates the same memory rather than creating duplicates.

---

## Sequencing

1. Deterministic communication/contact link backfill.
2. Lead extractor diagnostics and reprocess if needed.
3. AI scrub backfill.
4. High-confidence scrub candidate link application.
5. Contact/client dossier rollup.
6. Future UI surfaces and unknown-sender promotion.

---

## Remaining risks

- Dossiers are only as accurate as contact linking. Wrong links create wrong dossiers; this is why deterministic and high-confidence linking gates come first.
- Existing `AgentMemory` has no uniqueness constraint for dossiers, so implementation needs careful duplicate handling.
- If scrub summaries are too shallow, dossier quality may require a prompt/schema revision rather than stronger model spend.
- A future UI may need a denormalized `Contact.dossier` field for performance; v1 deliberately avoids that until real usage proves it necessary.
