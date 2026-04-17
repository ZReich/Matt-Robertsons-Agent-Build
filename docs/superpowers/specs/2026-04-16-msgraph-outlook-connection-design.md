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

Reads and validates the following env vars at module load. Throws a descriptive error naming the missing variable if any are absent. Module-load validation means misconfiguration surfaces when `pnpm dev` starts, not when a cron job hits Graph at 3 AM.

| Variable | Purpose |
|---|---|
| `MSGRAPH_TENANT_ID` | Azure tenant GUID, from Dereck. |
| `MSGRAPH_CLIENT_ID` | App registration client ID, from Dereck. |
| `MSGRAPH_CLIENT_SECRET` | Client secret value, from Dereck. Expires 2028-04-15. |
| `MSGRAPH_TARGET_UPN` | Matt's Microsoft login (e.g. `matt.robertson@nai...`). Stored as env, not hardcoded, so we can point at a sandbox mailbox without a code change. |
| `MSGRAPH_TEST_ADMIN_TOKEN` | Long random string. Required as `x-admin-token` header on the test endpoint. |

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
3. Otherwise → set `inflight = fetchNewToken()`, await, populate `cached`, clear `inflight`, return token.

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
4. On **429** — reads `Retry-After` header, sleeps that duration, retries once. If the retry also 429s, throws.
5. On **401** — treats as stale token mid-flight. Clears the token cache (`tokenManager.invalidate()`), retries once. If the retry also 401s, throws.
6. On **403** — throws immediately. 403 indicates a permissions or access-policy problem that retrying cannot fix.
7. On any other non-2xx — parses Graph's structured error JSON (`{ error: { code, message } }`), throws `GraphError` with status, code, path, and message.
8. On 2xx — returns `await res.json() as T`.

**Helper functions** (in `client.ts` for this spec; may split out later as surface grows):

```ts
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;              // Graph returns null for some mailbox configurations
  userPrincipalName: string;
}

export interface GraphMessage {
  id: string;
  subject: string | null;           // some messages (calendar invites, etc.) have null subject
  from: {
    emailAddress: { name: string; address: string };
  } | null;                         // rare but possible (drafts, system messages)
  receivedDateTime: string;         // ISO 8601 string
}

export async function getUser(upn: string): Promise<GraphUser>;
export async function listRecentMessages(upn: string, top: number): Promise<GraphMessage[]>;
```

These are **narrow** — only the fields the code actually consumes. If a future feature needs more (body, attachments, conversationId, etc.), it extends the interface at that point. This keeps the type surface honest about what the code touches.

`listRecentMessages` uses the Graph query `?$top={top}&$select=id,subject,from,receivedDateTime&$orderby=receivedDateTime desc` — `$select` minimizes payload size, `$orderby` pins the sort order so "most recent 10" actually means that.

### `index.ts`

Public barrel export:

```ts
export { graphFetch, getUser, listRecentMessages } from "./client";
export { GraphError } from "./errors";
export type { GraphUser, GraphMessage } from "./client";
```

Nothing else in the app imports from subpaths of `@/lib/msgraph`.

### `app/api/integrations/msgraph/test/route.ts`

**`GET /api/integrations/msgraph/test`**

**Auth:** requires header `x-admin-token: <MSGRAPH_TEST_ADMIN_TOKEN>`. Missing or wrong → `401 { ok: false, error: "unauthorized" }`. The header is compared with a constant-time string comparison (`timingSafeEqual` on `Buffer`s of equal length) to avoid timing-side-channel probing — overkill for a dev test route, but costs nothing.

**Handler:**

1. Call `getUser(MSGRAPH_TARGET_UPN)`.
2. Call `listRecentMessages(MSGRAPH_TARGET_UPN, 10)`.
3. Return:

```json
{
  "ok": true,
  "user": { "displayName": "...", "mail": "..." },
  "recentMessages": [
    { "id": "...", "subject": "...", "from": "...", "receivedAt": "..." },
    ...
  ]
}
```

**On `GraphError`:** respond with matching HTTP status and `{ ok: false, status, code, path, message }` so failures are debuggable by reading the response body directly.

**Why `getUser` first, then `listRecentMessages`:** splitting the two calls isolates failure modes. If auth or tenant scoping is wrong, `getUser` fails with an unambiguous error. If we only called `listRecentMessages`, a failure could mean auth broken OR wrong UPN OR empty inbox, and diagnosis would require more digging.

## Data flow

