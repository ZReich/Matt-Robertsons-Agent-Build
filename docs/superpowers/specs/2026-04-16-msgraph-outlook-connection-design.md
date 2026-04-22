# Microsoft Graph / Outlook Connection — Design

**Date:** 2026-04-16
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review
**Scope:** First of several specs covering the email/calendar/contacts integration for Matt Robertson's CRM. This spec covers **only** the Microsoft Graph connection layer — token management, an authenticated HTTP wrapper, and a test endpoint that proves the pipe works end-to-end. It does **not** cover ingestion into the `Communication`/`Contact` tables, vault markdown mirroring, historical backfill, webhooks, or UI.

---

## Context

Matt Robertson is a commercial real estate broker. We are building an AI-powered executive assistant CRM that unifies his emails, calls, texts, Plaud transcripts, and calendar so nothing falls through the cracks. The CRM backend is Next.js + Prisma + Supabase (Postgres), with an Obsidian-style markdown vault mirror under `full-kit/vault/` for human-readable knowledge.

NAI's IT provider (Entre Technology Services) has created an Azure AD / Entra ID app registration and provided Tenant ID, Client ID, and Client Secret (expires 2028-04-15). We are proceeding on the assumption that:

1. Permissions granted as **Application** type: `Mail.ReadWrite`, `Contacts.Read`, `Calendars.ReadWrite`.
2. Admin consent has been granted tenant-wide.
3. An **Application Access Policy** scopes the app to Matt's mailbox only.
4. No IP allowlisting.

These assumptions are to be verified against Dereck's follow-up reply. If any turn out false, the failure mode is a clear 401/403 from Graph — not silent data corruption.

## Goals

- Establish a single, reusable Microsoft Graph client layer inside the codebase.
- Provide a browser-testable proof that the credentials, permissions, and network path all work end-to-end.
- Leave every decision that can be deferred (persistence, UI, ingestion, schema writes) for subsequent specs.

## Non-goals

- Writing messages, contacts, meetings, or todos to the database.
- Vault markdown mirroring.
- Historical email backfill.
- Webhook subscriptions or delta queries for ongoing sync.
- Moving credentials from `.env.local` into the `IntegrationCredential` table. (Left for a later spec on credential encryption/rotation.)
- Any UI surface beyond the JSON test endpoint.
- Contact deduplication or matching logic.

## File layout

```
full-kit/
├── .env.local                                 # + MSGRAPH_* vars (gitignored)
└── src/
    ├── lib/
    │   └── msgraph/                           # NEW — only place Graph exists
    │       ├── config.ts                      # env var loader + validator
    │       ├── token-manager.ts               # TokenManager class + singleton
    │       ├── client.ts                      # graphFetch() + helpers
    │       ├── errors.ts                      # GraphError class
    │       └── index.ts                       # public exports
    └── app/
        └── api/
            └── integrations/
                └── msgraph/
                    └── test/
                        └── route.ts           # GET — smoke test endpoint
```

**Boundary rule:** only `src/lib/msgraph/` imports from Microsoft or hits the Graph URL. Every future feature (ingestion, contact sync, calendar writes) imports from `@/lib/msgraph`. The rest of the codebase does not know Microsoft exists.

## Component design

### `config.ts`

Reads and validates the following env vars at first import. Throws a descriptive error naming the missing variable if any are absent. (Note: Next.js lazy-loads server modules, so this validation runs on first server-side use of the module, not on process startup. That is sufficient — misconfiguration still surfaces on the first dev request that touches this code, with a clear error, rather than with a cryptic failure deep inside a Graph call.)

