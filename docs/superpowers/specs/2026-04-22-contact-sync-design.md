# Microsoft Graph Contact Sync — Design

**Date:** 2026-04-22
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review (revised after Codex xhigh-effort review, 2026-04-22)
**Depends on:** [Microsoft Graph / Outlook Connection Layer](2026-04-16-msgraph-outlook-connection-design.md) — the Graph client, TokenManager, and retry logic built in the previous slice.

---

## Revision history

- **2026-04-22 (initial draft):** single-file spec covering delta-based contact sync with `ExternalSync` cursor and idempotent upsert.
- **2026-04-22 (post-Codex):** revisions addressing three Critical and three Important findings from an xhigh-effort Codex review. Substantive changes:
  - **Partial-payload handling (C1):** Graph delta returns only *changed* properties on updates, not full resources. The mapper now returns a `Partial<ContactFields>`; updates touch only keys present in the payload. Absence means "don't touch," not "clear."
  - **Per-item retry + conditional cursor advance (C2):** a transient DB error on one contact no longer causes permanent divergence. Items get three retries with backoff; if any exhausts, the cursor is not saved and the next sync retries from the same point.
  - **Concurrent-run safety (C3):** the sync acquires a Postgres advisory lock keyed on `"msgraph-contacts"` for the duration of the run. Concurrent callers early-return with `skippedLocked: true`. The per-contact create pair (`Contact` + `ExternalSync`) runs inside a Prisma transaction.
  - **Absolute URL support in `graphFetch` (I1):** `@odata.nextLink` / `@odata.deltaLink` are fully-qualified URLs. `graphFetch` is extended to detect and use them verbatim. A small backport to the previous spec's client.
  - **Immutable contact IDs (I2):** all contacts delta calls send `Prefer: IdType="ImmutableId"` so Graph IDs survive folder moves. `graphFetch` gains an optional `headers` option to carry this.
  - **Archive differentiation via `ExternalSync.status` (I3):** the `status` column ("synced" / "removed" / "failed") distinguishes Graph-origin deletes from future manual-archive flows, so Graph updates never silently undo a manual archive.
  - **Notes overflow relocated (Minor 1):** the sentinel-line-in-notes merge is dropped. `Contact.notes` becomes user-owned after the initial create. Overflow data (extra phones, home address, job title, etc.) lives in `ExternalSync.rawData` alongside the per-record mapping. No sentinel collision risk.

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
- Extending the `Contact` schema to hold multi-valued phone/email/address fields (we use `ExternalSync.rawData` to retain everything Graph returns)
- Reading contacts from any non-default folder (none exist for Matt)
- Standing up the production cron/webhook that triggers sync (the email-sync spec does that)

## File layout

```
full-kit/
├── src/
│   ├── lib/
│   │   └── msgraph/
│   │       ├── client.ts                  # MODIFY — two small extensions:
│   │       │                              #   (a) accept absolute URLs in graphFetch (for nextLink/deltaLink)
│   │       │                              #   (b) accept optional headers option (for Prefer: IdType)
│   │       ├── client.test.ts             # MODIFY — tests for the two new capabilities above
│   │       ├── contacts.ts                # NEW — sync logic, mapping, cursor, locking
│   │       ├── contacts.test.ts           # NEW — unit tests (mocked fetch)
│   │       └── index.ts                   # MODIFY — barrel adds syncMicrosoftContacts, SyncResult
│   └── app/
│       └── api/
│           └── integrations/
│               └── msgraph/
│                   └── contacts/
│                       └── sync/
│                           └── route.ts   # NEW — gated POST endpoint for dev triggering
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
  isBootstrap: boolean;                       // true on first-ever run or after a delta-expired reset
  bootstrapReason?: "no-cursor" | "delta-expired";
  skippedLocked: boolean;                     // true if another sync was already in progress; all other counts 0
  created: number;
  updated: number;
  archived: number;
  unarchived: number;
  errors: Array<{ graphId: string; message: string; attempts: number }>;
  cursorAdvanced: boolean;                    // false if any item permanently failed (errors[] non-empty)
  durationMs: number;
}
```

Exported from the `@/lib/msgraph` barrel so that the future email-sync cron imports it alongside `graphFetch`, `listRecentMessages`, etc.

