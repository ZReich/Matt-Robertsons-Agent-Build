# Microsoft Graph Contact Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a delta-based Microsoft Graph contacts synchronizer that populates and maintains the `Contact` table from Matt Robertson's Outlook, safe under concurrent execution, idempotent, and resilient to partial-delta payloads and transient failures.

**Architecture:** Extend the existing `graphFetch` client with absolute-URL and custom-header support. Add a single new `contacts.ts` module that runs sync inside a Postgres advisory lock, wraps every per-contact create in a Prisma transaction, uses `ExternalSync.status` to track Graph-origin archive state separately from future manual archives, and only advances the delta cursor when every item in the pass succeeds.

**Tech Stack:** Next.js 15, TypeScript, Prisma 5.20 + Postgres (Supabase), vitest 4 for unit tests with mocked `global.fetch` and mocked `@/lib/prisma`, existing Graph client library at `full-kit/src/lib/msgraph/`.

**Spec reference:** `docs/superpowers/specs/2026-04-22-contact-sync-design.md` (revised post-Codex, commit `5f2205a`).

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `full-kit/src/lib/msgraph/client.ts` | Modify | Extend `graphFetch` for absolute URLs and a caller-headers option |
| `full-kit/src/lib/msgraph/client.test.ts` | Modify | Add unit tests for the two new capabilities |
| `full-kit/src/lib/msgraph/contacts.ts` | Create | Mapper, cursor helpers, per-item ops with retry, orchestrator with lock |
| `full-kit/src/lib/msgraph/contacts.test.ts` | Create | Full unit test suite (~15 cases) with mocked fetch and mocked Prisma |
| `full-kit/src/lib/msgraph/index.ts` | Modify | Barrel adds `syncMicrosoftContacts`, `SyncResult` type |
| `full-kit/src/app/api/integrations/msgraph/contacts/sync/route.ts` | Create | Gated POST endpoint matching the `/test` endpoint's defense-in-depth pattern |

**Key project facts to know:**

