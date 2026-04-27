> **Filter-audit supersession notice (2026-04-26):** Before any new 90-day or 365-day pull, hard-drop/pre-download skip rules from this spec must satisfy the audit requirements in `docs/superpowers/specs/2026-04-26-transcript-email-communication-handling-design.md`. Broad CRE-domain drops are not safe by default; questionable rows must be quarantined/uncertain, not skipped.
# Email Ingestion — Design

**Date:** 2026-04-23
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review
**Depends on:** [Microsoft Graph / Outlook Connection Layer](2026-04-16-msgraph-outlook-connection-design.md), [Microsoft Graph Contact Sync](2026-04-22-contact-sync-design.md)

---

## Context

Matt Robertson's Outlook mailbox contains ~92,400 messages over the last 365 days (verified via sender-recon 2026-04-23). Most of it is CRE-industry noise — listing broadcasts, platform newsletters, bulk marketing. A meaningful minority is real business: internal NAI co-brokerage (~50% of his deals), outside-broker colleague referrals from SIOR/Cushman/JLL/Colliers (~30%), and direct-client + platform-lead traffic (~20%).

Critically, Matt has the Outlook Focused/Other inbox split turned on, and Crexi's lead-inquiry emails land in his Other bucket — so he never sees them. This is the missed-deals problem happening right now, not a hypothetical. The ingester's first job is to catch and surface that traffic.

This spec covers the **email ingestion pipeline**: Graph delta sync of both inbound and outbound mail, a three-layer filter that strips noise and auto-promotes clear signal, platform-aware extraction for Crexi/LoopNet/Buildout leads, and storage into the `Communication` table with rich metadata tags that enable follow-up specs to mutate Deal/Lead/Todo state without re-ingesting.

This spec does **not** cover:

- Mutating `Deal` rows from Buildout event emails (tagged during ingestion, consumed by a follow-up spec)
- Auto-creating `Todo` rows from lead or task emails (same — metadata tagged now, consumed later)
- The LLM classifier for the ambiguous middle (Layer C rows are stored as `uncertain`; a sibling spec reads them back and classifies)
- Attachment binary download (metadata only in this spec; promotion to `DealDocument` is a later spec)
- Signature parsing and contact enrichment (later spec)
- Auto-reply workflows for Crexi / LoopNet leads (later spec)
- UI work on Clients / Contacts / Leads tabs (frontend work, separate track)
- Production cron / webhook triggers (the function is callable; wiring is deferred)

## Goals

- Populate `Communication` from Outlook inbox + sent items for the last 90 days (extendable to 365 via config) with a single function callable by the rest of the codebase: `syncEmails(): Promise<SyncResult>`
- Correctly tag each row's `classification` (`signal` / `noise` / `uncertain`), `source` (`crexi-lead`, `buildout-event`, `nai-internal`, etc.), and platform-specific extracts so downstream specs have everything they need
- Auto-populate `Contact.leadSource` / `leadStatus` for inquirers extracted from Crexi / LoopNet / Buildout emails, so the new Leads tab has real data from day one
- Surface the "missed leads in Other folder" payoff as a side effect of ingestion + tagging
- Lay the pattern for future message-volume ingesters (Plaud transcripts, SMS, call logs)

## Non-goals