```
Browser → GET /api/integrations/msgraph/test (with x-admin-token)
       ↓
route.ts verifies header
       ↓
route.ts calls getUser(upn) → client.graphFetch("/users/{upn}")
                                ↓
                            tokenManager.getAccessToken()
                              ├─ cache hit? return token.
                              └─ cache miss → POST login.microsoftonline.com/{tenant}/oauth2/v2.0/token
                                             ← access_token, expires_in
                                ↓
                            fetch("graph.microsoft.com/v1.0/users/{upn}") with Bearer
                              ← user JSON
       ↓
route.ts calls listRecentMessages(upn, 10) → [same flow, different endpoint]
       ↓
route.ts returns { ok: true, user, recentMessages }
```

## Error handling summary

| Condition | Where handled | Behavior |
|---|---|---|
| Missing env var | `config.ts` at module load | Throws with variable name; `pnpm dev` fails to start. |
| Token fetch non-2xx | `token-manager.ts` | Throws `GraphError`. Secret/token never logged. |
| Graph 401 on a request | `client.ts` | Invalidate cache, retry once, then throw. |
| Graph 403 on a request | `client.ts` | Throw immediately (not retryable). |
| Graph 429 on a request | `client.ts` | Honor `Retry-After`, retry once, then throw. |
| Other Graph non-2xx | `client.ts` | Throw `GraphError` with parsed `error.code`. |
| Missing/wrong admin token on test route | `route.ts` | `401 { ok: false, error: "unauthorized" }`. |
| Any `GraphError` reaching the test route | `route.ts` | Respond with matching HTTP status and error details. |

## Verification plan

Run in order. Every step must pass before the slice is considered done.

1. `pnpm dev` starts without error → confirms `config.ts` found every env var.
2. `GET /api/integrations/msgraph/test` *without* `x-admin-token` → returns `401`. Confirms the auth gate.
3. `GET /api/integrations/msgraph/test` *with* correct `x-admin-token` → returns `{ ok: true, user: {...}, recentMessages: [...10 items...] }` containing Matt's real display name and real subject lines. **This is the decisive test.** If it passes, end-to-end plumbing is proven: tenant, app registration, secret, consent, access policy, network path, token exchange, Graph API call, response parsing.
4. Failure-mode sanity checks (optional but recommended):
   - Set `MSGRAPH_CLIENT_SECRET` to a garbage value → endpoint returns `401` with a clear error.
   - Set `MSGRAPH_TARGET_UPN` to `doesnotexist@example.com` → endpoint returns `404` with Graph's `User not found`.

## Security notes

- `.env.local` is already in `.gitignore` at the repo root. Implementation will verify this as the first step before any secret is written to disk.
- The client secret and every access token are treated as sensitive throughout: never logged, never returned in API responses, never placed in error messages sent to the client.
- The test endpoint's `x-admin-token` is a defense-in-depth measure against an accidental Vercel deploy. It is not a substitute for proper session-based auth on production endpoints — when the CRM's own auth story is settled, the test route migrates to session-based auth (tracked for a later spec).
- Secret rotation: the client secret expires **2028-04-15**. Zach to add a calendar reminder for **2028-03-15** (30-day runway). A later spec on `IntegrationCredential` will formalize rotation as a DB-managed operation.

## Open items tracked for follow-up specs

- **Credential encryption + `IntegrationCredential` migration** — move `MSGRAPH_CLIENT_SECRET` from `.env.local` into the DB with app-layer encryption.
- **Email ingestion** — transform a Graph message payload into a `Communication` row, with contact resolution.
- **Contact seeding** — one-time import of Matt's Outlook contacts into the `Contact` table.
- **Historical email backfill** — strategy for sweeping existing inbox; volume estimate; rate limits; contact-creation aggressiveness.
- **Ongoing sync** — Graph webhook subscriptions vs. delta query cron; reconciliation on missed events.
- **Vault markdown mirror** — when a `Communication` is created, write a corresponding file to `vault/communications/YYYY-MM-DD-email-<slug>.md`.
- **Calendar writes** — using `Calendars.ReadWrite` to auto-create events from call transcripts / agent actions.
- **Outbound email capture** — reading Sent Items so outbound messages land in `Communication` with `direction=outbound`.
- **Agent actions** — Graph failures feeding into the `AgentAction` approval queue where appropriate.

## Assumptions to verify against Dereck's reply

1. Permissions added as **Application** (not Delegated).
2. Admin consent granted for all three.
3. **Application Access Policy** restricts the app to Matt's mailbox.
4. No IP allowlisting / Conditional Access restrictions that would block a Vercel IP.
5. Confirm Matt's exact UPN.