- Prisma client is imported as `import { db } from "@/lib/prisma"` — the export name is **`db`**, not `prisma`. See `full-kit/src/lib/prisma.ts`.
- `@/` alias resolves to `full-kit/src/`. Configured in both `tsconfig.json` and `vitest.config.ts`.
- Test framework is **vitest 4** (installed in tonight's earlier work). Tests run via `pnpm test` from `full-kit/`.
- Matt's UPN is in `MSGRAPH_TARGET_UPN` env var; real value already in `full-kit/.env.local` but never echoed in logs, tests, or error messages.
- All runtime work happens from `full-kit/` (that's the Next.js app root); repo root is `C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build`.
- Branch: `main` (user approved continuing on main for this project).
- `Contact` and `ExternalSync` Prisma models already exist in `full-kit/prisma/schema.prisma`. No migrations needed.

**Test-strategy note:** unit tests mock both `global.fetch` (via `vi.spyOn`) and `@/lib/prisma` (via `vi.mock`). The "mocked Prisma" pattern recurs across many tasks; see Task 4 for the canonical setup.

---

## Task 1: Extend `graphFetch` for absolute URLs (TDD)

Graph's delta endpoint returns `@odata.nextLink` and `@odata.deltaLink` as fully-qualified URLs starting with `https://graph.microsoft.com/`. Our current `graphFetch` always prepends `GRAPH_BASE`, which would double-prefix these. Extend it to detect absolute Graph URLs and use them verbatim. Reject absolute URLs to any other host (defense against accidental token leak).

**Files:**
- Modify: `full-kit/src/lib/msgraph/client.test.ts`
- Modify: `full-kit/src/lib/msgraph/client.ts`

- [ ] **Step 1: Add failing tests for absolute-URL support**

Append these two tests to the `describe("graphFetch", ...)` block in `full-kit/src/lib/msgraph/client.test.ts`:

```ts
  it("uses absolute graph.microsoft.com URL verbatim", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const absolute = "https://graph.microsoft.com/v1.0/users/x/contacts/delta?$deltatoken=abc";
    await mod.graphFetch(absolute);

    expect(fetchSpy).toHaveBeenCalledWith(
      absolute,
      expect.anything(),
    );
  });

  it("rejects absolute URLs to non-graph.microsoft.com hosts", async () => {
    const { mod } = await loadClientWithTokenManager();

    await expect(
      mod.graphFetch("https://evil.example.com/steal-token"),
    ).rejects.toThrow(/absolute URL/i);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/client.test.ts
```

Expected: two new tests fail. `graphFetch` currently calls `new URL(GRAPH_BASE + path)` which turns the absolute URL into something malformed. Either the URL construction throws or the outgoing fetch goes to the wrong place.

- [ ] **Step 3: Update `graphFetch` to handle absolute URLs**

In `full-kit/src/lib/msgraph/client.ts`, locate the URL-building section inside `doGraphFetch` (currently `const url = new URL(GRAPH_BASE + path);`). Replace that block with:

```ts
  // Resolve absolute vs. relative. Absolute URLs must be on graph.microsoft.com
  // so we never leak a bearer token to an unexpected host.
  let url: URL;
  if (path.startsWith("https://") || path.startsWith("http://")) {
    if (!path.startsWith("https://graph.microsoft.com/")) {
      throw new GraphError(
        0,
        "BadURL",
        path,
        "absolute URL must target graph.microsoft.com",
      );
    }
    url = new URL(path);
  } else {
    url = new URL(GRAPH_BASE + path);
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/client.test.ts
```

Expected: all tests pass (including the two new ones + all previously-passing ones).

- [ ] **Step 5: Run full suite**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test
```

Expected: all tests pass, no regressions. Total count should be current-total + 2.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/client.ts full-kit/src/lib/msgraph/client.test.ts
git commit -m "feat(msgraph): graphFetch accepts absolute graph URLs; rejects other hosts"
```

---

## Task 2: Extend `graphFetch` for custom headers option (TDD)

Contact delta calls need `Prefer: IdType="ImmutableId"` to get stable IDs. Extend `GraphFetchOptions` with a `headers?: Record<string, string>` option. Caller-supplied headers merge OVER the defaults (`Authorization`, `Content-Type`) but the `Authorization` key is **always** set by the function itself — caller cannot override it (defense against accidental token replacement).

**Files:**
- Modify: `full-kit/src/lib/msgraph/client.test.ts`
- Modify: `full-kit/src/lib/msgraph/client.ts`

- [ ] **Step 1: Add failing tests for headers option**

Append to the same `describe("graphFetch", ...)` block in `client.test.ts`:

```ts
  it("merges caller-supplied headers with defaults", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await mod.graphFetch("/users/x", {
      headers: { Prefer: 'IdType="ImmutableId"' },
    });

    const call = fetchSpy.mock.calls[0];
    const opts = call[1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers["Prefer"]).toBe('IdType="ImmutableId"');
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
  });

  it("does not allow caller to override Authorization header", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await mod.graphFetch("/users/x", {
      headers: { Authorization: "Bearer attacker-token" },
    });

    const call = fetchSpy.mock.calls[0];
    const opts = call[1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/client.test.ts
```

Expected: two new tests fail (TypeScript error on the `headers` option OR runtime behavior that doesn't include the header).

- [ ] **Step 3: Extend the `GraphFetchOptions` interface and header construction**

In `full-kit/src/lib/msgraph/client.ts`, find the `GraphFetchOptions` interface and extend it:

```ts
interface GraphFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}
```

Then in `doGraphFetch`, find the current headers block (currently `const headers: Record<string, string> = { Authorization: \`Bearer ${token}\` };`) and replace with:

```ts
  // Merge caller-supplied headers first, then force Authorization ours.
  // Caller cannot override Authorization.
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    Authorization: `Bearer ${token}`,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/client.test.ts
```

Expected: all tests pass including the two new ones.

- [ ] **Step 5: Run full suite**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/client.ts full-kit/src/lib/msgraph/client.test.ts
git commit -m "feat(msgraph): graphFetch accepts caller headers; Authorization remains non-overridable"
```

---

## Task 3: Implement `mapGraphToContact` (TDD, pure)

Pure function that turns a Graph contact payload into two halves: a `partial` that contains only fields Graph actually sent (for UPDATE), and a `createOnly` block that contains the defaults used when we first create a new `Contact` row. The mapper itself never touches the database; it's pure and deterministic.

**Files:**
- Create: `full-kit/src/lib/msgraph/contacts.test.ts`
- Create: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Create the test file with the mapper's failing tests**

Create `full-kit/src/lib/msgraph/contacts.test.ts` with the header + mapper tests. (Later tasks will add more tests to this file; for now we keep it focused on the mapper.)

```ts
import { describe, expect, it } from "vitest";

import { mapGraphToContact } from "./contacts";

describe("mapGraphToContact", () => {
  it("returns partial with only fields present in the payload", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      mobilePhone: "(208) 555-1111",
    });

    expect(Object.keys(partial).sort()).toEqual(["phone"]);
    expect(partial.phone).toBe("(208) 555-1111");
  });

  it("uses displayName first when present", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      displayName: "Bob Smith",
      givenName: "Robert",
      surname: "Smith",
    });
    expect(partial.name).toBe("Bob Smith");
    expect(createOnly.name).toBe("Bob Smith");
  });

  it("falls back to givenName + surname when displayName missing", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      givenName: "Alice",
      surname: "Jones",
    });
    expect(partial.name).toBe("Alice Jones");
    expect(createOnly.name).toBe("Alice Jones");
  });

  it("falls back to emailAddresses[0].name when no name fields", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ name: "Carol Friendly", address: "carol@example.com" }],
    });
    expect(partial.name).toBe("Carol Friendly");
    expect(createOnly.name).toBe("Carol Friendly");
  });

  it("falls back to email address string when no name anywhere", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ name: "", address: "dave@example.com" }],
    });
    expect(partial.name).toBe("dave@example.com");
    expect(createOnly.name).toBe("dave@example.com");
  });

  it("uses the Graph ID as a last-resort name when nothing else is available", () => {
    const { createOnly } = mapGraphToContact({ id: "X-GRAPH-ID-123" });
    expect(createOnly.name).toBe("X-GRAPH-ID-123");
    // partial.name should NOT be set — Graph provided nothing to derive it from
  });

  it("partial.name is absent when Graph provided no name-related fields", () => {
    const { partial } = mapGraphToContact({ id: "X" });
    expect("name" in partial).toBe(false);
  });

  it("picks mobilePhone over businessPhones over homePhones", () => {
    expect(
      mapGraphToContact({
        id: "X",
        mobilePhone: "111",
        businessPhones: ["222"],
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("111");
    expect(
      mapGraphToContact({
        id: "X",
        businessPhones: ["222"],
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("222");
    expect(
      mapGraphToContact({
        id: "X",
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("333");
  });

  it("maps first email address and company", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ address: "bob@acme.com" }, { address: "bob.personal@gmail.com" }],
      companyName: "Acme Inc.",
    });
    expect(partial.email).toBe("bob@acme.com");
    expect(partial.company).toBe("Acme Inc.");
  });

  it("formats businessAddress, skipping empty parts", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      businessAddress: {
        street: "123 Main St",
        city: "Coeur d'Alene",
        state: "ID",
        postalCode: "83814",
        countryOrRegion: "",
      },
    });
    expect(partial.address).toBe("123 Main St, Coeur d'Alene, ID 83814");
  });

  it("passes categories through verbatim as tags", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      categories: ["Red Category", "Client"],
    });
    expect(partial.tags).toEqual(["Red Category", "Client"]);
  });

  it("createOnly always sets category=business, createdBy=msgraph-contacts, notes from personalNotes", () => {
    const { createOnly } = mapGraphToContact({
      id: "X",
      displayName: "Eve",
      personalNotes: "Met at CRE conference 2024",
    });
    expect(createOnly.category).toBe("business");
    expect(createOnly.createdBy).toBe("msgraph-contacts");
    expect(createOnly.notes).toBe("Met at CRE conference 2024");
  });

  it("createOnly.notes is null when personalNotes absent or empty", () => {
    expect(mapGraphToContact({ id: "X" }).createOnly.notes).toBeNull();
    expect(
      mapGraphToContact({ id: "X", personalNotes: "" }).createOnly.notes,
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all tests fail with "Cannot find module './contacts'".

- [ ] **Step 3: Implement the mapper**

Create `full-kit/src/lib/msgraph/contacts.ts` with just the mapper for now (the file will grow in later tasks):

```ts
// =============================================================================
// Graph contact payload shapes (narrow — only fields we consume)
// =============================================================================

export interface GraphContactAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryOrRegion?: string | null;
}

export interface GraphContactEmail {
  name?: string | null;
  address: string;
}

export interface GraphContact {
  id: string;
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  emailAddresses?: GraphContactEmail[];
  mobilePhone?: string | null;
  businessPhones?: string[];
  homePhones?: string[];
  companyName?: string | null;
  businessAddress?: GraphContactAddress;
  categories?: string[];
  personalNotes?: string | null;
  // The Graph API returns many more fields; they live verbatim
  // on ExternalSync.rawData.graphContact for future use. Not typed here.
}

/** Graph delta tombstone for a removed contact. */
export interface GraphContactRemoved {
  id: string;
  "@removed": { reason: string };
}

// =============================================================================
// Mapping types
// =============================================================================

export interface ContactPartialFields {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tags?: string[];
}

export interface ContactCreateOnlyFields {
  name: string;
  category: "business";
  createdBy: string;
  notes: string | null;
}

export interface MappedContact {
  partial: ContactPartialFields;
  createOnly: ContactCreateOnlyFields;
}

// =============================================================================
// Pure mapper
// =============================================================================

/**
 * Turn a Graph contact payload into a partial update-safe map PLUS a
 * createOnly block of defaults used on first insert.
 *
 * Graph's delta endpoint may return an updated contact as { id, ...changed }
 * — NOT a full resource. `partial` therefore only contains keys that Graph
 * actually provided; absent keys mean "don't touch" on update.
 */
export function mapGraphToContact(gc: GraphContact): MappedContact {
  const partial: ContactPartialFields = {};

  // name — set in partial only if Graph provided something that implies it
  const derivedName = deriveName(gc);
  if (derivedName !== undefined) {
    partial.name = derivedName;
  }

  if (Object.prototype.hasOwnProperty.call(gc, "companyName")) {
    partial.company = nullish(gc.companyName);
  }

  if (gc.emailAddresses !== undefined) {
    partial.email = gc.emailAddresses[0]?.address ?? null;
  }

  const phone = derivePhone(gc);
  if (phone !== undefined) {
    partial.phone = phone;
  }

  if (gc.businessAddress !== undefined) {
    partial.address = formatAddress(gc.businessAddress);
  }

  if (gc.categories !== undefined) {
    partial.tags = [...gc.categories];
  }

  const createOnly: ContactCreateOnlyFields = {
    name: derivedName ?? gc.id,
    category: "business",
    createdBy: "msgraph-contacts",
    notes: gc.personalNotes && gc.personalNotes.length > 0 ? gc.personalNotes : null,
  };

  return { partial, createOnly };
}

function deriveName(gc: GraphContact): string | undefined {
  if (gc.displayName) return gc.displayName;
  if (gc.givenName || gc.surname) {
    return [gc.givenName, gc.surname].filter(Boolean).join(" ");
  }
  const firstEmail = gc.emailAddresses?.[0];
  if (firstEmail?.name) return firstEmail.name;
  if (firstEmail?.address) return firstEmail.address;
  return undefined;
}

function derivePhone(gc: GraphContact): string | undefined {
  if (gc.mobilePhone !== undefined) {
    if (gc.mobilePhone) return gc.mobilePhone;
  }
  if (gc.businessPhones !== undefined) {
    if (gc.businessPhones[0]) return gc.businessPhones[0];
  }
  if (gc.homePhones !== undefined) {
    if (gc.homePhones[0]) return gc.homePhones[0];
  }
  // If none of the phone-related keys were present at all, return undefined
  // so the caller knows not to touch the phone column.
  if (
    gc.mobilePhone === undefined &&
    gc.businessPhones === undefined &&
    gc.homePhones === undefined
  ) {
    return undefined;
  }
  // Keys were present but all empty — explicit null to clear the column.
  return null as unknown as string; // typed as string|null intentionally; see ContactPartialFields
}

function formatAddress(addr: GraphContactAddress): string | null {
  const parts: string[] = [];
  if (addr.street) parts.push(addr.street);
  const cityStateZip = [
    addr.city,
    [addr.state, addr.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) parts.push(cityStateZip);
  if (addr.countryOrRegion) parts.push(addr.countryOrRegion);
  const formatted = parts.join(", ");
  return formatted.length > 0 ? formatted : null;
}

function nullish(v: string | null | undefined): string | null {
  return v === undefined || v === null || v === "" ? null : v;
}
```

- [ ] **Step 4: Adjust the `derivePhone` type to correctly allow null**

The `derivePhone` helper's return type is awkward. Simplify:

Replace `function derivePhone(gc: GraphContact): string | undefined { ... }` and the `partial.phone = phone;` block with:

```ts
function derivePhone(gc: GraphContact): string | null | "unset" {
  // "unset" marker = Graph provided no phone-related keys at all; leave DB column alone.
  if (
    gc.mobilePhone === undefined &&
    gc.businessPhones === undefined &&
    gc.homePhones === undefined
  ) {
    return "unset";
  }
  if (gc.mobilePhone) return gc.mobilePhone;
  if (gc.businessPhones && gc.businessPhones[0]) return gc.businessPhones[0];
  if (gc.homePhones && gc.homePhones[0]) return gc.homePhones[0];
  return null;
}
```

And update the caller block in `mapGraphToContact`:

```ts
  const phone = derivePhone(gc);
  if (phone !== "unset") {
    partial.phone = phone;
  }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all 14 mapper tests pass.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): mapGraphToContact partial-payload-aware mapper"
```

---

## Task 4: Cursor helpers + Prisma mock setup (TDD)

Implement `loadCursor`, `saveCursor`, `deleteCursor` against the existing `ExternalSync` table using the `"__cursor__"` external ID convention. This task also establishes the Prisma-mocking pattern that Tasks 5–8 reuse.

**Files:**
- Modify: `full-kit/src/lib/msgraph/contacts.test.ts`
- Modify: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Add the Prisma mock and cursor-helper tests**

At the top of `contacts.test.ts` (above the existing `describe("mapGraphToContact", ...)`), add:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Prisma mock shared across this test file ----
vi.mock("@/lib/prisma", () => {
  return {
    db: {
      externalSync: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      contact: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (arg) => {
        // Support both: interactive ($transaction(async (tx) => { ... })) and
        // array-based ($transaction([call1, call2])).
        if (typeof arg === "function") return await arg((await import("@/lib/prisma")).db);
        return await Promise.all(arg);
      }),
      $queryRaw: vi.fn(),
    },
  };
});

import { db } from "@/lib/prisma";
import {
  deleteCursor,
  loadCursor,
  mapGraphToContact,
  saveCursor,
} from "./contacts";

function clearDbMocks() {
  for (const svc of [db.externalSync, db.contact] as const) {
    for (const fn of Object.values(svc)) {
      if (typeof fn === "function" && "mockReset" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
  (db.$transaction as ReturnType<typeof vi.fn>).mockReset();
  (db.$queryRaw as ReturnType<typeof vi.fn>).mockReset();
  // Restore $transaction default behavior.
  (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return await (arg as (tx: typeof db) => Promise<unknown>)(db);
    }
    return await Promise.all(arg as Promise<unknown>[]);
  });
}
```

Then, below the existing `describe("mapGraphToContact", ...)` block, add:

```ts
describe("cursor helpers", () => {
  beforeEach(() => clearDbMocks());

  it("loadCursor returns null when no row exists", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await loadCursor();

    expect(result).toBeNull();
    expect(db.externalSync.findUnique).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
    });
  });

  it("loadCursor returns deltaLink when row has valid rawData", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=abc" },
    });

    const result = await loadCursor();

    expect(result).toEqual({
      deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=abc",
    });
  });

  it("loadCursor returns null when rawData is malformed (missing deltaLink)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: { notADeltaLink: "oops" },
    });

    const result = await loadCursor();

    expect(result).toBeNull();
  });

  it("loadCursor returns null when rawData is not an object", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: "corrupted-string",
    });

    const result = await loadCursor();
    expect(result).toBeNull();
  });

  it("saveCursor upserts the cursor row", async () => {
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await saveCursor("https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz");

    expect(db.externalSync.upsert).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
      create: {
        source: "msgraph-contacts",
        externalId: "__cursor__",
        entityType: "cursor",
        entityId: null,
        rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz" },
        status: "synced",
      },
      update: {
        rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz" },
        syncedAt: expect.any(Date),
        status: "synced",
      },
    });
  });

  it("deleteCursor removes the cursor row (no-op if missing)", async () => {
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await deleteCursor();

    expect(db.externalSync.delete).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
    });
  });

  it("deleteCursor swallows P2025 (record not found) from Prisma", async () => {
    const err = Object.assign(new Error("not found"), { code: "P2025" });
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    await expect(deleteCursor()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: cursor-helper tests fail because `loadCursor`, `saveCursor`, `deleteCursor` don't exist yet. Mapper tests still pass.

- [ ] **Step 3: Implement the cursor helpers**

Append to `full-kit/src/lib/msgraph/contacts.ts`:

```ts
import { db } from "@/lib/prisma";

// =============================================================================
// Cursor helpers — one special ExternalSync row with externalId="__cursor__"
// =============================================================================

const SOURCE = "msgraph-contacts";
const CURSOR_EXTERNAL_ID = "__cursor__";

export interface Cursor {
  deltaLink: string;
}

export async function loadCursor(): Promise<Cursor | null> {
  const row = await db.externalSync.findUnique({
    where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
  });
  if (!row) return null;
  const raw = row.rawData as unknown;
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    typeof (raw as Record<string, unknown>).deltaLink === "string"
  ) {
    return { deltaLink: (raw as Record<string, string>).deltaLink };
  }
  // Malformed rawData — force the caller into bootstrap mode.
  return null;
}

export async function saveCursor(deltaLink: string): Promise<void> {
  await db.externalSync.upsert({
    where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
    create: {
      source: SOURCE,
      externalId: CURSOR_EXTERNAL_ID,
      entityType: "cursor",
      entityId: null,
      rawData: { deltaLink },
      status: "synced",
    },
    update: {
      rawData: { deltaLink },
      syncedAt: new Date(),
      status: "synced",
    },
  });
}

export async function deleteCursor(): Promise<void> {
  try {
    await db.externalSync.delete({
      where: { source_externalId: { source: SOURCE, externalId: CURSOR_EXTERNAL_ID } },
    });
  } catch (err) {
    // P2025 = "an operation failed because it depends on one or more records that were required but not found"
    if ((err as { code?: string })?.code !== "P2025") throw err;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: mapper tests + all cursor-helper tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): cursor helpers (load/save/delete) with malformed-data resilience"
```

---

## Task 5: `upsertContact` with transaction (TDD)

Create-or-update a Contact from a Graph payload, inside a Prisma `$transaction` so the Contact row and its matching ExternalSync row always commit together. Handles the four shape-shifted outcomes: `"created"`, `"updated"`, `"unarchived"` (Graph-origin archive cleared), and preserves manual-archive state.

**Files:**
- Modify: `full-kit/src/lib/msgraph/contacts.test.ts`
- Modify: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Add `upsertContact` tests**

Append a new `describe` block to `contacts.test.ts`:

```ts
describe("upsertContact", () => {
  beforeEach(() => clearDbMocks());

  const sampleGraphContact = {
    id: "graph-bob-1",
    displayName: "Bob Smith",
    emailAddresses: [{ address: "bob@acme.com" }],
    mobilePhone: "(208) 555-1111",
    companyName: "Acme Inc.",
    personalNotes: "Met at CRE conference",
  };

  it("creates a new Contact and ExternalSync in a transaction when no existing row", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-uuid",
    });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact(sampleGraphContact);

    expect(result).toBe("created");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Bob Smith",
        email: "bob@acme.com",
        phone: "(208) 555-1111",
        company: "Acme Inc.",
        notes: "Met at CRE conference",
        category: "business",
        createdBy: "msgraph-contacts",
      }),
    });
    expect(db.externalSync.create).toHaveBeenCalledWith({
      data: {
        source: "msgraph-contacts",
        externalId: "graph-bob-1",
        entityType: "contact",
        entityId: "new-uuid",
        status: "synced",
        rawData: { graphContact: sampleGraphContact },
      },
    });
  });

  it("updates existing Contact when ExternalSync already maps the Graph id; only sets fields present in payload", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: null,
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const partialPayload = {
      id: "graph-bob-1",
      mobilePhone: "(208) 555-2222",
    };

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact(partialPayload);

    expect(result).toBe("updated");

    // Only `phone` should change; email/company/name/etc must NOT appear in the update.
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toEqual({
      where: { id: "existing-contact-uuid" },
      data: { phone: "(208) 555-2222" },
    });
  });

  it("unarchives a Graph-archived contact on a later update (status='removed' → 'synced', archivedAt cleared)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "removed",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: new Date("2026-04-20"),
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact({ id: "graph-bob-1", displayName: "Bob (Returned)" });

    expect(result).toBe("unarchived");
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.data.archivedAt).toBeNull();
    expect(updateCall.data.name).toBe("Bob (Returned)");

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.data.status).toBe("synced");
  });

  it("preserves manual-archive when status='synced' but archivedAt was set by another path", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced", // NOT "removed"
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: new Date("2026-04-20"), // set by some manual-archive flow
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact({ id: "graph-bob-1", mobilePhone: "999" });

    expect(result).toBe("updated");
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Phone should update, archivedAt should NOT be in the data object.
    expect(updateCall.data.phone).toBe("999");
    expect("archivedAt" in updateCall.data).toBe(false);
  });

  it("fails loud when ExternalSync points to a Contact that no longer exists", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "orphan-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { upsertContact } = await import("./contacts");
    await expect(upsertContact({ id: "graph-bob-1" })).rejects.toThrow(
      /missing Contact row/i,
    );
  });

  it("persists full Graph payload verbatim to ExternalSync.rawData.graphContact on create", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-uuid",
    });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const richPayload = {
      ...sampleGraphContact,
      jobTitle: "Senior Broker",
      department: "Sales",
      businessHomePage: "example.com",
      homeAddress: { street: "home" },
    };

    const { upsertContact } = await import("./contacts");
    await upsertContact(richPayload);

    const extSyncCreate = (db.externalSync.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncCreate.data.rawData).toEqual({ graphContact: richPayload });
  });

  it("persists full Graph payload on update as well", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: null,
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const payload = { id: "graph-bob-1", mobilePhone: "999" };
    const { upsertContact } = await import("./contacts");
    await upsertContact(payload);

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.data.rawData).toEqual({ graphContact: payload });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: `upsertContact` tests fail because the function doesn't exist yet.

- [ ] **Step 3: Implement `upsertContact`**

Append to `full-kit/src/lib/msgraph/contacts.ts`:

```ts
// =============================================================================
// Per-item operations
// =============================================================================

export type UpsertOutcome = "created" | "updated" | "unarchived";

export async function upsertContact(graphContact: GraphContact): Promise<UpsertOutcome> {
  const { partial, createOnly } = mapGraphToContact(graphContact);

  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: SOURCE, externalId: graphContact.id },
    },
  });

  if (!existing) {
    // CREATE path — Contact + ExternalSync in one transaction
    const createData = {
      ...createOnly,
      ...partial,
    };
    const outcome = await db.$transaction(async (tx) => {
      const contact = await tx.contact.create({ data: createData });
      await tx.externalSync.create({
        data: {
          source: SOURCE,
          externalId: graphContact.id,
          entityType: "contact",
          entityId: contact.id,
          status: "synced",
          rawData: { graphContact },
        },
      });
      return "created" as const;
    });
    return outcome;
  }

  // UPDATE path
  const contact = await db.contact.findUnique({ where: { id: existing.entityId! } });
  if (!contact) {
    throw new Error(
      `ExternalSync for Graph contact ${graphContact.id} points to missing Contact row ${existing.entityId}. Refusing to guess — manual DB repair needed.`,
    );
  }

  // Only clear archivedAt if the ExternalSync.status was "removed" (Graph-origin archive).
  // A manual archive (status="synced" but archivedAt set) is preserved.
  const graphOriginArchive = existing.status === "removed";
  const shouldUnarchive = graphOriginArchive;

  const updateData: Record<string, unknown> = { ...partial };
  if (shouldUnarchive) {
    updateData.archivedAt = null;
  }

  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contact.id },
      data: updateData,
    });
    await tx.externalSync.update({
      where: { id: existing.id },
      data: {
        status: "synced",
        syncedAt: new Date(),
        rawData: { graphContact },
      },
    });
  });

  return shouldUnarchive ? "unarchived" : "updated";
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all `upsertContact` tests pass along with the prior mapper and cursor tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): upsertContact with transaction, partial-payload update, and manual-archive preservation"
```

---

## Task 6: `archiveContact` with replay no-op (TDD)

Handle Graph's `@removed` tombstones. Distinguish three cases: unknown Graph ID (no-op), already removed (replay — no-op), or live contact (soft-delete + mark status="removed").

**Files:**
- Modify: `full-kit/src/lib/msgraph/contacts.test.ts`
- Modify: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Add `archiveContact` tests**

Append to `contacts.test.ts`:

```ts
describe("archiveContact", () => {
  beforeEach(() => clearDbMocks());

  it("returns false when Graph id is not tracked (never seen before)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("unknown-graph-id");

    expect(result).toBe(false);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns false when ExternalSync.status is already 'removed' (replayed tombstone)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "contact-uuid",
      status: "removed",
    });

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("graph-bob-1");

    expect(result).toBe(false);
    expect(db.contact.update).not.toHaveBeenCalled();
    expect(db.externalSync.update).not.toHaveBeenCalled();
  });

  it("archives live contact transactionally — sets archivedAt and status='removed'", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "contact-uuid",
      status: "synced",
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("graph-bob-1");

    expect(result).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    const contactUpdate = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(contactUpdate.where).toEqual({ id: "contact-uuid" });
    expect(contactUpdate.data.archivedAt).toBeInstanceOf(Date);

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.where).toEqual({ id: "ext-sync-uuid" });
    expect(extSyncUpdate.data.status).toBe("removed");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: `archiveContact` tests fail — function doesn't exist.