## `graphFetch` extensions (small backport to the previous spec's client)

Two minimal additions, implemented as part of this spec:

**1. Absolute URL support.** `graphFetch` currently always does `new URL(GRAPH_BASE + path)`. It is extended so that if `path` starts with `https://graph.microsoft.com/`, it is used verbatim. Any other absolute URL throws (defense against leaking bearer tokens to non-Graph endpoints).

**2. Optional `headers` option.** `GraphFetchOptions` gains `headers?: Record<string, string>`. Caller-supplied headers merge over the defaults (`Authorization`, `Content-Type`) but cannot override `Authorization`.

Both changes get unit tests in `client.test.ts`:
- Absolute-URL happy path works.
- Absolute-URL to a non-Graph host throws.
- A caller-supplied `Prefer: IdType="ImmutableId"` header shows up on the outgoing request.

## Field mapping (Graph Contact → `Contact` row)

Graph's delta endpoint may return an updated contact as `{ id, ...changedProperties }` — not a full resource. **The mapper returns `Partial<ContactFields>` with keys present only for fields actually in the payload.** Missing keys mean "don't write"; they do not mean "clear."

| `Contact` field | Source (if present in Graph payload) | Rule |
|---|---|---|
| `name` | `displayName` → `givenName + " " + surname` → `emailAddresses[0].name` → `emailAddresses[0].address` | Required only on CREATE (use fallbacks); on UPDATE, only overwrite if Graph provided a relevant field |
| `company` | `companyName` | Written only if `companyName` key present |
| `email` | `emailAddresses[0].address` | Written only if `emailAddresses` key present (and non-empty) |
| `phone` | `mobilePhone` → `businessPhones[0]` → `homePhones[0]` | Written only if at least one of those keys is present |
| `role` | *(never written by sync)* | Reserved for user-edited CRE relationship type |
| `preferredContact` | *(never written by sync)* | User-maintained |
| `address` | `businessAddress` formatted as `"street, city, state postal, country"` (skip empty parts) | Written only if `businessAddress` key present |
| `notes` | `personalNotes` | **Written only on CREATE (seed from Outlook). Never touched on UPDATE** — user-owned once the contact exists in the CRM |
| `category` | Always `"business"` on CREATE; never updated | Matt's Outlook is his work account |
| `tags` | Graph `categories[]` array, verbatim JSON | Written only if `categories` key present |
| `createdBy` | `"msgraph-contacts"` on CREATE only | Source tag for auditability |
| `archivedAt` | Managed by the sync based on `@removed` and `ExternalSync.status`; see "Archive handling" below | |

**Raw payload retention.** On every create and update, the full Graph contact payload is stored verbatim in `ExternalSync.rawData.graphContact`. This preserves all data Graph returned — extra phones, home/other addresses, job title, department, business homepage — for future enrichment specs and for debugging the mapping. No need for a sentinel-delimited overflow block inside `notes`.

## Dedup, cursor, and archive state via `ExternalSync`

Two kinds of rows in `ExternalSync` for this source.

**1. One per tracked contact:**
```
source     = "msgraph-contacts"
externalId = <Graph contact id, e.g. "AAMkADk3..."> (immutable thanks to Prefer header)
entityType = "contact"
entityId   = <Contact.id UUID>
syncedAt   = last time this record changed
status     = "synced" | "removed" | "failed"
rawData    = { "graphContact": <raw Graph payload>, "lastError": null | string }
```

The `status` column distinguishes Graph-origin tombstones (`"removed"`) from live rows (`"synced"`) from persistent per-item failures (`"failed"`). This is how we differentiate Graph's archive signal from a future manual-archive feature.

**2. Exactly one cursor row:**
```
source     = "msgraph-contacts"
externalId = "__cursor__"            # double-underscore sentinel; never a valid Graph ID
entityType = "cursor"
entityId   = null
status     = "synced"
rawData    = { "deltaLink": "https://graph.microsoft.com/v1.0/users/.../delta?$deltatoken=..." }
syncedAt   = last successful full sync
```

Cursor advances only when a full pass completes AND every per-contact write succeeded (see C2 resolution below).

## Immutable Graph IDs