| Variable | Purpose |
|---|---|
| `MSGRAPH_TENANT_ID` | Azure tenant GUID, from Dereck. |
| `MSGRAPH_CLIENT_ID` | App registration client ID, from Dereck. |
| `MSGRAPH_CLIENT_SECRET` | Client secret value, from Dereck. Expires 2028-04-15. |
| `MSGRAPH_TARGET_UPN` | Matt's Microsoft login (e.g. `matt.robertson@nai...`). Stored as env, not hardcoded, so we can point at a sandbox mailbox without a code change. |
| `MSGRAPH_TEST_ADMIN_TOKEN` | Long random string. Required as `x-admin-token` header on the test endpoint. |
| `MSGRAPH_TEST_ROUTE_ENABLED` | `"true"` to enable the test route. Any other value (including absent) disables the route entirely — it returns `404`. Hard kill-switch so an accidental Vercel deploy cannot expose the route even if `MSGRAPH_TEST_ADMIN_TOKEN` leaked. |

### `token-manager.ts`

A class with a module-level singleton export:

```ts
class TokenManager {
  private cached: { token: string; expiresAt: number } | null = null;
  private inflight: Promise<string> | null = null;

  async getAccessToken(): Promise<string>;
  invalidate(): void;                                      // clear cache (used on 401 retry)
  private async fetchNewToken(): Promise<{ token: string; expiresAt: number }>;
}

export const tokenManager = new TokenManager();
```

`invalidate()` simply sets `cached = null`. It exists so `client.ts` can force a fresh token on a mid-flight 401 without reaching into the TokenManager's internals.

**`getAccessToken()` logic:**

1. If `cached` exists and `cached.expiresAt > Date.now() + 5 * 60 * 1000` → return `cached.token`.
2. If `inflight` is set → `await inflight` (dedup concurrent refresh).
3. Otherwise → set `inflight = fetchNewToken()`. Use `try { await inflight; populate cached } finally { inflight = null }`. **`inflight` must be cleared in `finally`**, not after a successful await — otherwise a failed token fetch leaves every future caller awaiting a rejected promise forever.

**`fetchNewToken()` logic:**

- `POST https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
- Headers: `Content-Type: application/x-www-form-urlencoded`
- Body (form-encoded): `grant_type=client_credentials`, `client_id`, `client_secret`, `scope=https://graph.microsoft.com/.default`
- On 2xx: returns `{ token: access_token, expiresAt: Date.now() + expires_in * 1000 }`.
- On non-2xx: throws `GraphError` with status and a sanitized message. **Never** logs the client secret or the returned access token.

**Design decisions:**

- **5-minute safety margin** ensures a request starting near expiry does not finish on an expired token.
- **Module-level singleton** so all callers in a process share one cache. On Vercel, each warm lambda reuses its cache; cold starts pay one extra ~150ms token fetch. Acceptable.
- **In-flight dedup** prevents a cold start from kicking off N parallel token fetches under concurrent load.
- **No persistence.** The access token lives only in memory. Client-credentials tokens are cheap to re-mint; persisting them would expand the blast radius of a DB leak with no upside. The *client secret* itself will eventually move to `IntegrationCredential` with app-layer encryption — tracked for a later spec.

### `errors.ts`

```ts
export class GraphError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,   // Graph's error.code, e.g. "Authorization_RequestDenied"
    public readonly path: string,
    message: string
  ) { super(message); }
}
```

Downstream code can `if (err instanceof GraphError && err.status === 403)` with full type safety.

### `client.ts`

Stateless function (not a class). Responsibility: make an authenticated HTTP call to Graph, handle Graph-specific failure modes, return parsed JSON.

```ts
export async function graphFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T>;
```

**Behavior on top of plain `fetch`:**