- [ ] **Step 3: Implement `archiveContact`**

Append to `full-kit/src/lib/msgraph/contacts.ts`:

```ts
export async function archiveContact(graphId: string): Promise<boolean> {
  const existing = await db.externalSync.findUnique({
    where: { source_externalId: { source: SOURCE, externalId: graphId } },
  });
  if (!existing) return false;                  // never knew about it
  if (existing.status === "removed") return false; // replayed tombstone — no-op

  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: existing.entityId! },
      data: { archivedAt: new Date() },
    });
    await tx.externalSync.update({
      where: { id: existing.id },
      data: { status: "removed", syncedAt: new Date() },
    });
  });
  return true;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all `archiveContact` tests pass along with the prior suite.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): archiveContact with replay no-op and transactional soft-delete"
```

---

## Task 7: `processOneItemWithRetry` — 3-attempt retry + failure bookkeeping (TDD)

Wraps `upsertContact` and `archiveContact` with a 3-attempt retry (50 ms, 200 ms, 800 ms backoff). On final failure, records the error and sets `ExternalSync.status = "failed"` (best-effort). Detects `@removed` tombstones to dispatch the right op.

**Files:**
- Modify: `full-kit/src/lib/msgraph/contacts.test.ts`
- Modify: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Add `processOneItemWithRetry` tests**

