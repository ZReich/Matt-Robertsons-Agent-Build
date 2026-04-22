# Microsoft Graph Contact Sync — Design

**Date:** 2026-04-22
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review
**Depends on:** [Microsoft Graph / Outlook Connection Layer](2026-04-16-msgraph-outlook-connection-design.md) — the Graph client, TokenManager, and retry logic built in the previous slice.

---

## Context

Matt Robertson's Outlook account has **2,302 contacts** in a single flat folder, curated over years of commercial-real-estate work. Before we can sensibly ingest emails, we need those contacts in the CRM's `Contact` table so that downstream specs (email ingestion, signature-based enrichment, "missed opportunity" surfacing) have a rich sender-lookup table to resolve `from`/`to`/`cc` addresses against.

This spec covers the **contact sync** — specifically, a re-runnable Graph-delta-based sync that:

- Bootstraps the `Contact` table on first run
- On every subsequent run (piggybacked on the future email-sync cron), pulls only the delta from Outlook: new contacts, modified contacts, and deletions
- Returns empty-and-fast (~500 ms) when nothing has changed
- Matt never manually triggers it in normal operation; a gated dev endpoint exists for debugging

This spec does **not** cover:

- Email ingestion, contact enrichment, or any other downstream transformation (separate specs)
- Pushing CRM-side contact edits back to Outlook (not planned)
- Anything outside the default Contacts folder (Matt has zero named sub-folders — confirmed via recon 2026-04-22)
- Production triggers (the cron / webhook that invokes this is the email-sync spec's problem)

## Goals

- Populate and maintain the `Contact` table from Outlook Contacts with a single function the rest of the codebase can call: `syncMicrosoftContacts(): Promise<SyncResult>`
- Prove the full round-trip against Matt's live data via a gated dev endpoint
- Lay the pattern (delta cursor + `ExternalSync` tracking + idempotent upsert) that future ingesters (emails, calendar) will reuse

## Non-goals

- Bidirectional sync (CRM edits do not propagate to Outlook)
- Deduplicating contacts that are duplicates in Outlook itself (same person, two contact cards)
- Extending the `Contact` schema to hold multi-valued phone/email/address fields (we use a notes-overflow fallback instead)
- Reading contacts from any non-default folder (none exist for Matt)
- Standing up the production cron/webhook that triggers sync (the email-sync spec does that)

## File layout

```
full-kit/
├── src/
│   ├── lib/
│   │   └── msgraph/
│   │       ├── contacts.ts               # NEW — sync logic, mapping, cursor
│   │       ├── contacts.test.ts          # NEW — unit tests (mocked fetch)
│   │       └── index.ts                  # MODIFY — barrel adds syncMicrosoftContacts, SyncResult
│   └── app/
│       └── api/
│           └── integrations/
│               └── msgraph/
│                   └── contacts/
│                       └── sync/
│                           └── route.ts  # NEW — gated POST endpoint for dev triggering
```

**Boundary rules inherited from the Graph connection spec:**

- Graph-specific code only inside `src/lib/msgraph/`. Nothing else in the codebase knows how contacts enter the system.
- The route file is a thin gate around `syncMicrosoftContacts()`. No business logic in the route.
- DB writes happen inside `contacts.ts` via Prisma. This sets the pattern for every future ingester.
- **Size guardrail:** if `contacts.ts` crosses ~300 lines, split into `contacts/sync.ts`, `contacts/mapping.ts`, `contacts/cursor.ts` as a follow-up. Until then, one file keeps the whole story readable.

## Public API

```ts
export async function syncMicrosoftContacts(): Promise<SyncResult>

export interface SyncResult {
  isBootstrap: boolean;                       // true on first-ever run (no cursor)
  bootstrapReason?: "no-cursor" | "delta-expired";
  created: number;
  updated: number;
  archived: number;
  unarchived: number;
  errors: Array<{ graphId: string; message: string }>;
  durationMs: number;
}
```

Exported from the `@/lib/msgraph` barrel so that the future email-sync cron imports it alongside `graphFetch`, `listRecentMessages`, etc.

## Field mapping (Graph Contact → `Contact` row)

| `Contact` field | Source from Graph payload | Rule |
|---|---|---|
| `name` | `displayName` → `givenName + " " + surname` → `emailAddresses[0].name` → `emailAddresses[0].address` | Required; fallbacks apply in order; never null |
| `company` | `companyName` | Nullable |
| `email` | `emailAddresses[0].address` | First email wins; others go to notes overflow |
| `phone` | `mobilePhone` → `businessPhones[0]` → `homePhones[0]` | First non-empty wins; others go to notes overflow |
| `role` | *(null on sync)* | Reserved for user-edited CRE relationship type; sync never touches it |
| `preferredContact` | *(null on sync)* | User-maintained |
| `address` | `businessAddress` formatted as `"street, city, state postal, country"` (skip empty parts) | Home/other addresses go to notes overflow |
| `notes` | `personalNotes` + structured overflow block (see below) | Merged, preserving user edits; see `mergeNotes` |
| `category` | Always `"business"` | Matt's Outlook is his work account. A later spec can flip via inference. |
| `tags` | Graph `categories[]` array, verbatim JSON | Outlook color categories carry over |
| `createdBy` | `"msgraph-contacts"` | Source tag for auditability |
| `archivedAt` | `null` on create; `now()` when Graph emits `@removed`; cleared when a previously-removed contact reappears | |

## Notes-overflow format

Data that doesn't fit in dedicated columns lives in a sentinel-delimited block inside `notes`, so user-authored notes above the sentinel survive every re-sync:

```
<Matt's personal notes — editable, preserved across syncs>

--- Synced from Outlook (do not edit below this line) ---
Job title: Senior Broker
Department: Commercial Sales
Other emails: bob.smith@gmail.com
Other phones (business): (208) 555-9999
Other phones (home): (208) 555-8888
Home address: 123 Oak St, Coeur d'Alene, ID 83814
Business homepage: example.com
```

`mergeNotes(existing, graphContact)` logic:

1. If `existing` contains the sentinel line → take the portion before it as "user content".
2. Else → treat all of `existing` as user content (including empty string).
3. Regenerate the synced block from fresh `graphContact` data, omitting any empty overflow lines.
4. Concatenate: `userContent + "\n\n" + SENTINEL_LINE + "\n" + syncedBlock`.
5. If both user content and synced block are empty, return `null` (no notes).

The sentinel line is a fixed constant: `--- Synced from Outlook (do not edit below this line) ---`. Anyone pasting this text by hand into notes would break the merge; this is accepted as vanishingly unlikely.

## Dedup and cursor via `ExternalSync`

The schema's `ExternalSync` table is purpose-built for this. Two kinds of rows:

**1. One per tracked contact** — maps Graph's stable contact ID to our UUID:
```
source     = "msgraph-contacts"
externalId = <Graph contact id, e.g. "AAMkADk3...">
entityType = "contact"
entityId   = <Contact.id UUID>
syncedAt   = last time this record changed
```
Looked up via `@@unique([source, externalId])`. Dedup key is always Graph ID, never email — this handles contacts with no email, email changes in-place, and duplicate-email-different-person correctly.

**2. Exactly one cursor row:**
```
source     = "msgraph-contacts"
externalId = "__cursor__"           # double-underscore sentinel; never a valid Graph ID
entityType = "cursor"
entityId   = null
rawData    = { "deltaLink": "https://graph.microsoft.com/v1.0/users/.../contacts/delta?$deltatoken=..." }
syncedAt   = last successful full sync
```

Cursor only advances after a full sync pass completes (all pages drained, all writes committed). On any failure, cursor stays where it was; next run retries from the same point. Since per-contact upserts are idempotent, retry is safe.

## Sync flow

```
syncMicrosoftContacts():
  t0 = now()
  cursor = loadCursor()
  isBootstrap = (cursor === null)
  startUrl = cursor?.deltaLink ?? `/users/${UPN}/contacts/delta`

  summary = { created: 0, updated: 0, archived: 0, unarchived: 0, errors: [] }
  url = startUrl
  finalDeltaLink = null

  while (url !== null):
    try:
      response = await graphFetch<ContactsDeltaResponse>(url)
    catch (GraphError err):
      if err.status === 410 and err.code includes "syncState":
        # delta token expired — restart as bootstrap
        await deleteCursor()
        return syncMicrosoftContacts() with result.bootstrapReason = "delta-expired"
      else:
        throw                                          # bubbles up; cursor stays put

    for each entry in response.value:
      try:
        if entry['@removed'] is present:
          if await archiveContact(entry.id):
            summary.archived++
        else:
          result = await upsertContact(entry)         # 'created' | 'updated' | 'unarchived'
          summary[result]++
      catch per-item-err:
        summary.errors.push({ graphId: entry.id ?? '<missing>', message: per-item-err.message })
        # continue; do not abort the whole sync for one bad row

    if response['@odata.nextLink']:
      url = response['@odata.nextLink']
    elif response['@odata.deltaLink']:
      finalDeltaLink = response['@odata.deltaLink']
      url = null
    else:
      url = null                                       # defensive — shouldn't happen

  if finalDeltaLink:
    await saveCursor(finalDeltaLink)

  return {
    isBootstrap,
    bootstrapReason: isBootstrap ? "no-cursor" : undefined,
    ...summary,
    durationMs: now() - t0
  }
```

**Per-contact ops:**

`upsertContact(graphContact)`:

1. Lookup `ExternalSync` row by `(source='msgraph-contacts', externalId=graphContact.id)`.
2. If found:
   - Fetch `Contact` by `id = externalSync.entityId`. If missing (deleted out from under us), treat as a fresh create (defensive).
   - `wasArchived = contact.archivedAt !== null`.
   - Update columns from `mapGraphToContact(graphContact)`, plus `notes = mergeNotes(contact.notes, graphContact)`, plus `archivedAt = null`.
   - Bump `externalSync.syncedAt`.
   - Return `'unarchived'` if `wasArchived`, else `'updated'`.
3. If not found:
   - Insert `Contact` row with mapped fields + fresh-synced notes block.
   - Insert `ExternalSync` row linking Graph ID → Contact UUID.
   - Return `'created'`.

`archiveContact(graphId)`:

1. Lookup `ExternalSync` row by `(source='msgraph-contacts', externalId=graphId)`.
2. If not found → return `false` (we never knew about this contact; nothing to archive).
3. Update `Contact.archivedAt = now()` via `id = externalSync.entityId`. Bump `externalSync.syncedAt`.
4. Return `true`.

## Dev trigger: the gated sync endpoint

**`POST /api/integrations/msgraph/contacts/sync`**

Gates evaluated strictly in order (same defense-in-depth as `/api/integrations/msgraph/test`):

1. **Kill switch** — if `MSGRAPH_TEST_ROUTE_ENABLED !== "true"` OR config loading throws, return `404` with empty body. Indistinguishable from an undeployed route.
2. **Method** — non-`POST` returns `405`. (`GET` is explicitly wrong for a state-mutating action.)
3. **Auth** — `x-admin-token` header compared against `MSGRAPH_TEST_ADMIN_TOKEN` via `constantTimeCompare`. Missing or wrong → `401 { ok: false, error: "unauthorized" }`.
4. **Handler** — invokes `syncMicrosoftContacts()`, returns the `SyncResult` as JSON with `{ ok: true, ...result }`. Uncaught `GraphError` returns `{ ok: false, status, code, path, message }` with the corresponding HTTP status.

`export const dynamic = "force-dynamic"` prevents build-time prerender.

This route is a **development convenience only**. In normal operation the future email-sync tick imports `syncMicrosoftContacts` directly and invokes it in-process.

## Error handling summary

| Condition | Where handled | Behavior |
|---|---|---|
| Missing MSGRAPH env vars | existing `config.ts` | Route returns `404` (kill-switch fallback) |
| Missing/wrong admin token | route | `401 { ok: false, error: "unauthorized" }` |
| Graph 401 mid-sync | `client.ts` | Token auto-invalidate + retry once (existing) |
| Graph 403 | `client.ts` | Thrown; sync aborts; cursor unchanged |
| Graph 410 `syncStateNotFound` (delta expired) | `contacts.ts` | Delete cursor; restart sync as bootstrap; report `bootstrapReason: "delta-expired"` |
| Graph 429 / 503 / 504 / network error | `client.ts` | `Retry-After` honored + retry once (existing) |
| Per-contact mapping failure | `contacts.ts` | Log to `summary.errors[]`, continue |
| Per-contact DB write failure | `contacts.ts` | Log to `summary.errors[]`, continue |
| `Contact` row missing for a tracked `ExternalSync` entityId | `upsertContact` | Fall through to create path (defensive; indicates manual DB tampering or race) |
| Sync aborts mid-pagination | bubbles to caller | Cursor unchanged; next run retries from same point |

## Testing plan

**Unit tests (vitest, `contacts.test.ts`, mocked `global.fetch` identical to the existing `token-manager.test.ts` pattern):**

Pure helpers:

- `mapGraphToContact` — each fallback branch for name, phone, email, address; `categories` pass-through; overflow data routed to notes
- `mergeNotes` — no existing notes; existing with no sentinel; existing with sentinel (prefix preserved, suffix regenerated); both empty → null

End-to-end `syncMicrosoftContacts` via mocked `fetch`:

- Bootstrap (no cursor row) → single page of contacts → cursor written with the deltaLink
- Delta (cursor present) → empty `value` array → returns `created: 0, updated: 0`, cursor advances to new token
- Delta returns one `@removed` tombstone → `archiveContact` sets `archivedAt`, counts `archived: 1`
- Previously-archived contact reappears → `archivedAt` cleared, counts `unarchived: 1`
- Two-page pagination via `@odata.nextLink` → both pages processed, cursor only written after the final `@odata.deltaLink`
- Graph 410 on first page → cursor deleted, function restarts as bootstrap, reports `bootstrapReason: "delta-expired"`
- Per-contact error (throw inside `upsertContact` for one specific graphId) → `summary.errors` includes it, remaining contacts process normally, cursor still advances

**Integration test (manual, live Graph, gated endpoint):**

After deploy to local dev:

1. `POST /api/integrations/msgraph/contacts/sync` without admin token → `401`
2. With admin token, first run → `ok: true, isBootstrap: true, created: ~2302, durationMs: ~60–90s`. Query `SELECT count(*) FROM contacts` → ~2302. Query `SELECT count(*) FROM external_sync WHERE source = 'msgraph-contacts'` → ~2303 (contacts + 1 cursor row).
3. Immediate second run → `ok: true, isBootstrap: false, created: 0, updated: 0, archived: 0, durationMs: <2s`. Cursor row `syncedAt` is fresh.
4. Add one contact in Outlook → run → `created: 1`. Confirm in DB.
5. Edit that contact's phone in Outlook → run → `updated: 1`. Confirm new phone in DB.
6. Delete that contact in Outlook → run → `archived: 1`. Confirm `archivedAt` set, row still present.
7. Re-add the contact in Outlook → run → `unarchived: 1`. Confirm `archivedAt` cleared.

## Open items / follow-ups (NOT in this spec)

- **Contact enrichment from email signatures** (separate spec after email ingestion lands). Consumes signature data extracted during email ingestion; updates `Contact` records subject to the active-Deal gate.
- **Multi-value phone/email/address schema migration** — only if real-world usage surfaces enough cases of losing data to the notes-overflow fallback.
- **Promoting "personal" category via inference** — the default-`business` behavior is cheap and reversible; revisit with real data.
- **Production trigger** — the email-sync cron/webhook (a different spec) will call `syncMicrosoftContacts()` as a preamble to its own work. No standalone cron is planned.
- **Audit trail of changes** — if Matt later wants "what changed on contact X over time," the current design doesn't retain history. Could be added by logging to `AgentAction` on each update, but not valuable today.

## Assumptions

- `Contacts.Read` (Application) is granted on the Azure app registration (verified via 2,302-count recon 2026-04-22).
- Matt's contacts live only in the default Contacts folder (verified — zero named sub-folders).
- Graph's `/users/{upn}/contacts/delta` endpoint's 30-day token lifetime is stable. If a deployment gap exceeds this, the automatic fall-back-to-bootstrap path handles it.
- `ExternalSync` remains the canonical per-record and cursor tracker for all future ingesters (emails, calendar). No schema changes needed here.