1. Acquires a valid access token via `tokenManager.getAccessToken()`.
2. Prefixes `https://graph.microsoft.com/v1.0` to the `path` argument so callers pass relative paths.
3. Sets `Authorization: Bearer <token>`, `Content-Type: application/json` where applicable.
4. On **429 / 503 / 504 / network error** — retry **once**, then throw. Uses the same one-retry bucket for all transient failures. Before retrying:
   - If `Retry-After` header is present: parse as either (a) delta-seconds (e.g. `"30"`) or (b) HTTP-date (e.g. `"Wed, 21 Oct 2026 07:28:00 GMT"`). Use the parsed value, clamped to a reasonable max (e.g. 60 seconds — if Graph wants us to wait longer than that, we'd rather fail fast and let a cron retry later than hang a request).
   - If `Retry-After` is absent or unparseable: default to a short wait (e.g. 2 seconds).
5. On **401** — treats as stale token mid-flight. Calls `tokenManager.invalidate()`, retries once. If the retry also 401s, throws.
6. On **403** — throws immediately. 403 indicates a permissions or access-policy problem that retrying cannot fix.
7. On any other non-2xx — parses Graph's structured error JSON (`{ error: { code, message } }`), throws `GraphError` with status, code, path, and message.
8. On 2xx — returns `await res.json() as T`.

**Helper functions** (in `client.ts` for this spec; may split out later as surface grows):

```ts
export interface GraphMailboxInfo {
  id: string;                       // folder id of Inbox
  displayName: string;              // "Inbox" — confirms mailbox is reachable
  totalItemCount: number;
  unreadItemCount: number;
}

export interface GraphMessage {
  id: string;
  subject: string | null;           // some messages (calendar invites, etc.) have null subject
  from: {
    emailAddress: { name: string; address: string };
  } | null;                         // rare but possible (drafts, system messages)
  receivedDateTime: string;         // ISO 8601 string
}

export async function getMailboxInfo(upn: string): Promise<GraphMailboxInfo>;
export async function listRecentMessages(upn: string, top: number): Promise<GraphMessage[]>;
```

These are **narrow** — only the fields the code actually consumes. If a future feature needs more (body, attachments, conversationId, etc.), it extends the interface at that point. This keeps the type surface honest about what the code touches.

**Why `getMailboxInfo` instead of `getUser`:** `GET /users/{upn}` requires `User.Read.All` as an Application permission, which is *not* in the set we asked Dereck for (`Mail.ReadWrite`, `Contacts.Read`, `Calendars.ReadWrite`). Rather than go back to NAI for a permission we don't actually need, the preflight hits `GET /users/{upn}/mailFolders/inbox` — covered by `Mail.ReadWrite`, and still gives a clean "can we reach the mailbox at all" signal distinct from the messages list.

`listRecentMessages` uses the Graph query `?$top={top}&$select=id,subject,from,receivedDateTime&$orderby=receivedDateTime desc` — `$select` minimizes payload size, `$orderby` pins the sort order so "most recent 10" actually means that.

### `index.ts`

Public barrel export:

```ts
export { graphFetch, getMailboxInfo, listRecentMessages } from "./client";
export { GraphError } from "./errors";
export type { GraphMailboxInfo, GraphMessage } from "./client";
```

Nothing else in the app imports from subpaths of `@/lib/msgraph`.

### `app/api/integrations/msgraph/test/route.ts`

**`GET /api/integrations/msgraph/test`**

**Kill switch (evaluated first, before any other logic):** if `MSGRAPH_TEST_ROUTE_ENABLED !== "true"`, respond with `404` as if the route does not exist. Do not reveal that the route is gated; a `404` is indistinguishable from a route that was never deployed. This is a defense-in-depth measure so a stray Vercel deploy without the flag set cannot expose the route even if `MSGRAPH_TEST_ADMIN_TOKEN` leaked.

**Auth:** requires header `x-admin-token: <MSGRAPH_TEST_ADMIN_TOKEN>`. Missing or wrong → `401 { ok: false, error: "unauthorized" }`. Comparison sequence:

1. Check header is present and is a string.
2. Check `Buffer.byteLength(header) === Buffer.byteLength(expected)`. If not, return `401` immediately. (Skipping this step is a bug: `timingSafeEqual` throws on mismatched lengths, which both leaks length via the throw and turns into an unhandled exception.)
3. Only if lengths match, call `crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))`.

**Handler:**

1. Call `getMailboxInfo(MSGRAPH_TARGET_UPN)`.
2. Call `listRecentMessages(MSGRAPH_TARGET_UPN, 10)`.
3. Return:

```json
{
  "ok": true,
  "mailbox": { "displayName": "Inbox", "totalItemCount": 12345, "unreadItemCount": 42 },
  "recentMessages": [
    { "id": "...", "subject": "...", "from": "...", "receivedAt": "..." },
    ...
  ]
}
```

**On `GraphError`:** respond with matching HTTP status and `{ ok: false, status, code, path, message }` so failures are debuggable by reading the response body directly.

**Why `getMailboxInfo` first, then `listRecentMessages`:** splitting the two calls isolates failure modes. If auth or access policy is wrong, `getMailboxInfo` fails with an unambiguous error. If we only called `listRecentMessages`, a failure could mean auth broken OR wrong UPN OR empty inbox, and diagnosis would require more digging.

## Data flow

```
Browser → GET /api/integrations/msgraph/test (with x-admin-token)
       ↓
route.ts checks MSGRAPH_TEST_ROUTE_ENABLED → if not "true", 404.
       ↓
route.ts verifies x-admin-token header (length check + timingSafeEqual).
       ↓
route.ts calls getMailboxInfo(upn) → client.graphFetch("/users/{upn}/mailFolders/inbox")
                                ↓
                            tokenManager.getAccessToken()
                              ├─ cache hit? return token.
                              └─ cache miss → POST login.microsoftonline.com/{tenant}/oauth2/v2.0/token
                                             ← access_token, expires_in
                                ↓
                            fetch("graph.microsoft.com/v1.0/users/{upn}/mailFolders/inbox") with Bearer
                              ← mailbox JSON
       ↓
route.ts calls listRecentMessages(upn, 10) → [same flow, different endpoint]
       ↓
route.ts returns { ok: true, mailbox, recentMessages }
```

## Error handling summary

| Condition | Where handled | Behavior |
|---|---|---|
| Missing env var | `config.ts` at module load | Throws with variable name; `pnpm dev` fails to start. |
| Token fetch non-2xx | `token-manager.ts` | Throws `GraphError`. Secret/token never logged. |
| Graph 401 on a request | `client.ts` | Invalidate cache, retry once, then throw. |
| Graph 403 on a request | `client.ts` | Throw immediately (not retryable). |
| Graph 429 / 503 / 504 / network error | `client.ts` | Parse `Retry-After` (delta-seconds or HTTP date, clamped to 60s; default 2s if absent), retry once, then throw. |
| Other Graph non-2xx | `client.ts` | Throw `GraphError` with parsed `error.code`. |
| `MSGRAPH_TEST_ROUTE_ENABLED` not `"true"` | `route.ts` | `404`, no body. Indistinguishable from an unrouted URL. |
| Missing/wrong admin token on test route | `route.ts` | `401 { ok: false, error: "unauthorized" }`. |
| Any `GraphError` reaching the test route | `route.ts` | Respond with matching HTTP status and error details. |

## Verification plan

Run in order. Every step must pass before the slice is considered done.

1. `pnpm dev` starts without error, and the first request to `/api/integrations/msgraph/test` either succeeds or fails with a clear env-var-missing error (not a cryptic deep stack trace) → confirms `config.ts` validation works.
2. With `MSGRAPH_TEST_ROUTE_ENABLED` unset or not `"true"`: `GET /api/integrations/msgraph/test` returns `404`. Confirms the kill switch.
3. With `MSGRAPH_TEST_ROUTE_ENABLED="true"` but *without* `x-admin-token`: returns `401`. Confirms the auth gate.
4. With both the flag set and correct `x-admin-token`: returns `{ ok: true, mailbox: {...}, recentMessages: [...10 items...] }` containing real Inbox counts and real subject lines from Matt's mailbox. **This is the decisive test.** If it passes, end-to-end plumbing is proven: tenant, app registration, secret, consent, access policy, network path, token exchange, Graph API call, response parsing.
5. Failure-mode sanity checks (optional but recommended):
   - Set `MSGRAPH_CLIENT_SECRET` to a garbage value → endpoint returns a clear non-2xx auth error. (Azure's token endpoint typically returns `400 invalid_client` in this case, not `401` — the point is that the error surface is readable, not a specific status code.)
   - Set `MSGRAPH_TARGET_UPN` to `doesnotexist@example.com` → endpoint returns `404` with Graph's `ResourceNotFound` / user-not-found error.

## Security notes

- `.env.local` is already in `.gitignore` at the repo root. Implementation will verify this as the first step before any secret is written to disk.
- The client secret and every access token are treated as sensitive throughout: never logged, never returned in API responses, never placed in error messages sent to the client.
- The test endpoint's `x-admin-token` is a defense-in-depth measure against an accidental Vercel deploy. It is not a substitute for proper session-based auth on production endpoints — when the CRM's own auth story is settled, the test route migrates to session-based auth (tracked for a later spec).
- Secret rotation: the client secret expires **2028-04-15**. Zach to add a calendar reminder for **2028-03-15** (30-day runway). A later spec on `IntegrationCredential` will formalize rotation as a DB-managed operation.

## Open items tracked for follow-up specs

Ordered by intended implementation sequence. Each gets its own brainstorm → spec → plan → execute cycle.

1. **Contact seeding** *(next spec)* — one-time import of Matt's Outlook Contacts (the list he explicitly curates) into the `Contact` table via `Contacts.Read`. No filtering needed (Outlook Contacts are 100% curated by Matt). Establishes the contact lookup table every downstream spec depends on. Pipeline-pattern warm-up for the larger email specs. Matt's Supabase is currently empty, so no `key_contacts`-from-existing-`Deal` merge is in scope.

2. **Signal-vs-noise filtering policy** — Matt's mailbox has ~140K messages, 64% unread; an "ingest everything" approach would bury real signal under promotional noise. Defines a three-tier filter:
   - **Tier 1 (rule-based):** `List-Unsubscribe`/`Precedence: bulk` headers, `noreply@`/`donotreply@`/`updates@` sender patterns, Outlook Junk/Deleted folders, known bulk-sender domains.
   - **Tier 2 (behavioral scoring):** Matt replied? flagged? moved out of Inbox? sender in `Contact`? sender on active `Deal`? age + untouched-for-X-days?
   - **Tier 3 (Codex Spark classification):** for AMBIGUOUS emails, call `gpt-5.3-codex-spark` via the `codex:codex-rescue` subagent with `--model spark --effort low`. Batches of ~50 emails, throttled to 4 batches/minute during backfill (Spark is fast — ~1200 tokens/sec). Output is CRE-tuned: labels `{actionable, informational, low_value, noise}` with a one-line reason and confidence. Noise bucket **still ingested** (option B) with a `classification: "noise"` tag for auditability, just never surfaced in default queries. Prompt uses XML-tagged operator-style contract per `codex:gpt-5-4-prompting`, with explicit `<action_safety>` to defend against prompt injection.

3. **Email ingestion (DB only)** — transform a filtered Graph message payload into a `Communication` row with contact resolution. Uses Tier 1/2 filters directly, queues AMBIGUOUS rows for Tier 3 classification, writes the label back alongside. **Includes signature parsing as an output of the same Spark call** — classifier returns an `extracted_signature` field (name, title, company, phone, email, address) that's stored on the `Communication` row for later enrichment. **Does not include a vault mirror** — see "Vault scope clarification" below.

4. **Contact enrichment** — consume the `extracted_signature` data produced by #3 and update `Contact` records. Scoped to **only contacts linked to an active `Deal`** to prevent random-sender noise from polluting real contact data. Uses the `AgentAction` approval queue: fills *null* fields automatically (tier `auto`), but conflicting values (phone A → phone B) go to tier `approve` for Matt's review. The `Contact` schema currently has a single `phone` field; if multi-phone cases become common, a schema migration to a `phones[]` shape is a follow-on.

5. **"Missed opportunity" surfacer** — one-time report over backfill results. Surfaces AMBIGUOUS + HIGH-behavioral-score rows that Matt never engaged with. Day-one product payoff: "here are 8 emails from known contacts over the last 90 days that look actionable and haven't been read."

6. **Historical email backfill** — apply the ingestion pipeline over Matt's full existing inbox. Separate spec because of different concerns: rate limiting, progress tracking, restart-after-interrupt, which date ranges to start with. Runs locally via Codex Spark, not on Vercel.

7. **Ongoing sync** — Graph webhook subscriptions vs. delta-query cron; reconciliation on missed events. Volume is tiny (~50–200 messages/day) so classification cost is negligible. Runs locally alongside backfill or on a cheap always-on process — deferred decision.

8. **Outbound email capture** — reading Sent Items so outbound messages land in `Communication` with `direction=outbound`. Most outbound mail is high-signal by default (Matt wrote it on purpose) so filtering is lighter here.

9. **Calendar writes** — using `Calendars.ReadWrite` to auto-create events from call transcripts / agent actions. Independent of the ingestion pipeline; slot in whenever a use-case materializes.

10. **Credential encryption + `IntegrationCredential` migration** — move `MSGRAPH_CLIENT_SECRET` from `.env.local` into the DB with app-layer encryption. Non-urgent; do before production deploy.

11. **Agent actions** — Graph failures feeding into the `AgentAction` approval queue where appropriate. Cross-cutting concern that each earlier spec contributes to.

### Security guardrails inherited by every ingestion-related spec

- **No attachment download or parsing, ever.** Metadata only (filename, size, content-type).
- **No URL resolution, no remote-image loading, no external fetches triggered by ingestion.**
- **LLM classifier has no tool access** — output is a label + reason string, nothing more. Email content is treated as data, not instructions.
- **Prompt injection defense** — every classifier call includes an `<action_safety>` block telling the model to treat email body text as data, not commands.
- **UI rendering** (later spec) — email bodies rendered as plain text or via aggressive HTML sanitization; no auto-loading of remote content.
- **High-phishing-risk classifications gate agent actions** — such emails never auto-create todos or calendar events.

### Wire-fraud detection — deferred

CRE brokers are a known target for wire-fraud scams (impersonated title-company "updated wiring instructions" mid-closing). Flagging this as a distinct classifier output is explicitly deferred per user request (2026-04-22). Worth revisiting once the base pipeline is stable.

### Vault scope clarification (supersedes earlier "vault markdown mirror" item)

Original plan proposed mirroring every ingested `Communication` to a markdown file in `vault/communications/`. **This is out of scope for transactional data** for three reasons:

1. **Vercel filesystem is read-only at runtime.** Any ingestion running on a Vercel cron or webhook handler cannot write to the vault. The only workarounds (local-only ingestion, GitHub API commits per message, separate always-on server) introduce significant complexity.
2. **Storage duplication with no information gain.** The DB already has the data, with better indexing and full-text search via Postgres.
3. **Sync complexity.** Every write to two stores creates reconciliation problems and a "source of truth" ambiguity.

**The vault is retained for curated, human-authored content where markdown genuinely earns its place:**

- `vault/agent-memory/` — rules, playbooks, style guides (source of truth: vault; synced to `AgentMemory` table for runtime query)
- `vault/templates/` — reusable message scaffolds (source of truth: vault; synced to `Template` table)
- `vault/clients/` — optional long-form client dossiers and narrative notes
- Ad-hoc reference material, SOPs

If Matt later wants to browse his emails specifically inside Obsidian, a local-machine export tool can generate markdown on demand. That is a small separate utility, not a runtime feature of the deployed app.

## Assumptions to verify against Dereck's reply

1. Permissions added as **Application** (not Delegated).
2. Admin consent granted for all three (`Mail.ReadWrite`, `Contacts.Read`, `Calendars.ReadWrite`). Note: we are **not** asking for `User.Read.All` — the design was reworked after code review to use mailbox-scoped endpoints only, so we never hit `/users/{upn}` without a mailbox subpath.
3. **Application Access Policy** restricts the app to Matt's mailbox.
4. No IP allowlisting / Conditional Access restrictions that would block a Vercel IP.
5. Confirm Matt's exact UPN.