Append to `contacts.test.ts`:

```ts
describe("processOneItemWithRetry", () => {
  beforeEach(() => {
    clearDbMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches @removed entries to archiveContact", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { processOneItemWithRetry } = await import("./contacts");
    const result = await processOneItemWithRetry({
      id: "graph-x",
      "@removed": { reason: "deleted" },
    });

    expect(result.kind).toBe("archiveNoop"); // archiveContact returned false
  });

  it("dispatches live entries to upsertContact", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-uuid" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const result = await processOneItemWithRetry({
      id: "graph-bob",
      displayName: "Bob",
    });

    expect(result.kind).toBe("created");
  });

  it("retries on transient failure and succeeds on second attempt", async () => {
    let callCount = 0;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("transient db error");
      return null;
    });
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-uuid" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const promise = processOneItemWithRetry({ id: "graph-bob", displayName: "Bob" });

    await vi.advanceTimersByTimeAsync(100); // past 50ms backoff
    const result = await promise;

    expect(result.kind).toBe("created");
    expect(callCount).toBe(2);
  });

  it("returns 'failed' with attempts=3 and records error when all 3 attempts fail", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("persistent db error"),
    );
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const promise = processOneItemWithRetry({ id: "graph-bob", displayName: "Bob" });

    await vi.advanceTimersByTimeAsync(50 + 200 + 800 + 100); // all three backoffs + buffer
    const result = await promise;

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.error.graphId).toBe("graph-bob");
      expect(result.error.attempts).toBe(3);
      expect(result.error.message).toMatch(/persistent db error/);
    }

    // Should have attempted to mark ExternalSync.status = "failed"
    expect(db.externalSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source_externalId: { source: "msgraph-contacts", externalId: "graph-bob" },
        },
        update: expect.objectContaining({ status: "failed" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: `processOneItemWithRetry` tests fail — function doesn't exist.

- [ ] **Step 3: Implement `processOneItemWithRetry`**

Append to `full-kit/src/lib/msgraph/contacts.ts`:

```ts
export interface ItemError {
  graphId: string;
  message: string;
  attempts: number;
}