Graph contact IDs are NOT stable by default — they change when items move between containers. Since we always call through the same folder surface and Matt currently has only one folder, this is a latent issue, but fixing it is cheap and forward-compatible.

**Fix:** every contacts-related call to Graph (delta, get, search) includes the header `Prefer: IdType="ImmutableId"`. Graph then returns stable IDs that survive folder moves. The `graphFetch` `headers` extension (above) carries this through.

## Concurrency

`syncMicrosoftContacts()` is not safe to run concurrently as originally designed: the two-step create pair (Contact then ExternalSync) could race, leaving orphan Contact rows. Two layers of defense:

**1. Postgres advisory lock** at the top of `syncMicrosoftContacts()`:
```
locked = await prisma.$queryRaw`SELECT pg_try_advisory_lock(hashtext('msgraph-contacts')) AS got`
if (!locked[0].got):
  return { ...emptyResult, skippedLocked: true, durationMs: now() - t0 }
try:
  ...do the sync...
finally:
  await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('msgraph-contacts'))`
```

The lock is per-database-session. Dropping the connection releases it. Two concurrent invocations: the second gets `got = false` and early-returns.

**2. Transactional per-contact create.** Both the `Contact` insert and the `ExternalSync` insert happen inside a single `prisma.$transaction([...])`. If either fails, both roll back. Combined with the `@@unique([source, externalId])` constraint, this guarantees at-most-one `Contact` row per Graph contact.

## Partial-payload-aware UPDATE

`mapGraphToContact(graphContact): Partial<ContactFields>` returns an object with keys present only for fields actually in the payload. The UPDATE constructs a Prisma `update({ where, data })` whose `data` is that partial object. Prisma's semantics: absent keys are untouched.

Tests exercise this directly: given Graph payload `{ id: "X", mobilePhone: "555" }`, the DB row's `email`, `company`, `tags`, `address`, `notes` remain unchanged; only `phone` moves.

## Archive handling

**On `@removed` from Graph:**
1. Find `ExternalSync` by `(source, externalId=graphId)`.
2. If not found → no-op (we never saw this contact).
3. If `status === "removed"` already → no-op (replay; don't extend `archivedAt`).
4. Else: transactionally set `ExternalSync.status = "removed"` and `Contact.archivedAt = now()`. Count as `archived`.

**On an update for a contact whose `ExternalSync.status === "removed"`:**
1. The contact came back in Outlook. Transactionally set `ExternalSync.status = "synced"` and clear `Contact.archivedAt` **only if the existing `archivedAt` was set by us** (see below).
2. Apply the partial-payload update to other fields.
3. Count as `unarchived`.

**Distinguishing Graph-origin archive from manual archive.** Today there's no manual-archive feature, but one is anticipated. The rule: a Graph update clears `Contact.archivedAt` **only when the paired `ExternalSync.status` was `"removed"`**. If `ExternalSync.status` is `"synced"` (or doesn't exist) and `Contact.archivedAt` is set, that's a manual archive — leave it alone. Matt's intentional archive of a contact never gets stomped by a Graph sync.

## Per-item failure and cursor advance

Three retry attempts per failing item, with exponential backoff (50 ms, 200 ms, 800 ms):

```
for attempt in 1..3:
  try:
    await upsertOrArchive(item)
    return "ok"
  catch err:
    if attempt < 3:
      await sleep(50ms * 4^(attempt-1))
      continue
    else:
      summary.errors.push({ graphId, message: err.message, attempts: 3 })
      updateExternalSyncStatus(graphId, "failed")   # best-effort, may itself fail
      return "failed"
```

**Cursor advance is conditional.** After the page loop completes:

```
if summary.errors.length === 0 and finalDeltaLink:
  saveCursor(finalDeltaLink)
  cursorAdvanced = true
else:
  # at least one item permanently failed; keep cursor in place
  # next run re-reads the same delta and retries the failed items
  cursorAdvanced = false