- Deleting or archiving original messages in Outlook (read-only)
- Bidirectional sync (no writes from CRM → Outlook)
- Cross-mailbox ingestion (Matt's mailbox only; the `MSGRAPH_TARGET_UPN` gate still applies)
- Classifier-driven tagging in this spec (`uncertain` rows sit until the classifier spec lands)
- Changing the `DealStage` enum or the Pipeline UI — those are separate specs when the Kanban dashboard lands

---

## Schema changes

One targeted change to `Contact`:

```prisma
enum LeadSource {
  crexi
  loopnet
  buildout
  email_cold     // cold inbound email, sender not previously known
  referral       // came via another Contact, detected by body-parse or manual tag
}

enum LeadStatus {
  new            // auto-created, not yet reviewed
  vetted         // Matt or Genevieve reviewed and confirmed real
  contacted      // replied to at least once
  converted      // became a Client (has a Deal) — kept for reporting, normally UI hides these from Leads tab
  dropped        // not real / not interested / ghosted
}

model Contact {
  // ...existing fields unchanged...
  leadSource   LeadSource?   @map("lead_source")
  leadStatus   LeadStatus?   @map("lead_status")
  leadAt       DateTime?     @map("lead_at")   // when this row was first marked as a lead; differs from createdAt for existing contacts who later surface as leads
}
```

**Why columns-on-Contact rather than a separate `Lead` table:**

- A lead that becomes a client should not change table or row — `Contact` stays stable, its `leadStatus` moves to `converted`, the UI's lead filter stops including it.
- All the relations we'd want on a Lead (communications, meetings, todos, agent memories) already exist on Contact.
- If lead-specific fields accumulate later (qualifying questionnaire, referrer pointer, stage timestamps), split to a `LeadProfile` companion table then. Don't prematurely model.

**Derived views for the People sidebar:**

- **Clients tab:** `Contact` with `deals.length >= 1`
- **Contacts tab:** `Contact` with `leadSource IS NULL` AND no deals
- **Leads tab:** `Contact` with `leadSource IS NOT NULL` AND `leadStatus != 'converted'`

These are Prisma query filters in the UI layer, not DB views. No materialization.

---

## File layout

```
full-kit/
├── prisma/
│   └── migrations/
│       └── <timestamp>_add_contact_lead_fields/  # NEW migration
├── src/
│   ├── lib/
│   │   └── msgraph/
│   │       ├── emails.ts                # NEW — main sync orchestrator
│   │       ├── emails.test.ts           # NEW
│   │       ├── email-filter.ts          # NEW — pure Layer A/B rule engine
│   │       ├── email-filter.test.ts     # NEW
│   │       ├── email-extractors.ts      # NEW — Crexi/LoopNet/Buildout body parsers
│   │       ├── email-extractors.test.ts # NEW
│   │       ├── email-types.ts           # NEW — shared types (GraphEmailMessage, IngestedRow, etc.)
│   │       ├── sender-normalize.ts      # NEW — X.500 Exchange DN → SMTP address normalizer
│   │       └── index.ts                 # MODIFY — barrel adds syncEmails, SyncEmailResult
│   └── app/
│       └── api/
│           └── integrations/
│               └── msgraph/
│                   └── emails/
│                       └── sync/
│                           └── route.ts  # NEW — gated POST dev trigger
```

**Size guardrail:** if `emails.ts` crosses ~350 lines, split the orchestrator into `emails/sync.ts` and keep the top-level file a thin re-export. `email-filter.ts`, `email-extractors.ts`, `sender-normalize.ts` stay small and pure by construction.

**Boundary rule (inherited):** nothing outside `src/lib/msgraph/` imports Microsoft Graph code. Downstream specs that want to act on ingested rows read from the `Communication` table via Prisma, not through Graph.

---

## Public API

```ts
export async function syncEmails(options?: SyncEmailOptions): Promise<SyncEmailResult>

export interface SyncEmailOptions {
  /** Lookback window in days. Default 90. Ignored after the first successful run — subsequent runs use the stored delta cursor. */
  daysBack?: number;
  /** If true, delete the stored cursor and re-bootstrap from `daysBack`. Default false. */
  forceBootstrap?: boolean;
}

export interface SyncEmailResult {
  isBootstrap: boolean;
  bootstrapReason?: "no-cursor" | "delta-expired" | "forced";
  skippedLocked: boolean;
  perFolder: Record<"inbox" | "sentitems", FolderSyncSummary>;
  contactsCreated: number;          // new Contacts created from extracted lead inquirers
  leadsCreated: number;             // subset of contactsCreated where leadSource was set
  durationMs: number;
  cursorAdvanced: boolean;
}

export interface FolderSyncSummary {
  created: number;
  updated: number;
  classification: {
    signal: number;
    noise: number;
    uncertain: number;
  };
  platformExtracted: {
    crexiLead: number;
    loopnetLead: number;
    buildoutEvent: number;
  };
  errors: Array<{ graphId: string; message: string; attempts: number }>;
}
```

Barrel-exported from `@/lib/msgraph`. Called by the dev trigger endpoint, and later by cron / webhook triggers that this spec does not build.

---

## Graph queries

Two delta calls per run, one per folder:

- `/users/{upn}/mailFolders/inbox/messages/delta`
- `/users/{upn}/mailFolders/sentitems/messages/delta`

**Per-folder cursors** stored as two separate rows in `ExternalSync`:

```
source      = "msgraph-email-inbox"     // or "msgraph-email-sentitems"
externalId  = "__cursor__"
entityType  = "cursor"
rawData     = { "deltaLink": "..." }
```

**Per-message rows** use a single unified source:

```
source      = "msgraph-email"
externalId  = <Graph message id>
entityType  = "communication"
entityId    = <Communication.id>
status      = "synced" | "failed"
rawData     = { "folder": "inbox" | "sentitems", "graphSnapshot": <full payload> }
```

Note the split cursor sources + unified message source — reflects that the two folders sync independently but both populate the same logical stream of `Communication` rows.

**$select fields:**
```
id, internetMessageId, conversationId, parentFolderId,
subject, from, toRecipients, ccRecipients, bccRecipients, sender,
receivedDateTime, sentDateTime,
hasAttachments, isRead, importance,
body, bodyPreview,
internetMessageHeaders
```

`$top=100` (Graph's hard limit for `$expand=attachments`, and a reasonable middle ground for body-included responses which are larger than contact-delta payloads).

**Headers + `Prefer: outlook.body-content-type="text"`** — request plain-text bodies rather than HTML when available. Graph performs the HTML→text conversion server-side. Our filter rules and extractors operate on text, so we don't want to carry HTML through the pipeline. The raw HTML is kept in `rawData.graphSnapshot.body.content` if a future spec wants it.

**Immutable-ID preference:** Graph messages have a different ID-stability model than contacts — `internetMessageId` is the globally stable identifier (RFC 5322 Message-ID header). We use `id` as the `externalId` for `ExternalSync` keying because that's what delta returns, but also store `internetMessageId` on the row so cross-references survive mailbox moves.

**410 `syncStateNotFound`** — same handling as contact sync: delete the affected cursor, recurse as bootstrap with `bootstrapReason = "delta-expired"`.

---

## Sender identity normalization

Recon surfaced a real-world identity bug: Matt appears as both `mrobertson@naibusinessproperties.com` (5,070 msgs) and `/o=exchangelabs/ou=exchange administrative group (fydibohf23spdlt)/cn=recipients/cn=e7b84e89cfff441fa23381ede928ca5e-mrobertson` (2,924 msgs). Graph emits the X.500 legacyExchangeDN when the sender is internal to the Exchange organization on some message paths.

**Solution: `normalizeSenderAddress(from): { address: string; displayName: string; isInternal: boolean }`**

Logic:
1. If `from.emailAddress.address` starts with `/o=` or `/O=`, treat as X.500 DN.
2. Extract the last segment after `cn=` — for Matt's case, that's `e7b84e89cfff441fa23381ede928ca5e-mrobertson`.
3. Take everything after the final `-` and append `@` + the domain portion of `MSGRAPH_TARGET_UPN`. X.500 DNs are only emitted for senders inside Matt's own Exchange organization, so the tenant's domain is the correct guess.
4. If the result looks like a valid SMTP address (contains exactly one `@`, local part non-empty), use it as the canonical form.
5. Otherwise (unexpected X.500 shape), fall back to the raw X.500 string and tag the message with `metadata.senderNormalizationFailed: true` so we can debug.

Downstream: every comparison of "is this sender Matt" or "is this sender NAI" uses the normalized form. Raw X.500 is never stored as the canonical `from.address` on the `Communication` row.

---

## Three-layer filter

Rules run in order. Earliest match wins.

### Layer A — Auto-signal allowlist

Any of these → `classification: "signal"`, skip Layer B/C.

| Rule | Source tag |
|---|---|
| Folder is `sentitems` (Matt wrote it) | `matt-outbound` |
| Normalized sender domain is `naibusinessproperties.com` AND Matt is in `toRecipients` AND `toRecipients.length <= 10` AND no `List-Unsubscribe` header | `nai-internal` |
| Sender ends with `@docusign.net` | `docusign-transactional` |
| Sender is `hit-reply@dotloop.com` | `dotloop-transactional` |
| Sender is `support@buildout.com` AND subject matches `^(A new Lead has been added\|Deal stage updated on\|You've been assigned a task\|.*critical date.*upcoming\|CA executed on)` | `buildout-event` (details in Extractors) |
| Sender is `no-reply-notification@buildout.com` AND subject matches `^(Documents viewed on\|CA executed on)` | `buildout-event` |
| Sender is `leads@loopnet.com` AND subject matches `^(LoopNet Lead for\|.*favorited)` | `loopnet-lead` |
| Sender ends with `@notifications.crexi.com` AND subject matches `((new lead\|leads) found for\|requesting Information on\|NEW leads to be contacted\|entered a note on)` (case-insensitive) | `crexi-lead` |
| Sender's normalized address is in `Contact` table AND Matt has at least one `Communication` with `direction: outbound` to this sender in the last 365 days | `known-counterparty` |

**NAI blast detection:** the NAI rule above deliberately drops mail where `toRecipients.length > 10` (likely a distribution list blast) or `List-Unsubscribe` is present (bulk-mail marker). Those NAI blasts fall through to Layer B/C where they'll likely land as noise or uncertain.

### Layer B — Hard-drop noise

Any of these → `classification: "noise"`, skip Layer C. Body is NOT stored for noise rows (saves space; raw Graph payload remains in `ExternalSync.rawData`).

**Folder-based:**
- `parentFolderId` matches Junk or Deleted Items → drop

**Domain-based (full domain or subdomain match on normalized sender):**

`flexmail.flexmls.com`, `e.mail.realtor.com`, `notifications.realtor.com`, `shared1.ccsend.com`, `bhhs-ecards.com`, `email-whitepages.com`, `propertyblast.com`, `srsrealestatepartners.com`, `encorereis.com`, `comms.cushwakedigital.com`, `atlanticretail.reverecre.com`, `mail.beehiiv.com`, `publications.bisnow.com`, `news.bdcnetwork.com`, `daily.therundown.ai`, `wrenews.com`, `retechnology.com`, `trepp.com`, `alm.com`, `infabode.com`, `rentalbeast.com`, `mail1.nnn.market`, `toasttab.com`, `e.allegiant.com`, `h5.hilton.com`, `notification.intuit.com`, `gohighlevel.com`, `80eighty.com`, `oofos.com`, `lumecube.com`, `theceshop.com`, `marketing.ecommission.com`, `fayranches.com`, `bhhs-ecards.com`.

This domain list is a **config constant** in `email-filter.ts`, not a DB table. Editing it is a code change + redeploy. Deliberate: these are operational decisions that should be reviewed in PR, not mutated at runtime.

**Sender-address exact-match (Crexi and other platform noise):**

`emails@pro.crexi.com`, `emails@search.crexi.com`, `emails@campaigns.crexi.com`, `notifications@pro.crexi.com`, `auctions@notifications.crexi.com`, `emails@notifications.crexi.com` (only when subject matches `^(Updates have been made to\|Action Required!\|[0-9]+ of your properties\|.*search ranking)`), `nlpg@cbre.com`, `yafcteam@comms.cushwakedigital.com`, `loopnet@email.loopnet.com`, `noreply@loopnet.com`, `sales@loopnet.com`.

**Local-part patterns (only when sender is NOT in Layer A):**

Local part matches `^(news|newsletter|digest|updates?|marketing|alerts?|announce|broadcast)[0-9]*(\+.*)?$` → drop.

Local part matches `^(no-?reply|donotreply|do-not-reply|mailer|postmaster|bounces?|delivery)(\+.*)?$` AND sender domain is NOT in the allowlist domains (`docusign.net`, `buildout.com`, `notifications.crexi.com`, `loopnet.com`, `dotloop.com`) → drop.

**Header-based:**
- `List-Unsubscribe` header present AND sender domain is NOT in the Layer A allowlist → drop.

### Layer C — Uncertain (stored for later classification)

Everything not caught by Layer A or Layer B → `classification: "uncertain"`, body stored in full, `metadata.tier: "uncertain"`. The classifier spec reads these rows later and may re-label them as `signal` or `noise`.

**Behavioral hints stored for the classifier to use (not acted on here):**
- `metadata.senderInContacts: boolean` — was `from` already in `Contact` when this message arrived
- `metadata.mattRepliedBefore: boolean` — does Matt have an outbound `Communication` to this sender before this one
- `metadata.threadSize: number` — how many messages in this `conversationId` so far
- `metadata.domainIsLargeCreBroker: boolean` — matches a list of ~15 major CRE firm domains (CBRE, Cushman, JLL, Colliers, Marcus Millichap, Sands, MWCRE, NAI-non-local, Berkshire, etc.)

---

## Platform-specific extractors

Each extractor runs on Layer A rows matching its platform. Output goes into `Communication.metadata.extracted` AND (for leads) creates / updates `Contact` rows.

### `extractCrexiLead(message): CrexiLeadExtract | null`

Input: Graph message from `@notifications.crexi.com` with matching subject pattern.

Subject patterns and their parsers (regex case-insensitive):

- `^(\d+) new leads? found for (.+)$` → `{ leadCount, propertyName }`
- `^(.+?) requesting Information on (.+?) in (.+)$` → `{ inquirerName, propertyName, cityOrMarket }`
- `^You have NEW leads to be contacted$` → body parse for inquirer details
- `^(.+?) entered a note on (.+)$` → `{ authorName, propertyName }` (internal team note, not a lead)

**Body parse for inquirer info** (all Crexi lead emails that carry a real person):
- Look for `Name:\s*(.+)` patterns in plain-text body
- Look for `Email:\s*([^\s<]+@[^\s>]+)` (inquirer's actual email)
- Look for `Phone:\s*(\+?[\d\s().-]+)`
- Look for `Company:\s*(.+)` and `Message:\s*([\s\S]+?)(?:\n\n|$)`

Output shape:

```ts
interface CrexiLeadExtract {
  kind: "new-leads-count" | "inquiry" | "team-note";
  propertyName: string;
  leadCount?: number;
  inquirer?: { name: string; email?: string; phone?: string; company?: string; message?: string };
  noteAuthor?: string;
}
```

If `inquirer.email` is extracted, upsert into `Contact`:

```ts
// Keyed on normalized email
upsertContact({
  email: inquirer.email,
  name: inquirer.name,
  phone: inquirer.phone,
  company: inquirer.company,
  leadSource: "crexi",
  leadStatus: "new",    // only set if creating; existing contacts keep current status
  leadAt: message.receivedDateTime,  // same caveat
  createdBy: "msgraph-email-crexi-extract",
})
```

### `extractLoopNetLead(message): LoopNetLeadExtract | null`

Input: Graph message from `leads@loopnet.com`.

Subject patterns:
- `^LoopNet Lead for (.+)$` → `{ kind: "inquiry", propertyName }`, then body parse
- `^(.+?) favorited (.+)$` → `{ kind: "favorited", viewerName, propertyName }`
- `^Your LoopNet inquiry was sent$` → confirmation only, drop (not really a lead on Matt's side)

Body parse mirrors Crexi's — Name/Email/Phone/Company/Message fields, LoopNet uses fairly consistent templates.

Inquirer upsert: same as Crexi but with `leadSource: "loopnet"`.

### `extractBuildoutEvent(message): BuildoutEventExtract | null`

Input: Graph message from `support@buildout.com` or `no-reply-notification@buildout.com`.

Event kinds (from subject):

```ts
interface BuildoutEventExtract {
  kind:
    | "new-lead"              // "A new Lead has been added - {propertyName}"
    | "deal-stage-update"     // "Deal stage updated on {propertyName}"
    | "task-assigned"         // "You've been assigned a task"
    | "critical-date"         // contains "critical date" + "upcoming"
    | "ca-executed"           // "CA executed on {propertyName}"
    | "document-view";        // "Documents viewed on {propertyName}"
  propertyName?: string;
  // Parsed from body for kind = "deal-stage-update":
  newStage?: string;
  previousStage?: string;
  // Parsed from body for kind = "new-lead":
  inquirer?: { name: string; email?: string; phone?: string; message?: string };
  // Parsed from body for kind = "task-assigned":
  taskTitle?: string;
  taskDueDate?: string;
}
```

For `kind: "new-lead"`: upsert inquirer into `Contact` with `leadSource: "buildout"`, same pattern as Crexi.

For `kind: "deal-stage-update"` / `"task-assigned"` / `"critical-date"` / `"ca-executed"` / `"document-view"`: the parsed data is stored in `Communication.metadata.extracted` but **no Deal / Todo mutation happens in this spec**. A follow-up spec will read these tagged rows and apply them.

---

## `Communication` row shape after ingestion

```ts
{
  channel: "email",
  subject: message.subject,
  body: /* plain-text body for signal + uncertain; null for noise */,
  date: message.receivedDateTime,    // or sentDateTime for sentitems
  direction: folder === "inbox" ? "inbound" : "outbound",
  category: "business",              // always business for now; "personal" detection is a later spec
  externalMessageId: message.id,
  externalSyncId: /* ExternalSync.id */,
  contactId: /* resolved via normalized-sender lookup in Contact; nullable */,
  dealId: null,                      // always null in this spec; linked by later specs
  tags: [],
  metadata: {
    classification: "signal" | "noise" | "uncertain",
    source: /* "matt-outbound" | "nai-internal" | "docusign-transactional" | ... | "layer-b-<rule>" | "layer-c" */,
    tier1Rule: /* name of the specific rule that matched, e.g. "crexi-lead-subject" */,
    conversationId: message.conversationId,
    internetMessageId: message.internetMessageId,
    parentFolderId: message.parentFolderId,
    from: { address: normalized, displayName, isInternal },
    toRecipients: [...],
    ccRecipients: [...],
    hasAttachments: boolean,
    attachments: [{ id, name, size, contentType }] | undefined,   // fetched in a follow-up Graph call for signal rows only
    importance: "low" | "normal" | "high",
    isRead: boolean,
    senderNormalizationFailed?: true,
    extracted?: CrexiLeadExtract | LoopNetLeadExtract | BuildoutEventExtract,
    // Hints for the classifier spec (only on uncertain rows):
    senderInContacts?: boolean,
    mattRepliedBefore?: boolean,
    threadSize?: number,
    domainIsLargeCreBroker?: boolean,
  },
}
```

**Attachment metadata fetch:** Graph's `$expand=attachments` on delta is limited to 20 attachments per message and slows responses significantly. We fetch attachments in a separate per-message call (`/messages/{id}/attachments?$select=id,name,size,contentType`) **only for rows classified as `signal` and where `hasAttachments === true`**. This caps extra round-trips to high-value messages — typical signal volume over 90 days is ~5K messages of which maybe 15% have attachments, so ~750 extra calls. Throttle to 4 concurrent. Failures are logged but don't block the row from being ingested.

---

## Concurrency and retry

**Advisory lock:** same pattern as contact sync. `pg_try_advisory_lock(hashtext('msgraph-email'))` at the top; `skippedLocked: true` if busy. Concurrent inbox + sentitems syncs are serialized under the single lock to avoid racing on the `ExternalSync` cursor writes.

**Per-message retry:** 3 attempts with exponential backoff (50ms / 200ms / 800ms). On all-attempts-failed, write to `summary.errors[]` and set `ExternalSync.status = "failed"` for that graphId. **Cursor does not advance if any error persists after retries** — same conditional-advance logic as contact sync.

**Transactional per-message write:** the `Communication` insert and the `ExternalSync` upsert happen inside a single `prisma.$transaction([...])`. If either fails, both roll back.

**Idempotency:** re-running the sync must not duplicate rows. The `@@unique([source, externalId])` index on `ExternalSync` + the graph message `id` as `externalId` is our uniqueness gate. Delta cursor advances make re-runs cheap (empty response after the first pass).

---

## Dev trigger endpoint

**`POST /api/integrations/msgraph/emails/sync`**

Same gate pattern as contact sync + recon routes:

1. `MSGRAPH_TEST_ROUTE_ENABLED !== "true"` OR config load throws → `404`
2. Method not `POST` → `405`
3. `x-admin-token` missing or mismatched via `constantTimeCompare` → `401`
4. Handler invokes `syncEmails()` with optional `daysBack` / `forceBootstrap` from query string
5. On success → `{ ok: true, ...result }`
6. On `GraphError` → `{ ok: false, status, code, path, message }` with matching HTTP status

`maxDuration = 300`. Console logs progress per folder / per batch.

---

## Error handling summary

| Condition | Where | Behavior |
|---|---|---|
| Missing MSGRAPH env | config / route | Route `404`, kill switch fallback |
| Missing/wrong admin token | route | `401` |
| Another sync in flight | `emails.ts` advisory lock | `skippedLocked: true`, zeroes elsewhere |
| Graph 401 mid-sync | existing `client.ts` | Token invalidate + retry once |
| Graph 403 | `client.ts` | Throw; sync aborts; cursor stays |
| Graph 410 `syncStateNotFound` | `emails.ts` per-folder | Delete that folder's cursor, restart as bootstrap with `bootstrapReason: "delta-expired"` |
| Graph 429 / 503 / 504 / network error | `client.ts` | `Retry-After` honored, retry once |
| Per-message write fails transient | `emails.ts` | 3-attempt retry with backoff |
| Per-message write fails all attempts | `emails.ts` | Log to `summary.errors[]`, set `ExternalSync.status = "failed"`, do NOT advance cursor |
| Sender normalization fails | `sender-normalize.ts` | Fall back to raw address, tag `metadata.senderNormalizationFailed: true`, continue |
| Extractor regex fails to match body | extractors | Return `null`, row is still stored; `metadata.extracted` omitted |
| Attachment fetch fails | `emails.ts` | Log, continue; `metadata.attachments` is left undefined |
| Contact upsert race (same inquirer email arriving twice concurrently) | Prisma unique constraint on `Contact.email` | Retry the upsert path once, then succeed on the second attempt finding the existing row |

---

## Testing plan

### Unit (vitest, `email-filter.test.ts`, `email-extractors.test.ts`, `sender-normalize.test.ts`)

**Sender normalization:**
- SMTP address passes through unchanged
- Matt's X.500 DN normalizes to `mrobertson@naibusinessproperties.com`
- Unexpected X.500 shapes fall back + set `senderNormalizationFailed`
- Lowercase comparison is case-insensitive

**Layer A rules (each gets a positive + negative test):**
- Sent items folder → signal regardless of sender
- NAI internal with Matt in To → signal
- NAI internal with Matt only in CC → NOT signal (falls to Layer B/C)
- NAI with `toRecipients.length > 10` → NOT signal
- NAI with `List-Unsubscribe` header → NOT signal
- DocuSign.net → signal
- Buildout support with lead subject → signal, `source: buildout-event`
- Crexi notifications with lead subject → signal
- Crexi notifications with "Updates have been made to N Property" → NOT signal (falls to Layer B sender-specific noise rule)
- LoopNet leads with lead subject → signal
- Known counterparty (sender in Contact + Matt replied before) → signal

**Layer B rules:**
- Domain match drops (`propertyblast.com`, `flexmail.flexmls.com`, etc.)
- Sender exact-match drops (`emails@pro.crexi.com`, `nlpg@cbre.com`)
- Local-part pattern drops with proper allowlist bypass (`no-reply@docusign.net` → NOT dropped)
- Junk folder drops
- `List-Unsubscribe` drops non-allowlisted

**Layer C:**
- Unknown human-looking sender, no Layer A match → `classification: "uncertain"`, body stored, behavioral hints populated

**Extractors:**
- Crexi `"N new leads found for X"` → parses count + propertyName
- Crexi `"Jacky Bradley requesting Information on Burger King | Sidney, MT in Sidney"` → parses inquirer name + property + city
- Crexi body parse extracts Name/Email/Phone
- LoopNet `"LoopNet Lead for 303 N Broadway"` → parses property + body fields
- LoopNet `"Alex Wright favorited 303 N Broadway"` → `kind: "favorited"`, viewerName, propertyName
- Buildout `"A new Lead has been added - US Bank Building"` → `kind: "new-lead"`, propertyName, inquirer from body
- Buildout `"Deal stage updated on 2621 Overland"` → `kind: "deal-stage-update"`, propertyName
- Malformed bodies return `null` gracefully, no throw

**Contact upsert on lead extraction:**
- New inquirer email → creates Contact with `leadSource`, `leadStatus: "new"`, `leadAt`
- Existing Contact (same email) with no leadSource → fills in `leadSource`, `leadStatus`, `leadAt`
- Existing Contact with `leadStatus: "contacted"` → leaves status alone
- Existing Contact with a `Deal` (i.e., a Client) → leaves `leadSource` null (clients don't need a lead source)

### End-to-end `syncEmails()` (with mocked `global.fetch`)

- Bootstrap with no cursors → two delta calls (inbox + sentitems), N messages processed, both cursors written
- Delta empty response → all zeros, cursors advanced
- Delta returns messages across both folders → per-folder summaries correct
- 410 on inbox → inbox cursor deleted, re-bootstrap inbox (sentitems unaffected)
- Concurrent run → `skippedLocked: true`, other sync completes normally
- Persistent per-message failure → `summary.errors`, `cursorAdvanced: false`
- Transient per-message failure (1st attempt fails, 2nd succeeds) → no entry in errors, row processed

### Integration (manual, live Graph + DB)

After deploy to local dev:

1. `POST /api/integrations/msgraph/emails/sync` without admin token → `401`
2. With admin token, first run with default 90-day window → `ok: true, isBootstrap: true, perFolder.inbox.created: ~22000, perFolder.sentitems.created: ~2000, classification: { signal: ~6000, noise: ~5000, uncertain: ~13000 }, durationMs: ~3–8 min`
3. Query Postgres:
   - `SELECT classification, COUNT(*) FROM communications c JOIN external_sync es ON c.external_sync_id = es.id WHERE es.source = 'msgraph-email' GROUP BY classification` — numbers match the summary
   - `SELECT COUNT(*) FROM contacts WHERE lead_source = 'crexi' AND created_by = 'msgraph-email-crexi-extract'` — matches the extractor count
4. Immediate second run → `isBootstrap: false, created: 0, durationMs < 2s`
5. Send yourself an email with subject matching a Crexi lead template to Matt's address (or use a sandbox account) → run → verify lead extracted, Contact created with `leadSource: "crexi"`
6. **Sanity-check the Focused/Other leak payoff:** query for `metadata->>'source' = 'crexi-lead'` rows where Matt's sent items has no follow-up in the same `conversationId`. Count should be > 0 if the thesis is correct; each is a candidate for the future missed-deals surfacer.

---

## Open items / follow-ups

Ordered by when they become valuable:

1. **Classifier for Layer C uncertain rows** (spec #1.5 or sibling) — reads `classification: "uncertain"` rows, sends body + subject to Codex Spark with a CRE-tuned prompt, writes back `classification: "signal" | "noise"` and a reason string. Batched.
2. **Missed-deals surfacer** (spec #2 of original roadmap) — reports Crexi/LoopNet/cold leads that Matt never replied to, grouped by property thread.
3. **Buildout event consumer** — reads rows with `metadata.extracted.kind = "deal-stage-update" | "task-assigned" | ...` and mutates `Deal.stage`, creates `Todo` rows, etc.
4. **Signature enrichment** — pulls phone/title/company from email signatures and updates `Contact` fields. Scoped to contacts with `leadSource NOT NULL` or linked to an active Deal.
5. **Attachment promotion** — "Save to Deal" flow: fetch binary via Graph, push to OneDrive (or Dropbox in the interim), create `DealDocument`. Mirrors NAI's existing folder structure per client.
6. **Auto-reply workflow for Crexi / LoopNet leads** — templated response, CC Genevieve, tracked in `AgentAction`.
7. **SIOR directory import** — one-shot CSV import into `Contact` with `tags: ["colleague-sior"]`. After this lands, the Layer A "known-counterparty" rule gets a lot more coverage for free.
8. **Ongoing sync trigger** — Vercel cron every 15 min calling `syncEmails()`. Deferred until spec #1 is validated on manual runs.
9. **Personal-vs-business classification** — the `Contact.category` + `Communication.category` distinction. Currently always `business`; a later spec might parse personal-email patterns.
10. **Outlook rules migration** — once ingestion is stable, consider whether the CRM should *replace* Matt's Focused/Other split by surfacing a unified inbox inside the CRM. Product decision, not a schema one.

---

## Assumptions

- `Mail.ReadWrite` is granted on the Azure app registration (from connection spec). Read-only suffices for this spec but `ReadWrite` is already in place and we don't downgrade.
- `MSGRAPH_TARGET_UPN` continues to resolve to Matt's mailbox.
- Graph's inbox and sentitems folders are the only folders we care about for this spec. Archive / custom folders are out of scope; if Matt moves mail out of Inbox to a custom folder manually, those messages are still captured if they were ingested during the window they were in Inbox.
- Graph's delta endpoint on `mailFolders/{folder}/messages/delta` returns all messages currently in that folder. Messages moved out of the folder between syncs appear as `@removed` in the delta. We treat `@removed` on an email as "message left this folder" not "message archived" — the row stays in our DB, `metadata.parentFolderId` is updated if we can determine new location, otherwise no-op.
- The sender-normalization regex for X.500 DNs matches Exchange Online's current format. If Microsoft changes the DN shape in a breaking way, the fallback ("use raw address + tag") keeps ingestion running without data loss.
- Matt's mailbox volume doesn't explode by 10× overnight. The design assumes ~250 messages/day steady state; a sudden 10× spike would require classifier-cost / rate-limit reconsideration.
- Body-preview / body-content are in plain text when we ask Graph for it via the `Prefer` header. A future Microsoft change to require HTML would force us to add an HTML-to-text step; not a breaking design change.