export type ProcessOutcome =
  | { kind: "created" | "updated" | "unarchived" }
  | { kind: "archived" | "archiveNoop" }
  | { kind: "failed"; error: ItemError };

const RETRY_BACKOFFS_MS = [50, 200, 800];

export async function processOneItemWithRetry(
  entry: GraphContact | GraphContactRemoved,
): Promise<ProcessOutcome> {
  const isRemoved = "@removed" in entry;
  const graphId = entry.id;
  let lastErr: unknown;

  for (let attempt = 0; attempt < RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      if (isRemoved) {
        const archived = await archiveContact(graphId);
        return { kind: archived ? "archived" : "archiveNoop" };
      }
      const outcome = await upsertContact(entry as GraphContact);
      return { kind: outcome };
    } catch (err) {
      lastErr = err;
      const isFinalAttempt = attempt === RETRY_BACKOFFS_MS.length - 1;
      if (!isFinalAttempt) {
        await sleep(RETRY_BACKOFFS_MS[attempt]);
      }
    }
  }

  // All attempts failed. Best-effort: mark ExternalSync.status = "failed".
  try {
    await db.externalSync.upsert({
      where: { source_externalId: { source: SOURCE, externalId: graphId } },
      create: {
        source: SOURCE,
        externalId: graphId,
        entityType: "contact",
        entityId: null, // no Contact was created
        status: "failed",
        rawData: { lastError: String(lastErr) },
      },
      update: {
        status: "failed",
        syncedAt: new Date(),
        rawData: { lastError: String(lastErr) },
      },
    });
  } catch {
    // Best-effort — if even this fails, the caller already has the error in summary.
  }

  return {
    kind: "failed",
    error: {
      graphId,
      message: lastErr instanceof Error ? lastErr.message : String(lastErr),
      attempts: RETRY_BACKOFFS_MS.length,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all `processOneItemWithRetry` tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): processOneItemWithRetry — 3-attempt backoff + failure bookkeeping"
```

---

## Task 8: `syncMicrosoftContacts` main orchestrator (TDD)

Full orchestrator: advisory lock → load cursor → page through Graph delta → process each item with retry → save cursor only if all items succeeded. Handles 410 delta-expired by restarting as bootstrap.

**Files:**
- Modify: `full-kit/src/lib/msgraph/contacts.test.ts`
- Modify: `full-kit/src/lib/msgraph/contacts.ts`

- [ ] **Step 1: Add orchestrator tests**

Append to `contacts.test.ts`:

```ts
describe("syncMicrosoftContacts (orchestrator)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearDbMocks();
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(global, "fetch");
    // Default: advisory lock is acquired.
    (db.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("pg_try_advisory_lock")) return [{ got: true }];
      if (sql.includes("pg_advisory_unlock")) return [{ released: true }];
      return [];
    });
    // Stub token fetch for any graphFetch call path.
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.MSGRAPH_TARGET_UPN = "matt@example.com";
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = "x".repeat(32);
  });
  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  function tokenResponse() {
    return new Response(
      JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "Bearer" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  function deltaResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns skippedLocked when advisory lock not acquired", async () => {
    (db.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("pg_try_advisory_lock")) return [{ got: false }];
      return [];
    });

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.skippedLocked).toBe(true);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("bootstrap: no cursor → fetches delta from scratch → writes cursor on success", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }) => {
      if (where.source_externalId.externalId === "__cursor__") return null;
      return null;
    });
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-1", displayName: "Alice" }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=NEW",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(true);
    expect(result.bootstrapReason).toBe("no-cursor");
    expect(result.created).toBe(1);
    expect(result.cursorAdvanced).toBe(true);
    // saveCursor via upsert
    expect(db.externalSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
      }),
    );
  });

  it("delta-empty: cursor present, value=[], cursor still advances to new deltaLink", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        return {
          rawData: {
            deltaLink: "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=OLD",
          },
        };
      }
      return null;
    });
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        deltaResponse({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=NEW",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(false);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.cursorAdvanced).toBe(true);
  });

  it("pagination: follows @odata.nextLink; cursor only written after final @odata.deltaLink", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-1", displayName: "Alice" }],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$skiptoken=PAGE2",
        }),
      )
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-2", displayName: "Bob" }],
          "@odata.deltaLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=FINAL",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.created).toBe(2);
    expect(result.cursorAdvanced).toBe(true);
    // Cursor upsert should have been called exactly ONCE (at the end), not after page 1.
    const cursorUpserts = (db.externalSync.upsert as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].where.source_externalId.externalId === "__cursor__",
    );
    expect(cursorUpserts.length).toBe(1);
  });

  it("410 syncStateNotFound: deletes cursor, restarts as bootstrap, reports bootstrapReason=delta-expired", async () => {
    // First call: findUnique returns the stored cursor.
    // After 410 + deleteCursor, recursive call returns null (cursor gone).
    let findUniqueCount = 0;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        findUniqueCount++;
        if (findUniqueCount === 1) {
          return {
            rawData: {
              deltaLink: "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=OLD",
            },
          };
        }
        return null;
      }
      return null;
    });
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "syncStateNotFound", message: "expired" } }),
          { status: 410, headers: { "Content-Type": "application/json" } },
        ),
      )
      // After recursion, second run starts fresh
      .mockResolvedValueOnce(
        deltaResponse({
          value: [],
          "@odata.deltaLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=FRESH",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(true);
    expect(result.bootstrapReason).toBe("delta-expired");
    expect(db.externalSync.delete).toHaveBeenCalled();
  });

  it("persistent per-item failure: cursorAdvanced=false, errors[] populated", async () => {
    // First findUnique for cursor → null (bootstrap).
    // Then per-item findUnique (for upsertContact) always throws.
    let cursorChecked = false;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        cursorChecked = true;
        return null;
      }
      throw new Error("persistent db error");
    });
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-bad", displayName: "Bad" }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=END",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const promise = syncMicrosoftContacts();
    await vi.advanceTimersByTimeAsync(50 + 200 + 800 + 100);
    const result = await promise;

    expect(cursorChecked).toBe(true);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].graphId).toBe("g-bad");
    expect(result.cursorAdvanced).toBe(false);
    // Cursor upsert for "__cursor__" key should NOT have been called
    const cursorUpserts = (db.externalSync.upsert as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].where.source_externalId.externalId === "__cursor__",
    );
    expect(cursorUpserts.length).toBe(0);
  });

  it("sends Prefer: IdType=ImmutableId header on the delta request", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    fetchSpy
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        deltaResponse({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=END",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    await syncMicrosoftContacts();

    const deltaCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/contacts/delta"),
    );
    expect(deltaCall).toBeDefined();
    const headers = (deltaCall![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Prefer).toBe('IdType="ImmutableId"');
  });

  it("releases advisory lock even on error (finally block)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );

    fetchSpy.mockResolvedValueOnce(tokenResponse());

    const { syncMicrosoftContacts } = await import("./contacts");
    await expect(syncMicrosoftContacts()).rejects.toThrow();

    const unlockCalls = (db.$queryRaw as ReturnType<typeof vi.fn>).mock.calls.filter((c) => {
      const sql = (c[0] as TemplateStringsArray).join("");
      return sql.includes("pg_advisory_unlock");
    });
    expect(unlockCalls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: orchestrator tests fail — function doesn't exist yet.

- [ ] **Step 3: Implement `syncMicrosoftContacts`**

Append to `full-kit/src/lib/msgraph/contacts.ts`:

```ts
import { graphFetch, GraphError } from "./client";
import { loadMsgraphConfig } from "./config";

// =============================================================================
// Main orchestrator
// =============================================================================

export interface SyncResult {
  isBootstrap: boolean;
  bootstrapReason?: "no-cursor" | "delta-expired";
  skippedLocked: boolean;
  created: number;
  updated: number;
  archived: number;
  unarchived: number;
  errors: ItemError[];
  cursorAdvanced: boolean;
  durationMs: number;
}

interface ContactsDeltaResponse {
  value: (GraphContact | GraphContactRemoved)[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

const LOCK_KEY_LABEL = "msgraph-contacts";

export async function syncMicrosoftContacts(
  internalBootstrapReason?: "delta-expired",
): Promise<SyncResult> {
  const t0 = Date.now();
  const emptyResult = (partial: Partial<SyncResult>): SyncResult => ({
    isBootstrap: false,
    skippedLocked: false,
    created: 0,
    updated: 0,
    archived: 0,
    unarchived: 0,
    errors: [],
    cursorAdvanced: false,
    durationMs: Date.now() - t0,
    ...partial,
  });

  // ---- Advisory lock (per-connection) ----
  const lockRows = (await db.$queryRaw`SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY_LABEL})) AS got`) as {
    got: boolean;
  }[];
  if (!lockRows[0]?.got) {
    return emptyResult({ skippedLocked: true });
  }

  try {
    const cfg = loadMsgraphConfig();
    const cursor = await loadCursor();
    const isBootstrap = cursor === null;
    const startUrl =
      cursor?.deltaLink ??
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.targetUpn)}/contacts/delta`;

    let url: string | null = startUrl;
    let finalDeltaLink: string | null = null;
    const summary = {
      created: 0,
      updated: 0,
      archived: 0,
      unarchived: 0,
      errors: [] as ItemError[],
    };

    while (url !== null) {
      let response: ContactsDeltaResponse;
      try {
        response = await graphFetch<ContactsDeltaResponse>(url, {
          headers: { Prefer: 'IdType="ImmutableId"' },
        });
      } catch (err) {
        if (
          err instanceof GraphError &&
          err.status === 410 &&
          (err.code?.toLowerCase().includes("syncstate") ?? false)
        ) {
          await deleteCursor();
          // Recurse as fresh bootstrap
          const retry = await syncMicrosoftContacts("delta-expired");
          return { ...retry, durationMs: Date.now() - t0 };
        }
        throw err;
      }

      for (const entry of response.value) {
        const outcome = await processOneItemWithRetry(entry);
        switch (outcome.kind) {
          case "created":
            summary.created++;
            break;
          case "updated":
            summary.updated++;
            break;
          case "unarchived":
            summary.unarchived++;
            break;
          case "archived":
            summary.archived++;
            break;
          case "archiveNoop":
            // no counter; tombstone for unknown or already-removed contact
            break;
          case "failed":
            summary.errors.push(outcome.error);
            break;
        }
      }

      url = response["@odata.nextLink"] ?? null;
      if (response["@odata.deltaLink"]) {
        finalDeltaLink = response["@odata.deltaLink"];
      }
    }

    let cursorAdvanced = false;
    if (summary.errors.length === 0 && finalDeltaLink) {
      await saveCursor(finalDeltaLink);
      cursorAdvanced = true;
    }

    return {
      isBootstrap,
      bootstrapReason: internalBootstrapReason ?? (isBootstrap ? "no-cursor" : undefined),
      skippedLocked: false,
      created: summary.created,
      updated: summary.updated,
      archived: summary.archived,
      unarchived: summary.unarchived,
      errors: summary.errors,
      cursorAdvanced,
      durationMs: Date.now() - t0,
    };
  } finally {
    await db.$queryRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY_LABEL}))`;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test src/lib/msgraph/contacts.test.ts
```