```

This prevents Codex's core C2 concern: a transient DB error no longer silently turns into permanent Outlook/CRM divergence. If the problem is genuinely persistent (bad data, schema issue) the failure surfaces on every run until fixed, rather than being swept under a moved cursor.

## Sync flow (full revised)

```
syncMicrosoftContacts():
  t0 = now()
  locked = pg_try_advisory_lock('msgraph-contacts')
  if (!locked):
    return emptyResult(skippedLocked=true, durationMs=now()-t0)

  try:
    cursor = loadCursor()
    isBootstrap = (cursor === null)
    startUrl = cursor?.deltaLink ?? `https://graph.microsoft.com/v1.0/users/${UPN}/contacts/delta`

    summary = { created: 0, updated: 0, archived: 0, unarchived: 0, errors: [] }
    url = startUrl
    finalDeltaLink = null

    while (url !== null):
      try:
        response = await graphFetch<ContactsDeltaResponse>(url, {
          headers: { "Prefer": 'IdType="ImmutableId"' }
        })
      catch (GraphError err):
        if err.status === 410 and err.code contains "syncState":
          await deleteCursor()
          # restart from scratch; bootstrapReason overridden after recursion
          retry = await syncMicrosoftContacts()
          return { ...retry, bootstrapReason: "delta-expired" }
        else:
          throw                             # cursor stays put; next run retries

      for each entry in response.value:
        outcome = await processOneItemWithRetry(entry)
        # processOneItemWithRetry() handles 3-attempt retry + error bookkeeping
        if outcome === "ok":
          summary[outcome.kind]++           # created | updated | archived | unarchived
        # on "failed", errors[] already appended inside the helper

      url = response['@odata.nextLink'] ?? null
      if response['@odata.deltaLink']:
        finalDeltaLink = response['@odata.deltaLink']

    cursorAdvanced = false
    if summary.errors.length === 0 and finalDeltaLink:
      await saveCursor(finalDeltaLink)
      cursorAdvanced = true

    return {
      isBootstrap,
      bootstrapReason: isBootstrap ? "no-cursor" : undefined,
      skippedLocked: false,
      ...summary,
      cursorAdvanced,
      durationMs: now() - t0
    }

  finally:
    pg_advisory_unlock('msgraph-contacts')