Expected: all 8 orchestrator tests pass along with every prior test in the file.

- [ ] **Step 5: Run the full project test suite**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test
```

Expected: all tests pass. Previous msgraph suite (~37) + client additions (+4) + contacts (~30) = ~71+ tests.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/contacts.ts full-kit/src/lib/msgraph/contacts.test.ts
git commit -m "feat(contacts): syncMicrosoftContacts main orchestrator with advisory lock and conditional cursor advance"
```

---

## Task 9: Barrel export + file-size check

Expose the public API through `@/lib/msgraph`, and verify the `contacts.ts` file hasn't blown past the 300-line guardrail from the spec.

**Files:**
- Modify: `full-kit/src/lib/msgraph/index.ts`

- [ ] **Step 1: Update the barrel**

Open `full-kit/src/lib/msgraph/index.ts`. Add these exports at the end of the file (keeping existing exports intact):

```ts
export { syncMicrosoftContacts } from "./contacts";
export type { SyncResult } from "./contacts";
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm exec tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run full test suite**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test
```

Expected: all tests still pass.

- [ ] **Step 4: Check `contacts.ts` file size**

Run:

```bash
wc -l "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit/src/lib/msgraph/contacts.ts"
```

Expected: under ~330 lines. If above 300 but below 330, acceptable — the spec's guardrail was a soft target. If substantially over (e.g. 400+), note it as a concern in the commit message but do NOT split files in this task; file a follow-up.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/index.ts
git commit -m "feat(msgraph): export syncMicrosoftContacts + SyncResult from barrel"
```

---

## Task 10: Gated POST sync endpoint

Dev-only route that lets you trigger the sync manually from curl or the browser. Matches the defense-in-depth pattern of `/api/integrations/msgraph/test` (kill switch → method check → auth header → handler).

**Files:**
- Create: `full-kit/src/app/api/integrations/msgraph/contacts/sync/route.ts`

- [ ] **Step 1: Create the route**

Create the nested directory structure if needed (the tool will do this automatically). Write the file:

```ts
import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  GraphError,
  loadMsgraphConfig,
  syncMicrosoftContacts,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic"; // never cache

export async function POST(request: Request): Promise<Response> {
  // 1. Kill switch — 404 if feature flag not explicitly "true" OR config fails to load.
  let config;
  try {
    config = loadMsgraphConfig();
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Auth — constant-time compare of x-admin-token.
  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 3. Handler.
  try {
    const result = await syncMicrosoftContacts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof GraphError) {
      return NextResponse.json(
        {
          ok: false,
          status: err.status,
          code: err.code,
          path: err.path,
          message: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "unexpected", message: String(err) },
      { status: 500 },
    );
  }
}

// Reject other methods explicitly (Next.js App Router otherwise returns 405 default, but we make it explicit for clarity).
export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 });
}
```

- [ ] **Step 2: Verify no regressions**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Type-check the app**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm exec tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/app/api/integrations/msgraph/contacts/sync/route.ts
git commit -m "feat(msgraph): gated POST /api/integrations/msgraph/contacts/sync endpoint"
```

---

## Task 11: Manual end-to-end verification against live Graph

This task is executed at the terminal — no code, no commits. Mirrors the verification pattern used for the MS Graph connection slice.

- [ ] **Step 1: Start the dev server in the background**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm dev
```

Wait ~5 seconds for Next.js to be ready.

- [ ] **Step 2: 401 without admin token**

```bash
curl -i -X POST http://localhost:3000/api/integrations/msgraph/contacts/sync
```

Expected: `HTTP/1.1 401 Unauthorized`, body `{"ok":false,"error":"unauthorized"}`.

- [ ] **Step 3: 405 on GET**

```bash
curl -i http://localhost:3000/api/integrations/msgraph/contacts/sync
```

Expected: `HTTP/1.1 405 Method Not Allowed`.

- [ ] **Step 4: First run (bootstrap)**

With the admin token in your local shell env or pasted inline:

```bash
curl -i -X POST \
  -H "x-admin-token: $(grep '^MSGRAPH_TEST_ADMIN_TOKEN=' full-kit/.env.local | cut -d= -f2- | tr -d '\"')" \
  http://localhost:3000/api/integrations/msgraph/contacts/sync