```

`processOneItemWithRetry(entry)` wraps the `upsertContact` / `archiveContact` dispatch, runs three attempts with exponential backoff, and commits each per-contact `Contact` + `ExternalSync` pair inside a Prisma transaction.

## Dev trigger: the gated sync endpoint

**`POST /api/integrations/msgraph/contacts/sync`**

Gates evaluated strictly in order (same defense-in-depth as `/api/integrations/msgraph/test`):

1. **Kill switch** — if `MSGRAPH_TEST_ROUTE_ENABLED !== "true"` OR config loading throws, return `404` with empty body.
2. **Method** — non-`POST` returns `405`.
3. **Auth** — `x-admin-token` header compared against `MSGRAPH_TEST_ADMIN_TOKEN` via `constantTimeCompare`. Missing or wrong → `401 { ok: false, error: "unauthorized" }`.
4. **Handler** — invokes `syncMicrosoftContacts()`, returns `SyncResult` as JSON with `{ ok: true, ...result }`. Uncaught `GraphError` returns `{ ok: false, status, code, path, message }` with the corresponding HTTP status.

**`skippedLocked: true`** surfaces in the response body without any special HTTP status (still 200). The caller sees the counts are all zero and `skippedLocked: true`.

`export const dynamic = "force-dynamic"` prevents build-time prerender.

## Error handling summary

| Condition | Where handled | Behavior |
|---|---|---|
| Missing MSGRAPH env vars | existing `config.ts` | Route returns `404` (kill-switch fallback) |
| Missing/wrong admin token | route | `401 { ok: false, error: "unauthorized" }` |
| Another sync already running | `contacts.ts` advisory lock | Returns `{ skippedLocked: true, ...zeros }`; caller can retry later |
| Graph 401 mid-sync | `client.ts` (existing) | Token auto-invalidate + retry once |
| Graph 403 | `client.ts` | Thrown; sync aborts; cursor and state unchanged |
| Graph 410 `syncStateNotFound` (delta expired) | `contacts.ts` | Delete cursor; re-invoke sync as bootstrap; report `bootstrapReason: "delta-expired"` |
| Graph 429 / 503 / 504 / network error | `client.ts` (existing) | `Retry-After` honored + retry once |
| Per-contact write fails (transient) | `contacts.ts` | 3-attempt retry with backoff; on success continue |
| Per-contact write fails (all 3 attempts) | `contacts.ts` | Log to `summary.errors[]`; set `ExternalSync.status = "failed"`; **do not advance cursor** at end of run |
| `ExternalSync` row missing but tracked by some other path | `upsertContact` | Treated as a fresh create (defensive); logged |
| `Contact` row missing for a tracked `ExternalSync` entityId | `upsertContact` | **Fail-loud:** throw; surfaces in `summary.errors[]`; cursor stays put. Indicates manual DB tampering or a serious bug |
| Malformed cursor `rawData` (bad/missing deltaLink) | `loadCursor` | Log, delete cursor, restart as bootstrap with `bootstrapReason: "delta-expired"` |
| Replayed tombstone (Graph re-sends `@removed` for an already-removed contact) | `archiveContact` | No-op; don't update `archivedAt` or counts |
| Absolute URL to non-Graph host passed to `graphFetch` | extended `client.ts` | Throws immediately (defense against token leak) |

## Testing plan

### Unit tests (vitest, `contacts.test.ts`, `global.fetch` mocked)

**Pure helpers:**

- `mapGraphToContact` — each fallback branch for name, phone, email, address; `categories` pass-through; **partial-payload** (payload with only `id` + `mobilePhone` produces a partial object with only `phone` key); empty arrays correctly omitted

**End-to-end `syncMicrosoftContacts`:**

- Bootstrap (no cursor row) → single page of contacts → cursor written with the deltaLink, `cursorAdvanced: true`
- Delta (cursor present) → empty `value` array → returns all-zero, `cursorAdvanced: true`
- Delta returns one `@removed` tombstone → `archiveContact` sets `archivedAt` and `ExternalSync.status = "removed"`, counts `archived: 1`
- **Replayed tombstone** — second `@removed` for the same graphId → no-op, counts unchanged
- Previously-archived (Graph-origin, `status === "removed"`) contact reappears in delta → `archivedAt` cleared, `status = "synced"`, counts `unarchived: 1`
- **Manual-archive preserved** — contact with `archivedAt` set but `ExternalSync.status === "synced"` receives a Graph update → fields update but `archivedAt` is NOT cleared (manual archive wins)
- **Partial payload** — delta response for existing contact is `{ id, mobilePhone }` only → only `phone` changes, `email`/`company`/`tags`/`address`/`notes` unchanged
- Two-page pagination via absolute `@odata.nextLink` → both pages processed, cursor only written after the final `@odata.deltaLink`
- Graph 410 on first page → cursor deleted, function restarts as bootstrap, reports `bootstrapReason: "delta-expired"`
- **Malformed cursor** — stored `rawData` missing `deltaLink` or non-JSON → function logs, deletes cursor, restarts as bootstrap
- **Transient per-item failure + recovery** — first DB attempt on a contact throws (e.g., simulated timeout), second attempt succeeds → item processed correctly, no entry in `summary.errors`
- **Persistent per-item failure** — all 3 attempts on one contact fail → error in `summary.errors[{graphId, attempts: 3}]`, **`cursorAdvanced: false`**, `ExternalSync.status` for that graphId becomes `"failed"`
- **Concurrent run** — second invocation while first is in flight → returns `{ skippedLocked: true, ...zeros }` immediately; the in-flight sync completes normally
- **graphFetch absolute-URL** — unit test in `client.test.ts`: absolute URL to `graph.microsoft.com` is used verbatim; absolute URL to another host throws
- **graphFetch headers option** — unit test in `client.test.ts`: caller-supplied `Prefer: IdType="ImmutableId"` appears on the outgoing request; caller cannot override `Authorization`

### Integration test (manual, live Graph, gated endpoint)

After deploy to local dev:

1. `POST /api/integrations/msgraph/contacts/sync` without admin token → `401`
2. With admin token, first run → `ok: true, isBootstrap: true, created: ~2302, durationMs: ~60–90s`, `cursorAdvanced: true`. Query `SELECT count(*) FROM contacts` → ~2302. Query `SELECT count(*) FROM external_sync WHERE source = 'msgraph-contacts'` → ~2303 (contacts + 1 cursor row).
3. Immediate second run → `ok: true, isBootstrap: false, created: 0, updated: 0, archived: 0, durationMs: <2s`, `cursorAdvanced: true`.
4. **Concurrent run** — in two terminals, send two simultaneous POSTs. One returns normally; the other returns `skippedLocked: true`.
5. Add one contact in Outlook → run → `created: 1`. Confirm in DB, and confirm `ExternalSync.rawData.graphContact` contains the full payload.
6. Edit that contact's phone in Outlook → run → `updated: 1`. Confirm new phone in DB; confirm email and other fields unchanged.
7. Delete that contact in Outlook → run → `archived: 1`. Confirm `archivedAt` set, `ExternalSync.status = "removed"`, row still present.
8. Re-add the contact in Outlook → run → `unarchived: 1`. Confirm `archivedAt` cleared, `ExternalSync.status = "synced"`.
9. **Manual-archive guard** — in the DB directly, set `archivedAt = now()` on a contact whose `ExternalSync.status` is still `"synced"`. Edit that same contact in Outlook. Run sync. Confirm `archivedAt` is STILL set (manual archive wins); other fields updated correctly.

## Answers to review questions raised during design

1. **Which Graph API surface?** `/users/{upn}/contacts/delta` (root, across all folders). Documented for Graph v1.0; works regardless of folder structure. Matt has zero named sub-folders so this covers everything; if that ever changes, the same endpoint still enumerates the full set.

2. **Per-item failure strategy?** Three in-place retries with exponential backoff, then record to `summary.errors` and set `ExternalSync.status = "failed"`. If any item permanently fails, do NOT advance the cursor; the next sync retries from the same point. This balances resilience (transient blips don't block progress) with correctness (persistent failures don't silently become permanent divergence).

3. **How is manual archive preserved?** The `ExternalSync.status` column is the disambiguator. `"removed"` means "Graph said this is gone"; anything else means "still live in Graph, or failed." The unarchive rule is: only clear `Contact.archivedAt` when the paired `ExternalSync.status` was `"removed"`. Manual archives set `archivedAt` without touching `ExternalSync.status`, and are therefore preserved.

4. **What if `ExternalSync` missing but `Contact` exists?** Fail loud. This indicates the bookkeeping was corrupted out-of-band (manual DB edit, failed migration, partial rollback). We refuse to guess — the sync surfaces the offending `graphId` in `summary.errors` and leaves the cursor in place. Operator repairs manually and re-runs.

## Open items / follow-ups (NOT in this spec)

- **Contact enrichment from email signatures** (separate spec after email ingestion lands). Consumes signature data extracted during email ingestion; updates `Contact` records subject to the active-Deal gate.
- **Multi-value phone/email/address schema migration** — revisit only if real-world usage surfaces enough cases where `ExternalSync.rawData.graphContact` stashing isn't enough (e.g. the UI needs to show multiple phones without extra joins).
- **Promoting "personal" category via inference** — the default-`business` behavior is cheap and reversible; revisit with real data.
- **Production trigger** — the email-sync cron/webhook will call `syncMicrosoftContacts()` as a preamble to its own work.
- **Audit trail of changes** — if Matt later wants "what changed on contact X over time," consider logging to `AgentAction` on each update.
- **Manual archive feature** — if/when a "Matt archives a contact in the CRM UI" flow lands, the spec already preserves its semantics; the UI just sets `archivedAt` without touching `ExternalSync.status`.
- **Immutable-ID assumption hardening** — if Graph ever drops the `Prefer: IdType` header from a response (edge case with old mailboxes), the sync should detect via a small sanity check on the returned IDs and alert rather than silently fragment contacts.

## Assumptions

- `Contacts.Read` (Application) is granted on the Azure app registration (verified via 2,302-count recon 2026-04-22).
- Matt's contacts live only in the default Contacts folder (verified — zero named sub-folders).
- Graph's `/users/{upn}/contacts/delta` endpoint honors the `Prefer: IdType="ImmutableId"` request header and returns stable IDs. This matches Microsoft's published behavior; if a tenant quirk breaks it, the "immutable-ID hardening" open item above catches it.
- Delta tokens remain valid long enough for a typical sync cadence (hours to days). Token expiry is handled gracefully via the 410 → bootstrap path regardless of the precise lifetime.
- `ExternalSync` remains the canonical per-record, cursor, and per-item-status tracker for all future ingesters. No schema changes needed.