```

Expected: `HTTP/1.1 200 OK`, JSON body with:
- `ok: true`
- `isBootstrap: true`
- `bootstrapReason: "no-cursor"`
- `skippedLocked: false`
- `created: ~2302` (actual count may vary slightly)
- `cursorAdvanced: true`
- `errors: []`
- `durationMs` ≈ 60,000–90,000 ms

Verify in the database:

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build/full-kit" && pnpm prisma studio
# In browser: contacts table should have ~2302 rows; external_sync should have ~2303 rows (contacts + 1 cursor)
```

- [ ] **Step 5: Second run (delta empty)**

Immediately re-run Step 4's curl. Expected:
- `isBootstrap: false`
- `created: 0, updated: 0, archived: 0`
- `cursorAdvanced: true`
- `durationMs < 3000`

- [ ] **Step 6: Concurrent run — skippedLocked**

In two terminals, fire the same curl simultaneously:

```bash
# Terminal A
curl -X POST -H "x-admin-token: ..." http://localhost:3000/api/integrations/msgraph/contacts/sync &
# Terminal B (a moment later or parallel)
curl -X POST -H "x-admin-token: ..." http://localhost:3000/api/integrations/msgraph/contacts/sync &
wait
```

Expected: one response has `created/updated/...` counts; the other has `skippedLocked: true`.

- [ ] **Step 7: Add a contact in Outlook → run**

In Outlook Web or the Outlook desktop app, create a new test contact (e.g. "Test Contact, test@example.com"). Run sync. Expected: `created: 1` or `updated: 1` (depends on whether the contact is brand-new).

- [ ] **Step 8: Delete that contact in Outlook → run**

Delete the test contact from Outlook. Run sync. Expected: `archived: 1`. Verify in Prisma Studio that:
- The `Contact.archivedAt` is set.
- The matching `ExternalSync.status` is `"removed"`.
- The Contact row itself is NOT deleted.

- [ ] **Step 9: Re-add the contact in Outlook → run**

Restore the contact (from the Deleted Items folder) or recreate it. Run sync. Expected: `unarchived: 1`. Verify `Contact.archivedAt` is `null`, `ExternalSync.status` is `"synced"`.

- [ ] **Step 10: Manual-archive guard**

In Prisma Studio (or a direct SQL UPDATE), pick a contact whose `ExternalSync.status` is `"synced"` and set its `Contact.archivedAt` to a timestamp. Edit that same contact in Outlook (change the phone number). Run sync. Expected:
- `updated: 1`
- Phone is updated in DB.
- `Contact.archivedAt` is STILL set (manual archive preserved).

- [ ] **Step 11: Stop the dev server**

Ctrl+C the `pnpm dev` process, or find the PID and kill it:

```bash
lsof -ti:3000 | xargs kill
```

- [ ] **Step 12: Clean up the Outlook test contact**

Delete the test contact you created for steps 7–10 (optional but tidy).

No commit for this task — it's verification-only. If any step fails, report the failure with the full response body and any relevant log output. Do not try to patch the implementation without first reporting.

---

## Spec coverage check

Walking back through `docs/superpowers/specs/2026-04-22-contact-sync-design.md` to confirm every section has an implementation task:

| Spec section | Covered by |
|---|---|
| `graphFetch` absolute URL support | Task 1 |
| `graphFetch` custom headers option | Task 2 |
| Field mapping (all fallbacks, partial payload) | Task 3 |
| `ExternalSync` cursor (load / save / delete) | Task 4 |
| `upsertContact` with transaction | Task 5 |
| Manual-archive preservation | Task 5 (test case) |
| Fail-loud on missing Contact for existing ExternalSync | Task 5 (test case) |
| Raw payload retention in `ExternalSync.rawData.graphContact` | Task 5 (test cases 6–7) |
| `archiveContact` with replay no-op | Task 6 |
| 3-attempt retry with backoff | Task 7 |
| `ExternalSync.status = "failed"` on permanent failure | Task 7 |
| Postgres advisory lock | Task 8 |
| Delta pagination via absolute `@odata.nextLink` | Task 8 (test case) |
| 410 `syncStateNotFound` recovery | Task 8 (test case) |
| Conditional cursor advance (no advance on failure) | Task 8 (test case) |
| `Prefer: IdType="ImmutableId"` header on delta calls | Task 8 (test case) |
| Barrel exports | Task 9 |
| Gated POST endpoint with kill switch + 401 + 405 | Task 10 |
| Live Graph verification | Task 11 |

All covered.

---

## Placeholder / type-consistency check

- No "TBD", "TODO", "FIXME", "implement later" in the plan text (verified by search).
- `GraphContact`, `GraphContactRemoved`, `MappedContact`, `ContactPartialFields`, `ContactCreateOnlyFields` are defined in Task 3 and used consistently through Tasks 5–8.
- `UpsertOutcome`, `ProcessOutcome`, `ItemError`, `SyncResult` are defined and used consistently.
- Prisma client is always imported as `{ db }` from `@/lib/prisma` — no mismatched names.
- `SOURCE` constant = `"msgraph-contacts"` is defined in Task 4 and reused in later tasks (no drift).
- `CURSOR_EXTERNAL_ID` = `"__cursor__"` defined in Task 4, reused in Task 4's tests and implicitly in later tests via the same `where` clause shape.
