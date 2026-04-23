# Email Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Matt Robertson's last 90 days of inbound and outbound Outlook email into `Communication`, applying a three-layer filter (auto-signal allowlist / hard-drop noise / uncertain-for-later) with platform-specific extractors that auto-create `Contact` rows for Crexi/LoopNet/Buildout lead inquirers.

**Architecture:** Mirrors the contact-sync pattern (advisory lock + per-folder delta cursor in `ExternalSync` + idempotent transactional upsert). Pure filter and extractor functions isolated from Graph and DB for testability. Body stored for signal/uncertain rows, omitted for noise. Attachment metadata fetched in a separate throttled Graph call for signal rows only.

**Tech Stack:** Next.js 15 App Router, Prisma 5 on Postgres (Supabase), TypeScript, Vitest, Microsoft Graph v1.0.

**Spec:** [docs/superpowers/specs/2026-04-23-email-ingestion-design.md](../specs/2026-04-23-email-ingestion-design.md)

---

## File structure

| Path | Responsibility | Status |
|---|---|---|
| `full-kit/prisma/schema.prisma` | Add `LeadSource` + `LeadStatus` enums; add `leadSource`/`leadStatus`/`leadAt` to `Contact` | MODIFY |
| `full-kit/src/lib/msgraph/sender-normalize.ts` | X.500 Exchange DN → SMTP normalizer; pure | NEW |
| `full-kit/src/lib/msgraph/sender-normalize.test.ts` | Unit tests for normalizer | NEW |
| `full-kit/src/lib/msgraph/email-types.ts` | Shared types: `GraphEmailMessage`, `EmailClassification`, `EmailSource`, etc. | NEW |
| `full-kit/src/lib/msgraph/email-filter.ts` | Pure Layer A/B/C filter; `classifyEmail()` + helper predicates; noise domain/sender constants | NEW |
| `full-kit/src/lib/msgraph/email-filter.test.ts` | Unit tests for every rule in both layers | NEW |
| `full-kit/src/lib/msgraph/email-extractors.ts` | `extractCrexiLead` / `extractLoopNetLead` / `extractBuildoutEvent`; pure | NEW |
| `full-kit/src/lib/msgraph/email-extractors.test.ts` | Unit tests with real sample subjects + body snippets | NEW |
| `full-kit/src/lib/msgraph/emails.ts` | Orchestrator — advisory lock, per-folder delta loop, `syncEmails()` export | NEW |
| `full-kit/src/lib/msgraph/emails.test.ts` | End-to-end `syncEmails()` with mocked fetch + Prisma | NEW |
| `full-kit/src/lib/msgraph/index.ts` | Barrel — export `syncEmails`, `SyncEmailResult`, normalize helpers | MODIFY |
| `full-kit/src/app/api/integrations/msgraph/emails/sync/route.ts` | Gated POST dev trigger | NEW |

---

## Task 1: Schema migration — add Lead fields to Contact

**Files:**
- Modify: `full-kit/prisma/schema.prisma`
- Create: `full-kit/prisma/migrations/<generated_timestamp>_add_contact_lead_fields/migration.sql`

- [ ] **Step 1: Add enums and columns to schema**

Open `full-kit/prisma/schema.prisma`. Add the two new enums immediately after the existing `SyncStatus` enum:

```prisma
enum LeadSource {
  crexi
  loopnet
  buildout
  email_cold
  referral
}

enum LeadStatus {
  new
  vetted
  contacted
  converted
  dropped
}
```

In the `Contact` model, add the three new fields immediately after the `archivedAt` line:

```prisma
  leadSource       LeadSource?  @map("lead_source")
  leadStatus       LeadStatus?  @map("lead_status")
  leadAt           DateTime?    @map("lead_at")
```

And add the index at the bottom of the `Contact` model, before the closing `}` and `@@map`:

```prisma
  @@index([leadSource])
```

- [ ] **Step 2: Generate migration**

Run: `cd full-kit && pnpm exec prisma migrate dev --name add_contact_lead_fields`
Expected: Prisma produces a SQL migration file and applies it. Output contains `Applied migration` and updated Prisma Client generated.

- [ ] **Step 3: Verify migration SQL sanity**

Open the generated migration file at `full-kit/prisma/migrations/<timestamp>_add_contact_lead_fields/migration.sql`. Confirm it contains:
- `CREATE TYPE "LeadSource" AS ENUM (...)`
- `CREATE TYPE "LeadStatus" AS ENUM (...)`
- `ALTER TABLE "contacts" ADD COLUMN "lead_source" "LeadSource"`, plus `lead_status`, `lead_at`
- `CREATE INDEX "contacts_lead_source_idx" ON "contacts"("lead_source")`

No data backfill needed — all new rows start with null lead fields and existing rows stay null until an extractor sets them.

- [ ] **Step 4: Verify typecheck passes on dependent code**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -v "\.pnpm\|duplicate" | head -20`
Expected: No new errors introduced by this change. Pre-existing Prisma duplicate-generator noise is ignored.

- [ ] **Step 5: Commit**

```bash
git add full-kit/prisma/schema.prisma full-kit/prisma/migrations/
git commit -m "feat(prisma): add lead_source/lead_status/lead_at to Contact

Enables the Leads tab (filter on leadSource IS NOT NULL AND
leadStatus != 'converted'). Two new enums LeadSource and LeadStatus
plus three nullable columns on Contact, indexed on lead_source
for the Leads filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Sender normalization — X.500 Exchange DN → SMTP

**Files:**
- Create: `full-kit/src/lib/msgraph/sender-normalize.ts`
- Create: `full-kit/src/lib/msgraph/sender-normalize.test.ts`

- [ ] **Step 1: Write failing tests**

Create `full-kit/src/lib/msgraph/sender-normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeSenderAddress } from "./sender-normalize";

describe("normalizeSenderAddress", () => {
  it("passes a plain SMTP address through unchanged (lowercase)", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "Alice@Example.com", name: "Alice" } },
      "matt@naibusinessproperties.com",
    );
    expect(result).toEqual({
      address: "alice@example.com",
      displayName: "Alice",
      isInternal: false,
      normalizationFailed: false,
    });
  });

  it("normalizes Matt's X.500 Exchange DN to SMTP", () => {
    const result = normalizeSenderAddress(
      {
        emailAddress: {
          address:
            "/o=exchangelabs/ou=exchange administrative group (fydibohf23spdlt)/cn=recipients/cn=e7b84e89cfff441fa23381ede928ca5e-mrobertson",
          name: "Matt Robertson",
        },
      },
      "mrobertson@naibusinessproperties.com",
    );
    expect(result).toEqual({
      address: "mrobertson@naibusinessproperties.com",
      displayName: "Matt Robertson",
      isInternal: true,
      normalizationFailed: false,
    });
  });

  it("marks as internal when normalized domain matches target UPN domain", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "jsmith@naibusinessproperties.com", name: "Jennifer" } },
      "mrobertson@naibusinessproperties.com",
    );
    expect(result.isInternal).toBe(true);
    expect(result.address).toBe("jsmith@naibusinessproperties.com");
  });

  it("marks as external for a different domain", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "client@otherco.com", name: "Client" } },
      "mrobertson@naibusinessproperties.com",
    );
    expect(result.isInternal).toBe(false);
  });

  it("falls back on malformed X.500 DN with normalizationFailed flag", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "/o=broken", name: "Unknown" } },
      "mrobertson@naibusinessproperties.com",
    );
    expect(result.address).toBe("/o=broken");
    expect(result.normalizationFailed).toBe(true);
  });

  it("handles null from gracefully", () => {
    const result = normalizeSenderAddress(null, "mrobertson@naibusinessproperties.com");
    expect(result.address).toBe("");
    expect(result.normalizationFailed).toBe(true);
  });

  it("uses empty displayName when name is missing", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "x@y.com" } },
      "mrobertson@naibusinessproperties.com",
    );
    expect(result.displayName).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/sender-normalize.test.ts 2>&1 | tail -15`
Expected: FAIL — cannot resolve import `./sender-normalize`.

- [ ] **Step 3: Write the normalizer**

Create `full-kit/src/lib/msgraph/sender-normalize.ts`:

```ts
export interface GraphEmailFrom {
  emailAddress: {
    address: string;
    name?: string;
  };
}

export interface NormalizedSender {
  address: string;
  displayName: string;
  isInternal: boolean;
  normalizationFailed: boolean;
}

/**
 * Normalizes a Graph message `from` object into a canonical SMTP-form sender.
 *
 * Exchange Online sometimes emits the X.500 legacyExchangeDN
 * (`/o=exchangelabs/ou=.../cn=recipients/cn=...-localpart`) for internal-tenant
 * senders instead of a plain SMTP address. We convert the DN back to SMTP by
 * taking the segment after the final `-` and appending the target UPN's domain.
 *
 * X.500 DNs are only emitted for senders within Matt's own Exchange org, so the
 * target tenant's domain is the correct guess.
 */
export function normalizeSenderAddress(
  from: GraphEmailFrom | null | undefined,
  targetUpn: string,
): NormalizedSender {
  if (!from?.emailAddress?.address) {
    return {
      address: "",
      displayName: "",
      isInternal: false,
      normalizationFailed: true,
    };
  }

  const raw = from.emailAddress.address;
  const displayName = from.emailAddress.name ?? "";
  const targetDomain = targetUpn.split("@")[1]?.toLowerCase() ?? "";

  if (raw.startsWith("/o=") || raw.startsWith("/O=")) {
    const cnSegments = raw.split("/cn=");
    const lastCn = cnSegments[cnSegments.length - 1] ?? "";
    const lastDash = lastCn.lastIndexOf("-");
    if (lastDash > 0 && lastDash < lastCn.length - 1) {
      const localPart = lastCn.slice(lastDash + 1).toLowerCase();
      if (localPart && targetDomain) {
        return {
          address: `${localPart}@${targetDomain}`,
          displayName,
          isInternal: true,
          normalizationFailed: false,
        };
      }
    }
    return {
      address: raw,
      displayName,
      isInternal: false,
      normalizationFailed: true,
    };
  }

  const lower = raw.toLowerCase();
  const atIdx = lower.indexOf("@");
  if (atIdx <= 0 || atIdx === lower.length - 1) {
    return {
      address: lower,
      displayName,
      isInternal: false,
      normalizationFailed: true,
    };
  }
  const domain = lower.slice(atIdx + 1);
  return {
    address: lower,
    displayName,
    isInternal: domain === targetDomain,
    normalizationFailed: false,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/sender-normalize.test.ts 2>&1 | tail -15`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/sender-normalize.ts full-kit/src/lib/msgraph/sender-normalize.test.ts
git commit -m "feat(msgraph): normalizeSenderAddress for X.500 Exchange DN

Graph emits /o=exchangelabs/... DNs for internal-tenant senders
on some message paths, creating a false 'two identities for Matt'
problem. Converts DN back to SMTP using the target UPN's domain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Shared email types and constants

**Files:**
- Create: `full-kit/src/lib/msgraph/email-types.ts`

- [ ] **Step 1: Create the types file**

Create `full-kit/src/lib/msgraph/email-types.ts`:

```ts
import type { NormalizedSender } from "./sender-normalize";

export type EmailFolder = "inbox" | "sentitems";

export type EmailClassification = "signal" | "noise" | "uncertain";

export type EmailSource =
  | "matt-outbound"
  | "nai-internal"
  | "docusign-transactional"
  | "dotloop-transactional"
  | "buildout-event"
  | "loopnet-lead"
  | "crexi-lead"
  | "known-counterparty"
  | "layer-b-domain-drop"
  | "layer-b-sender-drop"
  | "layer-b-local-part-drop"
  | "layer-b-folder-drop"
  | "layer-b-unsubscribe-header"
  | "layer-c";

export interface GraphEmailRecipient {
  emailAddress: { address: string; name?: string };
}

export interface GraphEmailBody {
  contentType: "text" | "html";
  content: string;
}

export interface GraphEmailHeader {
  name: string;
  value: string;
}

export interface GraphEmailMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  parentFolderId?: string;
  subject?: string | null;
  from?: { emailAddress: { address: string; name?: string } } | null;
  sender?: { emailAddress: { address: string; name?: string } } | null;
  toRecipients?: GraphEmailRecipient[];
  ccRecipients?: GraphEmailRecipient[];
  bccRecipients?: GraphEmailRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  importance?: "low" | "normal" | "high";
  body?: GraphEmailBody;
  bodyPreview?: string;
  internetMessageHeaders?: GraphEmailHeader[];
}

export interface BehavioralHints {
  senderInContacts: boolean;
  mattRepliedBefore: boolean;
  threadSize: number;
  domainIsLargeCreBroker: boolean;
}

export interface FilterContext {
  folder: EmailFolder;
  normalizedSender: NormalizedSender;
  targetUpn: string;
  hints: BehavioralHints;
}

export interface ClassificationResult {
  classification: EmailClassification;
  source: EmailSource;
  tier1Rule: string;
}

/** Large CRE broker firms whose domains carry a mix of signal + blasts.
 *  Used as a behavioral hint only; does NOT cause drops. */
export const LARGE_CRE_BROKER_DOMAINS = [
  "cbre.com",
  "cushwake.com",
  "cushmanwakefield.com",
  "jll.com",
  "colliers.com",
  "marcusmillichap.com",
  "naiglobal.com",
  "berkshirehathaway.com",
  "bhhs.com",
  "nmrk.com",
  "svn.com",
  "sandsig.com",
  "mwcre.com",
  "newmarkmw.com",
  "eralandmark.com",
  "evrealestate.com",
] as const;
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "email-types" | head -5`
Expected: No output (no errors on the new file).

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/email-types.ts
git commit -m "feat(msgraph): shared email-ingestion types and CRE-broker list

Types for Graph email messages, classification outputs, filter context,
and behavioral hints. LARGE_CRE_BROKER_DOMAINS is a behavioral hint
only — these domains are NOT blanket-dropped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Filter noise constants and predicate helpers

**Files:**
- Create: `full-kit/src/lib/msgraph/email-filter.ts` (initial version — constants + helpers; `classifyEmail` in Task 5)
- Create: `full-kit/src/lib/msgraph/email-filter.test.ts`

- [ ] **Step 1: Write failing tests for the predicate helpers**

Create `full-kit/src/lib/msgraph/email-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  isNoiseDomain,
  isNoiseSenderAddress,
  hasAutomatedLocalPart,
  hasUnsubscribeHeader,
  isJunkOrDeletedFolder,
  JUNK_FOLDER_NAMES,
} from "./email-filter";

describe("isNoiseDomain", () => {
  it("returns true for domains in the noise list", () => {
    expect(isNoiseDomain("propertyblast.com")).toBe(true);
    expect(isNoiseDomain("flexmail.flexmls.com")).toBe(true);
    expect(isNoiseDomain("e.mail.realtor.com")).toBe(true);
  });
  it("returns true for subdomains of noise domains", () => {
    expect(isNoiseDomain("sub.propertyblast.com")).toBe(true);
  });
  it("returns false for domains NOT in the noise list", () => {
    expect(isNoiseDomain("naibusinessproperties.com")).toBe(false);
    expect(isNoiseDomain("cbre.com")).toBe(false);
    expect(isNoiseDomain("docusign.net")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isNoiseDomain("PropertyBlast.com")).toBe(true);
  });
});

describe("isNoiseSenderAddress", () => {
  it("returns true for specific Crexi noise senders", () => {
    expect(isNoiseSenderAddress("emails@pro.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("emails@search.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("emails@campaigns.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("notifications@pro.crexi.com")).toBe(true);
  });
  it("returns true for nlpg@cbre.com but not other cbre senders", () => {
    expect(isNoiseSenderAddress("nlpg@cbre.com")).toBe(true);
    expect(isNoiseSenderAddress("ian.schroeder@cbre.com")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isNoiseSenderAddress("Emails@Pro.Crexi.Com")).toBe(true);
  });
});

describe("hasAutomatedLocalPart", () => {
  it("matches common automated prefixes", () => {
    expect(hasAutomatedLocalPart("noreply@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("no-reply@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("news@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("newsletter@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("digest@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("updates@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("marketing@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("alerts@example.com")).toBe(true);
  });
  it("matches with numeric suffixes and plus-tags", () => {
    expect(hasAutomatedLocalPart("news2@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("marketing+promo@example.com")).toBe(true);
  });
  it("does NOT match personal-looking local parts", () => {
    expect(hasAutomatedLocalPart("alice@example.com")).toBe(false);
    expect(hasAutomatedLocalPart("mrobertson@example.com")).toBe(false);
    expect(hasAutomatedLocalPart("john.smith@example.com")).toBe(false);
  });
  it("does NOT match when no @ is present", () => {
    expect(hasAutomatedLocalPart("noreply")).toBe(false);
  });
});

describe("hasUnsubscribeHeader", () => {
  it("returns true when List-Unsubscribe header is present (any case)", () => {
    expect(
      hasUnsubscribeHeader([{ name: "List-Unsubscribe", value: "<mailto:u@x>" }]),
    ).toBe(true);
    expect(
      hasUnsubscribeHeader([{ name: "list-unsubscribe", value: "<mailto:u@x>" }]),
    ).toBe(true);
  });
  it("returns false when absent or headers undefined", () => {
    expect(hasUnsubscribeHeader([])).toBe(false);
    expect(hasUnsubscribeHeader(undefined)).toBe(false);
    expect(
      hasUnsubscribeHeader([{ name: "Subject", value: "Hi" }]),
    ).toBe(false);
  });
});

describe("isJunkOrDeletedFolder", () => {
  it("identifies Junk and Deleted Items folders by well-known IDs", () => {
    for (const name of JUNK_FOLDER_NAMES) {
      expect(isJunkOrDeletedFolder(name)).toBe(true);
    }
  });
  it("returns false for inbox/sentitems", () => {
    expect(isJunkOrDeletedFolder("inbox")).toBe(false);
    expect(isJunkOrDeletedFolder("sentitems")).toBe(false);
    expect(isJunkOrDeletedFolder(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-filter.test.ts 2>&1 | tail -15`
Expected: FAIL — cannot resolve `./email-filter`.

- [ ] **Step 3: Create the filter file with constants and predicates**

Create `full-kit/src/lib/msgraph/email-filter.ts`:

```ts
import type { GraphEmailHeader } from "./email-types";

// =============================================================================
// NOISE CONSTANTS
// =============================================================================

/** Domains whose mail is blanket-dropped as noise. Subdomains also match. */
export const NOISE_DOMAINS: ReadonlySet<string> = new Set([
  "flexmail.flexmls.com",
  "e.mail.realtor.com",
  "notifications.realtor.com",
  "shared1.ccsend.com",
  "bhhs-ecards.com",
  "email-whitepages.com",
  "propertyblast.com",
  "srsrealestatepartners.com",
  "encorereis.com",
  "comms.cushwakedigital.com",
  "atlanticretail.reverecre.com",
  "mail.beehiiv.com",
  "publications.bisnow.com",
  "news.bdcnetwork.com",
  "daily.therundown.ai",
  "wrenews.com",
  "retechnology.com",
  "trepp.com",
  "alm.com",
  "infabode.com",
  "rentalbeast.com",
  "mail1.nnn.market",
  "toasttab.com",
  "e.allegiant.com",
  "h5.hilton.com",
  "notification.intuit.com",
  "gohighlevel.com",
  "80eighty.com",
  "oofos.com",
  "lumecube.com",
  "theceshop.com",
  "marketing.ecommission.com",
  "fayranches.com",
]);

/** Specific sender addresses that are always noise regardless of domain policy. */
export const NOISE_SENDER_ADDRESSES: ReadonlySet<string> = new Set([
  "emails@pro.crexi.com",
  "emails@search.crexi.com",
  "emails@campaigns.crexi.com",
  "notifications@pro.crexi.com",
  "auctions@notifications.crexi.com",
  "nlpg@cbre.com",
  "yafcteam@comms.cushwakedigital.com",
  "loopnet@email.loopnet.com",
  "noreply@loopnet.com",
  "sales@loopnet.com",
]);

/** Senders whose domains are allowlisted in Layer A and therefore should bypass
 *  the generic "no-reply local part" drop rule. */
export const TRANSACTIONAL_ALLOWLIST_DOMAINS: ReadonlySet<string> = new Set([
  "docusign.net",
  "buildout.com",
  "notifications.crexi.com",
  "loopnet.com",
  "dotloop.com",
]);

export const AUTOMATED_LOCAL_PART_DROP =
  /^(news|newsletter|digest|updates?|marketing|alerts?|announce|broadcast)[0-9]*(\+.*)?$/i;

export const AUTOMATED_NOREPLY_PATTERN =
  /^(no-?reply|donotreply|do-not-reply|mailer|postmaster|bounces?|delivery)(\+.*)?$/i;

/** Well-known folder names Graph emits as `parentFolderId` display names, plus
 *  common Well-Known Folder IDs in case Graph returns IDs rather than names. */
export const JUNK_FOLDER_NAMES: readonly string[] = [
  "junkemail",
  "junk email",
  "junk",
  "deleteditems",
  "deleted items",
  "deleted",
];

// =============================================================================
// PREDICATES
// =============================================================================

export function isNoiseDomain(domain: string | undefined): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  if (NOISE_DOMAINS.has(d)) return true;
  for (const noise of NOISE_DOMAINS) {
    if (d.endsWith(`.${noise}`)) return true;
  }
  return false;
}

export function isNoiseSenderAddress(address: string | undefined): boolean {
  if (!address) return false;
  return NOISE_SENDER_ADDRESSES.has(address.toLowerCase());
}

export function hasAutomatedLocalPart(address: string | undefined): boolean {
  if (!address) return false;
  const atIdx = address.indexOf("@");
  if (atIdx <= 0) return false;
  const localPart = address.slice(0, atIdx);
  return (
    AUTOMATED_LOCAL_PART_DROP.test(localPart) ||
    AUTOMATED_NOREPLY_PATTERN.test(localPart)
  );
}

export function hasUnsubscribeHeader(
  headers: GraphEmailHeader[] | undefined,
): boolean {
  if (!headers) return false;
  return headers.some((h) => h.name.toLowerCase() === "list-unsubscribe");
}

export function isJunkOrDeletedFolder(
  folderHint: string | undefined,
): boolean {
  if (!folderHint) return false;
  return JUNK_FOLDER_NAMES.includes(folderHint.toLowerCase());
}

export function domainIsLargeCreBroker(domain: string | undefined): boolean {
  if (!domain) return false;
  return LARGE_CRE_BROKER_DOMAINS.includes(domain.toLowerCase() as never);
}

// late import to avoid a circular type-only cycle
import { LARGE_CRE_BROKER_DOMAINS } from "./email-types";
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-filter.test.ts 2>&1 | tail -15`
Expected: PASS — all predicate tests green.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-filter.ts full-kit/src/lib/msgraph/email-filter.test.ts
git commit -m "feat(msgraph): noise constants and filter predicate helpers

Noise domain list, specific-sender drop list, transactional allowlist
domains (for no-reply bypass), automated-local-part regexes, and
predicate helpers (isNoiseDomain, hasAutomatedLocalPart, etc.).
classifyEmail composite follows in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: classifyEmail — Layer A / B / C composite

**Files:**
- Modify: `full-kit/src/lib/msgraph/email-filter.ts` (append `classifyEmail` + Crexi/Buildout subject predicates)
- Modify: `full-kit/src/lib/msgraph/email-filter.test.ts` (append composite tests)

- [ ] **Step 1: Append failing tests for classifyEmail**

Append to `full-kit/src/lib/msgraph/email-filter.test.ts`:

```ts
import { classifyEmail } from "./email-filter";
import type { FilterContext, GraphEmailMessage } from "./email-types";

function ctx(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    folder: "inbox",
    targetUpn: "mrobertson@naibusinessproperties.com",
    normalizedSender: {
      address: "someone@example.com",
      displayName: "Someone",
      isInternal: false,
      normalizationFailed: false,
    },
    hints: {
      senderInContacts: false,
      mattRepliedBefore: false,
      threadSize: 1,
      domainIsLargeCreBroker: false,
    },
    ...overrides,
  };
}
function msg(o: Partial<GraphEmailMessage> = {}): GraphEmailMessage {
  return {
    id: "m1",
    subject: "",
    from: { emailAddress: { address: "someone@example.com", name: "Someone" } },
    receivedDateTime: "2026-01-01T00:00:00Z",
    toRecipients: [
      { emailAddress: { address: "mrobertson@naibusinessproperties.com" } },
    ],
    ...o,
  };
}

describe("classifyEmail — Layer A (auto-signal)", () => {
  it("marks sentitems as matt-outbound signal", () => {
    const r = classifyEmail(msg(), ctx({ folder: "sentitems" }));
    expect(r).toMatchObject({ classification: "signal", source: "matt-outbound" });
  });

  it("marks NAI internal with Matt in To as nai-internal signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "jsmith@naibusinessproperties.com" } },
      }),
      ctx({
        normalizedSender: {
          address: "jsmith@naibusinessproperties.com",
          displayName: "Jennifer",
          isInternal: true,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "signal", source: "nai-internal" });
  });

  it("does NOT mark NAI internal as signal when Matt is only in CC", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "jsmith@naibusinessproperties.com" } },
        toRecipients: [{ emailAddress: { address: "other@example.com" } }],
        ccRecipients: [
          { emailAddress: { address: "mrobertson@naibusinessproperties.com" } },
        ],
      }),
      ctx({
        normalizedSender: {
          address: "jsmith@naibusinessproperties.com",
          displayName: "J",
          isInternal: true,
          normalizationFailed: false,
        },
      }),
    );
    expect(r.source).not.toBe("nai-internal");
  });

  it("does NOT mark NAI internal as signal when toRecipients has > 10 entries (blast)", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      emailAddress: { address: `u${i}@naibusinessproperties.com` },
    }));
    many.push({
      emailAddress: { address: "mrobertson@naibusinessproperties.com" },
    });
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "data@naibusinessproperties.com" } },
        toRecipients: many,
      }),
      ctx({
        normalizedSender: {
          address: "data@naibusinessproperties.com",
          displayName: "Data",
          isInternal: true,
          normalizationFailed: false,
        },
      }),
    );
    expect(r.source).not.toBe("nai-internal");
  });

  it("marks @docusign.net as docusign-transactional signal", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "dse_na2@docusign.net" } } }),
      ctx({
        normalizedSender: {
          address: "dse_na2@docusign.net",
          displayName: "Docusign",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({
      classification: "signal",
      source: "docusign-transactional",
    });
  });

  it("marks Buildout support + lead subject as buildout-event signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "support@buildout.com" } },
        subject: "A new Lead has been added - US Bank Building",
      }),
      ctx({
        normalizedSender: {
          address: "support@buildout.com",
          displayName: "Buildout Support",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({
      classification: "signal",
      source: "buildout-event",
    });
  });

  it("marks LoopNet leads@ + LoopNet-Lead subject as loopnet-lead signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "leads@loopnet.com" } },
        subject: "LoopNet Lead for 303 N Broadway",
      }),
      ctx({
        normalizedSender: {
          address: "leads@loopnet.com",
          displayName: "LoopNet",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "signal", source: "loopnet-lead" });
  });

  it("marks Crexi notifications + lead subject as crexi-lead signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "emails@notifications.crexi.com" } },
        subject: "3 new leads found for West Park Promenade",
      }),
      ctx({
        normalizedSender: {
          address: "emails@notifications.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "signal", source: "crexi-lead" });
  });

  it("does NOT mark Crexi notifications + platform-admin subject as signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "emails@notifications.crexi.com" } },
        subject: "Updates have been made to 1 Property you are interested in",
      }),
      ctx({
        normalizedSender: {
          address: "emails@notifications.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r.source).not.toBe("crexi-lead");
  });

  it("marks known counterparty (sender in Contacts + Matt replied) as signal", () => {
    const r = classifyEmail(msg(), ctx({
      hints: {
        senderInContacts: true,
        mattRepliedBefore: true,
        threadSize: 3,
        domainIsLargeCreBroker: false,
      },
    }));
    expect(r).toMatchObject({ classification: "signal", source: "known-counterparty" });
  });
});

describe("classifyEmail — Layer B (hard drop)", () => {
  it("drops messages from a NOISE_DOMAINS domain", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "x@propertyblast.com" } } }),
      ctx({
        normalizedSender: {
          address: "x@propertyblast.com",
          displayName: "Blast",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "noise", source: "layer-b-domain-drop" });
  });

  it("drops specific noise sender addresses", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "emails@pro.crexi.com" } } }),
      ctx({
        normalizedSender: {
          address: "emails@pro.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "noise", source: "layer-b-sender-drop" });
  });

  it("drops automated local parts when NOT on the transactional allowlist", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "news@somecompany.com" } } }),
      ctx({
        normalizedSender: {
          address: "news@somecompany.com",
          displayName: "News",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "noise", source: "layer-b-local-part-drop" });
  });

  it("does NOT drop automated local parts from allowlisted transactional domains", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "no-reply@buildout.com" } } }),
      ctx({
        normalizedSender: {
          address: "no-reply@buildout.com",
          displayName: "Buildout",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r.classification).not.toBe("noise");
  });

  it("drops messages with List-Unsubscribe header when not otherwise allowlisted", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "hello@somerandomco.com" } },
        internetMessageHeaders: [{ name: "List-Unsubscribe", value: "<mailto:u>" }],
      }),
      ctx({
        normalizedSender: {
          address: "hello@somerandomco.com",
          displayName: "Co",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-unsubscribe-header",
    });
  });

  it("drops messages in Junk Email folder regardless of sender", () => {
    const r = classifyEmail(
      msg({ parentFolderId: "junkemail" }),
      ctx(),
    );
    expect(r).toMatchObject({ classification: "noise", source: "layer-b-folder-drop" });
  });
});

describe("classifyEmail — Layer C (uncertain fallback)", () => {
  it("labels otherwise-unknown senders as uncertain", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "unknown@mystery-co.com" } },
        subject: "Question about your listing",
      }),
      ctx({
        normalizedSender: {
          address: "unknown@mystery-co.com",
          displayName: "Unknown",
          isInternal: false,
          normalizationFailed: false,
        },
      }),
    );
    expect(r).toMatchObject({ classification: "uncertain", source: "layer-c" });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-filter.test.ts 2>&1 | tail -15`
Expected: FAIL — `classifyEmail` is not exported.

- [ ] **Step 3: Append classifyEmail to email-filter.ts**

Append to `full-kit/src/lib/msgraph/email-filter.ts`:

```ts
import type {
  ClassificationResult,
  FilterContext,
  GraphEmailMessage,
} from "./email-types";

// Subject-line regexes per platform
const CREXI_LEAD_SUBJECT =
  /(new leads? found for|requesting information on|new leads to be contacted|entered a note on)/i;
const CREXI_NOISE_SUBJECT_ON_NOTIFICATIONS =
  /^(updates have been made to|action required!|\d+ of your properties|.*search ranking)/i;
const BUILDOUT_SUPPORT_SIGNAL_SUBJECT =
  /^(a new lead has been added|deal stage updated on|you've been assigned a task|.*critical date.*upcoming|ca executed on)/i;
const BUILDOUT_NOTIFICATION_SIGNAL_SUBJECT =
  /^(documents viewed on|ca executed on)/i;
const LOOPNET_LEAD_SUBJECT = /^(loopnet lead for|.* favorited)/i;

const MAX_TO_RECIPIENTS_FOR_SIGNAL = 10;

/**
 * Classify a Graph email message into signal/noise/uncertain with a typed
 * source tag. Pure function — the orchestrator is responsible for providing
 * the filter context (normalized sender, folder, behavioral hints).
 */
export function classifyEmail(
  message: GraphEmailMessage,
  context: FilterContext,
): ClassificationResult {
  const { folder, normalizedSender, targetUpn, hints } = context;
  const sender = normalizedSender.address;
  const senderDomain = sender.includes("@") ? sender.split("@")[1] : "";
  const subject = message.subject ?? "";
  const headers = message.internetMessageHeaders;

  // --- Layer B folder check runs FIRST so Junk/Deleted don't masquerade as signal ---
  if (isJunkOrDeletedFolder(message.parentFolderId)) {
    return { classification: "noise", source: "layer-b-folder-drop", tier1Rule: "folder" };
  }

  // --- Layer A: auto-signal allowlist ---
  if (folder === "sentitems") {
    return { classification: "signal", source: "matt-outbound", tier1Rule: "sent-items" };
  }

  // NAI internal: Matt must be a direct recipient, To list must not look like a blast,
  // and no List-Unsubscribe.
  if (normalizedSender.isInternal) {
    const toList = message.toRecipients ?? [];
    const mattInTo = toList.some(
      (r) => r.emailAddress.address?.toLowerCase() === targetUpn.toLowerCase(),
    );
    const reasonableToSize = toList.length <= MAX_TO_RECIPIENTS_FOR_SIGNAL;
    if (mattInTo && reasonableToSize && !hasUnsubscribeHeader(headers)) {
      return { classification: "signal", source: "nai-internal", tier1Rule: "nai-direct" };
    }
  }

  if (senderDomain === "docusign.net" || senderDomain.endsWith(".docusign.net")) {
    return { classification: "signal", source: "docusign-transactional", tier1Rule: "docusign" };
  }

  if (sender === "hit-reply@dotloop.com") {
    return { classification: "signal", source: "dotloop-transactional", tier1Rule: "dotloop" };
  }

  if (sender === "support@buildout.com" && BUILDOUT_SUPPORT_SIGNAL_SUBJECT.test(subject)) {
    return { classification: "signal", source: "buildout-event", tier1Rule: "buildout-support" };
  }
  if (sender === "no-reply-notification@buildout.com" && BUILDOUT_NOTIFICATION_SIGNAL_SUBJECT.test(subject)) {
    return { classification: "signal", source: "buildout-event", tier1Rule: "buildout-notification" };
  }

  if (sender === "leads@loopnet.com" && LOOPNET_LEAD_SUBJECT.test(subject)) {
    return { classification: "signal", source: "loopnet-lead", tier1Rule: "loopnet-leads" };
  }

  if (senderDomain.endsWith("notifications.crexi.com") && CREXI_LEAD_SUBJECT.test(subject)) {
    return { classification: "signal", source: "crexi-lead", tier1Rule: "crexi-notifications" };
  }

  if (hints.senderInContacts && hints.mattRepliedBefore) {
    return { classification: "signal", source: "known-counterparty", tier1Rule: "contact-replied" };
  }

  // --- Layer B: hard-drop noise ---

  // Crexi notifications carry both signal subjects (above) and noise subjects (below).
  // If it's a notifications.crexi.com sender and the subject is a known noise pattern,
  // explicit sender-level drop.
  if (
    senderDomain.endsWith("notifications.crexi.com") &&
    CREXI_NOISE_SUBJECT_ON_NOTIFICATIONS.test(subject)
  ) {
    return {
      classification: "noise",
      source: "layer-b-sender-drop",
      tier1Rule: "crexi-notification-noise",
    };
  }

  if (isNoiseDomain(senderDomain)) {
    return { classification: "noise", source: "layer-b-domain-drop", tier1Rule: "noise-domain" };
  }

  if (isNoiseSenderAddress(sender)) {
    return { classification: "noise", source: "layer-b-sender-drop", tier1Rule: "noise-sender" };
  }

  // No-reply / news / marketing etc. unless from an allowlisted transactional domain
  if (hasAutomatedLocalPart(sender) && !TRANSACTIONAL_ALLOWLIST_DOMAINS.has(senderDomain)) {
    return { classification: "noise", source: "layer-b-local-part-drop", tier1Rule: "automated-local-part" };
  }

  if (hasUnsubscribeHeader(headers)) {
    return {
      classification: "noise",
      source: "layer-b-unsubscribe-header",
      tier1Rule: "list-unsubscribe",
    };
  }

  // --- Layer C: uncertain, store body for later classification ---
  return { classification: "uncertain", source: "layer-c", tier1Rule: "fallthrough" };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-filter.test.ts 2>&1 | tail -15`
Expected: PASS — all composite and predicate tests green.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-filter.ts full-kit/src/lib/msgraph/email-filter.test.ts
git commit -m "feat(msgraph): classifyEmail composite — Layer A/B/C

Pure function taking a Graph message + filter context and returning
signal/noise/uncertain + a typed source tag. Layer A allowlist: sent
items, NAI internal direct-recipient, DocuSign, Dotloop, Buildout
events, LoopNet leads, Crexi leads, known counterparties. Layer B:
folder-based, Crexi-notification-noise, noise domains/senders,
automated local parts, List-Unsubscribe. Layer C: uncertain fallthrough.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Crexi lead extractor

**Files:**
- Create: `full-kit/src/lib/msgraph/email-extractors.ts`
- Create: `full-kit/src/lib/msgraph/email-extractors.test.ts`

- [ ] **Step 1: Write failing tests for extractCrexiLead**

Create `full-kit/src/lib/msgraph/email-extractors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractCrexiLead } from "./email-extractors";

describe("extractCrexiLead", () => {
  it("parses 'N new leads found for PROPERTY' pattern", () => {
    const r = extractCrexiLead({
      subject: "3 new leads found for West Park Promenade",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "new-leads-count",
      leadCount: 3,
      propertyName: "West Park Promenade",
    });
  });

  it("parses '1 new leads found for' (singular case in real data)", () => {
    const r = extractCrexiLead({
      subject: "1 new leads found for Hardin Gas Station",
      bodyText: "",
    });
    expect(r).toMatchObject({
      kind: "new-leads-count",
      leadCount: 1,
      propertyName: "Hardin Gas Station",
    });
  });

  it("parses '[Name] requesting Information on PROPERTY in CITY'", () => {
    const r = extractCrexiLead({
      subject: "JACKY BRADLEY requesting Information on Burger King | Sidney, MT in Sidney",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "inquiry",
      inquirerName: "JACKY BRADLEY",
      propertyName: "Burger King | Sidney, MT",
      cityOrMarket: "Sidney",
    });
  });

  it("parses '[Name] entered a note on PROPERTY' as team-note", () => {
    const r = extractCrexiLead({
      subject: "Margaret entered a note on Burger King | Sidney, MT",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "team-note",
      noteAuthor: "Margaret",
      propertyName: "Burger King | Sidney, MT",
    });
  });

  it("recognizes 'You have NEW leads to be contacted' as inquiry kind", () => {
    const r = extractCrexiLead({
      subject: "You have NEW leads to be contacted",
      bodyText: "Name: Jane Doe\nEmail: jane@example.com\nPhone: 555-1212\nCompany: Acme",
    });
    expect(r?.kind).toBe("inquiry");
    expect(r?.inquirer).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1212",
      company: "Acme",
    });
  });

  it("parses inquirer fields from body for 'requesting Information' kind", () => {
    const r = extractCrexiLead({
      subject: "Dean Klingner requesting Information on 13 Colorado Ave in Laurel",
      bodyText: "Name: Dean Klingner\nEmail: dean@buyer.com\nPhone: (406) 555-0000\nMessage: Interested in the property",
    });
    expect(r?.kind).toBe("inquiry");
    expect(r?.inquirer).toEqual({
      name: "Dean Klingner",
      email: "dean@buyer.com",
      phone: "(406) 555-0000",
      message: "Interested in the property",
    });
  });

  it("returns null on unrecognized subject", () => {
    const r = extractCrexiLead({ subject: "Some random subject", bodyText: "" });
    expect(r).toBeNull();
  });

  it("returns null on null subject", () => {
    const r = extractCrexiLead({ subject: null, bodyText: "" });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -15`
Expected: FAIL — cannot resolve import.

- [ ] **Step 3: Create extractors file with extractCrexiLead**

Create `full-kit/src/lib/msgraph/email-extractors.ts`:

```ts
export interface ExtractorInput {
  subject: string | null | undefined;
  bodyText: string;
}

export interface InquirerInfo {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
}

export interface CrexiLeadExtract {
  kind: "new-leads-count" | "inquiry" | "team-note";
  propertyName?: string;
  leadCount?: number;
  cityOrMarket?: string;
  inquirerName?: string;
  inquirer?: InquirerInfo;
  noteAuthor?: string;
}

const CREXI_COUNT_LEADS =
  /^(\d+)\s+new leads? found for\s+(.+)$/i;
const CREXI_INQUIRY_SUBJECT =
  /^(.+?)\s+requesting\s+information\s+on\s+(.+?)\s+in\s+(.+)$/i;
const CREXI_TEAM_NOTE =
  /^(.+?)\s+entered a note on\s+(.+)$/i;
const CREXI_GENERIC_NEW_LEADS = /^you have NEW leads to be contacted$/i;

export function extractCrexiLead(input: ExtractorInput): CrexiLeadExtract | null {
  const subject = (input.subject ?? "").trim();
  if (!subject) return null;

  let m = subject.match(CREXI_COUNT_LEADS);
  if (m) {
    return {
      kind: "new-leads-count",
      leadCount: Number.parseInt(m[1], 10),
      propertyName: m[2].trim(),
    };
  }

  m = subject.match(CREXI_INQUIRY_SUBJECT);
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText);
    return {
      kind: "inquiry",
      inquirerName: m[1].trim(),
      propertyName: m[2].trim(),
      cityOrMarket: m[3].trim(),
      ...(inquirer ? { inquirer } : {}),
    };
  }

  if (CREXI_GENERIC_NEW_LEADS.test(subject)) {
    const inquirer = parseInquirerBody(input.bodyText);
    return {
      kind: "inquiry",
      ...(inquirer ? { inquirer } : {}),
    };
  }

  m = subject.match(CREXI_TEAM_NOTE);
  if (m) {
    return {
      kind: "team-note",
      noteAuthor: m[1].trim(),
      propertyName: m[2].trim(),
    };
  }

  return null;
}

// Shared by Crexi + LoopNet + Buildout extractors
export function parseInquirerBody(body: string): InquirerInfo | null {
  if (!body) return null;
  const info: InquirerInfo = {};
  const nameM = body.match(/^\s*name\s*[:\-]\s*(.+?)\s*$/im);
  if (nameM) info.name = nameM[1].trim();
  const emailM = body.match(/^\s*email\s*[:\-]\s*([^\s<>]+@[^\s<>]+)\s*$/im);
  if (emailM) info.email = emailM[1].trim().toLowerCase();
  const phoneM = body.match(/^\s*phone\s*[:\-]\s*([+\d\s().\-]+?)\s*$/im);
  if (phoneM) info.phone = phoneM[1].trim();
  const companyM = body.match(/^\s*company\s*[:\-]\s*(.+?)\s*$/im);
  if (companyM) info.company = companyM[1].trim();
  const messageM = body.match(/^\s*message\s*[:\-]\s*([\s\S]+?)(?:\n\s*\n|$)/im);
  if (messageM) info.message = messageM[1].trim();

  return Object.keys(info).length > 0 ? info : null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -15`
Expected: PASS — 8 Crexi tests green.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(msgraph): extractCrexiLead + parseInquirerBody helper

Parses Crexi notification subjects into structured data: new-leads-count,
inquiry (with inquirer fields from body), team-note (Margaret-style
internal collaboration, NOT a lead). Shared parseInquirerBody will
also back LoopNet and Buildout extractors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: LoopNet lead extractor

**Files:**
- Modify: `full-kit/src/lib/msgraph/email-extractors.ts`
- Modify: `full-kit/src/lib/msgraph/email-extractors.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `full-kit/src/lib/msgraph/email-extractors.test.ts`:

```ts
import { extractLoopNetLead } from "./email-extractors";

describe("extractLoopNetLead", () => {
  it("parses 'LoopNet Lead for PROPERTY' with body fields", () => {
    const r = extractLoopNetLead({
      subject: "LoopNet Lead for 303 N Broadway",
      bodyText: "Name: Tom Smith\nEmail: tom@buyer.net\nPhone: 406-555-0100",
    });
    expect(r).toEqual({
      kind: "inquiry",
      propertyName: "303 N Broadway",
      inquirer: {
        name: "Tom Smith",
        email: "tom@buyer.net",
        phone: "406-555-0100",
      },
    });
  });

  it("parses 'Alex Wright favorited PROPERTY' as favorited kind", () => {
    const r = extractLoopNetLead({
      subject: "Alex Wright favorited 303 N Broadway",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "favorited",
      viewerName: "Alex Wright",
      propertyName: "303 N Broadway",
    });
  });

  it("returns null for 'Your LoopNet inquiry was sent' (Matt's own outbound confirmation)", () => {
    const r = extractLoopNetLead({
      subject: "Your LoopNet inquiry was sent",
      bodyText: "",
    });
    expect(r).toBeNull();
  });

  it("returns null on unrecognized subject", () => {
    const r = extractLoopNetLead({ subject: "Random LoopNet update", bodyText: "" });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -10`
Expected: FAIL — `extractLoopNetLead` is not exported.

- [ ] **Step 3: Append the LoopNet extractor**

Append to `full-kit/src/lib/msgraph/email-extractors.ts`:

```ts
export interface LoopNetLeadExtract {
  kind: "inquiry" | "favorited";
  propertyName: string;
  inquirer?: InquirerInfo;
  viewerName?: string;
}

const LOOPNET_INQUIRY = /^loopnet lead for\s+(.+)$/i;
const LOOPNET_FAVORITED = /^(.+?)\s+favorited\s+(.+)$/i;
const LOOPNET_SELF_CONFIRM = /^your loopnet inquiry was sent$/i;

export function extractLoopNetLead(input: ExtractorInput): LoopNetLeadExtract | null {
  const subject = (input.subject ?? "").trim();
  if (!subject) return null;

  if (LOOPNET_SELF_CONFIRM.test(subject)) return null;

  let m = subject.match(LOOPNET_INQUIRY);
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText);
    return {
      kind: "inquiry",
      propertyName: m[1].trim(),
      ...(inquirer ? { inquirer } : {}),
    };
  }

  m = subject.match(LOOPNET_FAVORITED);
  if (m) {
    return {
      kind: "favorited",
      viewerName: m[1].trim(),
      propertyName: m[2].trim(),
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -10`
Expected: PASS — 12 tests total (8 Crexi + 4 LoopNet).

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(msgraph): extractLoopNetLead

Parses LoopNet lead subjects (LoopNet Lead for X / favorited X)
with body inquirer fields. Self-confirmation pattern (Your LoopNet
inquiry was sent) returns null since it is Matt's own outbound echo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Buildout event extractor

**Files:**
- Modify: `full-kit/src/lib/msgraph/email-extractors.ts`
- Modify: `full-kit/src/lib/msgraph/email-extractors.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `full-kit/src/lib/msgraph/email-extractors.test.ts`:

```ts
import { extractBuildoutEvent } from "./email-extractors";

describe("extractBuildoutEvent", () => {
  it("parses 'A new Lead has been added - PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "A new Lead has been added - US Bank Building",
      bodyText: "Name: Sam Buyer\nEmail: sam@example.com",
    });
    expect(r).toEqual({
      kind: "new-lead",
      propertyName: "US Bank Building",
      inquirer: { name: "Sam Buyer", email: "sam@example.com" },
    });
  });

  it("parses 'Deal stage updated on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Deal stage updated on 2621 Overland",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "deal-stage-update",
      propertyName: "2621 Overland",
    });
  });

  it("parses 'You've been assigned a task'", () => {
    const r = extractBuildoutEvent({
      subject: "You've been assigned a task",
      bodyText: "",
    });
    expect(r?.kind).toBe("task-assigned");
  });

  it("parses critical date upcoming", () => {
    const r = extractBuildoutEvent({
      subject: "You have a critical date upcoming",
      bodyText: "",
    });
    expect(r?.kind).toBe("critical-date");
  });

  it("parses 'CA executed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "CA executed on 2110 Overland Avenue",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "ca-executed",
      propertyName: "2110 Overland Avenue",
    });
  });

  it("parses 'Documents viewed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Documents viewed on US Bank Building",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "document-view",
      propertyName: "US Bank Building",
    });
  });

  it("returns null for unrelated Buildout email", () => {
    const r = extractBuildoutEvent({
      subject: "Buildout + NAI Business Partners | Meeting Recap",
      bodyText: "",
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -10`
Expected: FAIL — `extractBuildoutEvent` not exported.

- [ ] **Step 3: Append the Buildout extractor**

Append to `full-kit/src/lib/msgraph/email-extractors.ts`:

```ts
export interface BuildoutEventExtract {
  kind:
    | "new-lead"
    | "deal-stage-update"
    | "task-assigned"
    | "critical-date"
    | "ca-executed"
    | "document-view";
  propertyName?: string;
  inquirer?: InquirerInfo;
  newStage?: string;
  previousStage?: string;
}

const BUILDOUT_NEW_LEAD = /^a new lead has been added\s*-\s*(.+)$/i;
const BUILDOUT_STAGE = /^deal stage updated on\s+(.+)$/i;
const BUILDOUT_TASK = /^you've been assigned a task/i;
const BUILDOUT_CRITICAL = /critical date.*upcoming/i;
const BUILDOUT_CA_EXECUTED = /^ca executed on\s+(.+)$/i;
const BUILDOUT_DOCUMENT_VIEW = /^documents viewed on\s+(.+)$/i;

export function extractBuildoutEvent(input: ExtractorInput): BuildoutEventExtract | null {
  const subject = (input.subject ?? "").trim();
  if (!subject) return null;

  let m = subject.match(BUILDOUT_NEW_LEAD);
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText);
    return {
      kind: "new-lead",
      propertyName: m[1].trim(),
      ...(inquirer ? { inquirer } : {}),
    };
  }

  m = subject.match(BUILDOUT_STAGE);
  if (m) {
    return { kind: "deal-stage-update", propertyName: m[1].trim() };
  }

  if (BUILDOUT_TASK.test(subject)) {
    return { kind: "task-assigned" };
  }

  if (BUILDOUT_CRITICAL.test(subject)) {
    return { kind: "critical-date" };
  }

  m = subject.match(BUILDOUT_CA_EXECUTED);
  if (m) {
    return { kind: "ca-executed", propertyName: m[1].trim() };
  }

  m = subject.match(BUILDOUT_DOCUMENT_VIEW);
  if (m) {
    return { kind: "document-view", propertyName: m[1].trim() };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/email-extractors.test.ts 2>&1 | tail -10`
Expected: PASS — 19 tests total.

- [ ] **Step 5: Commit**

```bash
git add full-kit/src/lib/msgraph/email-extractors.ts full-kit/src/lib/msgraph/email-extractors.test.ts
git commit -m "feat(msgraph): extractBuildoutEvent

Parses Buildout notification subjects into typed event kinds:
new-lead, deal-stage-update, task-assigned, critical-date,
ca-executed, document-view. The event data is stored on
Communication.metadata.extracted for a follow-up consumer spec
to mutate Deal/Lead/Todo state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Per-folder cursor helpers

**Files:**
- Create: `full-kit/src/lib/msgraph/emails.ts` (initial version — cursor helpers only)

- [ ] **Step 1: Create emails.ts with cursor helpers**

Create `full-kit/src/lib/msgraph/emails.ts`:

```ts
import { db } from "@/lib/prisma";
import type { EmailFolder } from "./email-types";

const CURSOR_EXTERNAL_ID = "__cursor__";

function cursorSourceFor(folder: EmailFolder): string {
  return folder === "inbox" ? "msgraph-email-inbox" : "msgraph-email-sentitems";
}

export async function loadEmailCursor(
  folder: EmailFolder,
): Promise<{ deltaLink: string } | null> {
  const row = await db.externalSync.findUnique({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
  });
  if (!row) return null;
  const data = row.rawData as { deltaLink?: string } | null;
  if (!data?.deltaLink || typeof data.deltaLink !== "string") return null;
  return { deltaLink: data.deltaLink };
}

export async function saveEmailCursor(
  folder: EmailFolder,
  deltaLink: string,
): Promise<void> {
  await db.externalSync.upsert({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
    create: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
      entityType: "cursor",
      status: "synced",
      rawData: { deltaLink },
    },
    update: {
      rawData: { deltaLink },
      status: "synced",
      syncedAt: new Date(),
    },
  });
}

export async function deleteEmailCursor(folder: EmailFolder): Promise<void> {
  await db.externalSync.deleteMany({
    where: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "emails\.ts" | head -5`
Expected: No output (no errors on emails.ts).

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): per-folder email cursor helpers

loadEmailCursor / saveEmailCursor / deleteEmailCursor with distinct
sources (msgraph-email-inbox, msgraph-email-sentitems) so inbox and
sentitems advance independently. Same __cursor__ sentinel pattern as
contacts sync.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Graph delta fetcher for a single folder

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append delta fetcher)

- [ ] **Step 1: Append delta fetcher**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
import { graphFetch } from "./client";
import { GraphError } from "./errors";
import { loadMsgraphConfig } from "./config";
import type { GraphEmailMessage } from "./email-types";

interface GraphDeltaPage {
  value: Array<GraphEmailMessage & { "@removed"?: { reason: string } }>;
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

const EMAIL_SELECT_FIELDS = [
  "id",
  "internetMessageId",
  "conversationId",
  "parentFolderId",
  "subject",
  "from",
  "sender",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "isRead",
  "importance",
  "body",
  "bodyPreview",
  "internetMessageHeaders",
].join(",");

const PREFER_HEADER = {
  Prefer: 'outlook.body-content-type="text"',
};

const PAGE_SIZE = 100;

/**
 * Async generator that yields Graph email pages for a single folder.
 *
 * Starts from the stored cursor if one exists, or from the folder root
 * filtered by receivedDateTime >= sinceIso otherwise. Yields each page plus
 * the final deltaLink when the sync completes.
 */
export async function* fetchEmailDelta(
  folder: EmailFolder,
  sinceIso: string,
): AsyncGenerator<{ page: GraphDeltaPage; isFinal: boolean }, void, void> {
  const cfg = loadMsgraphConfig();
  const cursor = await loadEmailCursor(folder);

  const initialUrl =
    cursor?.deltaLink ??
    `/users/${encodeURIComponent(cfg.targetUpn)}/mailFolders/${folder}/messages/delta` +
      `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
      `&$select=${encodeURIComponent(EMAIL_SELECT_FIELDS)}` +
      `&$top=${PAGE_SIZE}`;

  let url: string | undefined = initialUrl;
  while (url) {
    const res = await graphFetch<GraphDeltaPage>(url, { headers: PREFER_HEADER });
    const isFinal = !res["@odata.nextLink"] && !!res["@odata.deltaLink"];
    yield { page: res, isFinal };
    url = res["@odata.nextLink"];
  }
}

/** Exported for test re-export and type-only consumers. */
export type { GraphDeltaPage };
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "emails\.ts" | head -10`
Expected: No errors on emails.ts.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): fetchEmailDelta generator

Per-folder Graph delta pagination as an async generator. Uses the
stored cursor if present, else bootstraps from receivedDateTime >=
sinceIso. Requests plain-text bodies via Prefer header so our filter
and extractors never see HTML.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Behavioral hints helper

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append)

- [ ] **Step 1: Append helper**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
import type { BehavioralHints } from "./email-types";
import { domainIsLargeCreBroker } from "./email-filter";

/**
 * Compute behavioral hints for the filter context. These influence Layer A's
 * known-counterparty rule and are stored on uncertain rows as hints for the
 * future classifier spec.
 *
 * All queries are scoped to the single sender + conversation under test, so
 * they are cheap per-message.
 */
export async function computeBehavioralHints(
  senderAddress: string,
  conversationId: string | undefined,
): Promise<BehavioralHints> {
  const senderDomain = senderAddress.includes("@")
    ? senderAddress.split("@")[1]
    : undefined;

  const [contactRow, outboundCount, threadSize] = await Promise.all([
    senderAddress
      ? db.contact.findFirst({
          where: { email: { equals: senderAddress, mode: "insensitive" } },
          select: { id: true },
        })
      : Promise.resolve(null),
    senderAddress
      ? db.communication.count({
          where: {
            direction: "outbound",
            metadata: {
              path: ["toRecipients"],
              array_contains: [{ emailAddress: { address: senderAddress } }],
            },
          },
        })
      : Promise.resolve(0),
    conversationId
      ? db.communication.count({
          where: { metadata: { path: ["conversationId"], equals: conversationId } },
        })
      : Promise.resolve(0),
  ]);

  return {
    senderInContacts: !!contactRow,
    mattRepliedBefore: outboundCount > 0,
    threadSize: threadSize + 1,
    domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "emails\.ts" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): computeBehavioralHints per-message

Three cheap DB queries per message (contact lookup, outbound count,
thread size) that feed the filter context. Used to power the Layer A
known-counterparty rule and stored on uncertain rows for a later
classifier spec to consume.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Lead contact upsert helper

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append `upsertLeadContact`)

- [ ] **Step 1: Append helper**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
import type { LeadSource, Prisma } from ".prisma/client";
import type { InquirerInfo } from "./email-extractors";

export interface UpsertLeadContactInput {
  inquirer: InquirerInfo;
  leadSource: LeadSource;
  leadAt: Date;
}

export interface UpsertLeadContactResult {
  contactId: string;
  created: boolean;
  becameLead: boolean;
}

/**
 * Create or update a Contact from an extracted lead inquirer.
 *
 * Rules:
 * - Requires inquirer.email (we key on normalized email).
 * - New Contact → created with leadSource, leadStatus=new, leadAt.
 * - Existing Contact with NO deals AND null leadSource → fill in lead fields.
 * - Existing Contact with deals (i.e. already a Client) → leave lead fields null.
 * - Existing Contact already a lead (leadSource set) → do not touch leadStatus/leadAt.
 * - Runs inside a transaction; safe to re-call on duplicate inquirer emails.
 */
export async function upsertLeadContact(
  input: UpsertLeadContactInput,
  tx?: Prisma.TransactionClient,
): Promise<UpsertLeadContactResult | null> {
  if (!input.inquirer.email) return null;
  const client = tx ?? db;
  const email = input.inquirer.email.toLowerCase();

  const existing = await client.contact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { _count: { select: { deals: true } } },
  });

  if (!existing) {
    const created = await client.contact.create({
      data: {
        name: input.inquirer.name ?? input.inquirer.email,
        email,
        phone: input.inquirer.phone ?? null,
        company: input.inquirer.company ?? null,
        notes: input.inquirer.message ?? null,
        category: "business",
        tags: [],
        createdBy: `msgraph-email-${input.leadSource}-extract`,
        leadSource: input.leadSource,
        leadStatus: "new",
        leadAt: input.leadAt,
      },
      select: { id: true },
    });
    return { contactId: created.id, created: true, becameLead: true };
  }

  const isClient = existing._count.deals > 0;
  const alreadyLead = existing.leadSource !== null;

  if (isClient || alreadyLead) {
    return { contactId: existing.id, created: false, becameLead: false };
  }

  await client.contact.update({
    where: { id: existing.id },
    data: {
      leadSource: input.leadSource,
      leadStatus: "new",
      leadAt: input.leadAt,
      // Only fill missing demographic fields; never overwrite what Matt curated.
      phone: existing.phone ?? input.inquirer.phone ?? null,
      company: existing.company ?? input.inquirer.company ?? null,
    },
  });
  return { contactId: existing.id, created: false, becameLead: true };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep -E "emails\.ts" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): upsertLeadContact

Creates or updates a Contact from an extracted lead inquirer. Respects
existing state: Contacts that already have Deals stay Clients (no lead
fields set); Contacts that are already leads are not re-stamped; only
net-new people and bare not-yet-lead Contacts get the lead badge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Attachment metadata fetcher + Communication writer

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append)

- [ ] **Step 1: Append helpers**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
import type {
  ClassificationResult,
  GraphEmailMessage,
  EmailClassification,
} from "./email-types";
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
  type CrexiLeadExtract,
  type LoopNetLeadExtract,
  type BuildoutEventExtract,
} from "./email-extractors";
import { normalizeSenderAddress } from "./sender-normalize";
import type { NormalizedSender } from "./sender-normalize";

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  contentType: string;
}

/** Fetches attachment metadata (not binary) for a single message. */
export async function fetchAttachmentMeta(
  targetUpn: string,
  messageId: string,
): Promise<AttachmentMeta[]> {
  const path =
    `/users/${encodeURIComponent(targetUpn)}/messages/${encodeURIComponent(messageId)}/attachments` +
    `?$select=id,name,size,contentType`;
  try {
    const res = await graphFetch<{ value: AttachmentMeta[] }>(path);
    return res.value ?? [];
  } catch (err) {
    if (err instanceof GraphError) return [];
    throw err;
  }
}

export type ExtractedData =
  | ({ platform: "crexi" } & CrexiLeadExtract)
  | ({ platform: "loopnet" } & LoopNetLeadExtract)
  | ({ platform: "buildout" } & BuildoutEventExtract);

/** Route a signal message to the right extractor (if any) based on its source. */
export function runExtractor(
  result: ClassificationResult,
  message: GraphEmailMessage,
): ExtractedData | null {
  const input = {
    subject: message.subject ?? null,
    bodyText: message.body?.content ?? "",
  };
  switch (result.source) {
    case "crexi-lead": {
      const r = extractCrexiLead(input);
      return r ? { platform: "crexi", ...r } : null;
    }
    case "loopnet-lead": {
      const r = extractLoopNetLead(input);
      return r ? { platform: "loopnet", ...r } : null;
    }
    case "buildout-event": {
      const r = extractBuildoutEvent(input);
      return r ? { platform: "buildout", ...r } : null;
    }
    default:
      return null;
  }
}

export interface ProcessedMessage {
  message: GraphEmailMessage;
  folder: EmailFolder;
  normalizedSender: NormalizedSender;
  classification: ClassificationResult;
  extracted: ExtractedData | null;
  attachments: AttachmentMeta[] | undefined;
  contactId: string | null;
  leadContactId: string | null;
  leadCreated: boolean;
}

/** Persist one processed message as a Communication + ExternalSync pair, in a txn. */
export async function persistMessage(
  p: ProcessedMessage,
): Promise<{ inserted: boolean }> {
  const direction = p.folder === "inbox" ? "inbound" : "outbound";
  const storeBody = p.classification.classification !== "noise";
  const dateIso =
    p.folder === "sentitems"
      ? p.message.sentDateTime ?? p.message.receivedDateTime
      : p.message.receivedDateTime;
  if (!dateIso) {
    throw new Error(`message ${p.message.id} missing date`);
  }

  // Existence check first — idempotency without relying on unique constraint race.
  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: "msgraph-email", externalId: p.message.id },
    },
    select: { id: true },
  });
  if (existing) return { inserted: false };

  const metadata: Record<string, unknown> = {
    classification: p.classification.classification,
    source: p.classification.source,
    tier1Rule: p.classification.tier1Rule,
    conversationId: p.message.conversationId,
    internetMessageId: p.message.internetMessageId,
    parentFolderId: p.message.parentFolderId,
    from: {
      address: p.normalizedSender.address,
      displayName: p.normalizedSender.displayName,
      isInternal: p.normalizedSender.isInternal,
    },
    toRecipients: p.message.toRecipients ?? [],
    ccRecipients: p.message.ccRecipients ?? [],
    hasAttachments: !!p.message.hasAttachments,
    attachments: p.attachments,
    importance: p.message.importance ?? "normal",
    isRead: !!p.message.isRead,
    senderNormalizationFailed: p.normalizedSender.normalizationFailed || undefined,
    extracted: p.extracted ?? undefined,
    leadContactId: p.leadContactId ?? undefined,
    leadCreated: p.leadCreated || undefined,
  };

  await db.$transaction(async (tx) => {
    const sync = await tx.externalSync.create({
      data: {
        source: "msgraph-email",
        externalId: p.message.id,
        entityType: "communication",
        status: "synced",
        rawData: {
          folder: p.folder,
          graphSnapshot: p.message as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
    const comm = await tx.communication.create({
      data: {
        channel: "email",
        subject: p.message.subject ?? null,
        body: storeBody ? p.message.body?.content ?? null : null,
        date: new Date(dateIso),
        direction,
        category: "business",
        externalMessageId: p.message.id,
        externalSyncId: sync.id,
        contactId: p.contactId,
        createdBy: "msgraph-email",
        tags: [],
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await tx.externalSync.update({
      where: { id: sync.id },
      data: { entityId: comm.id },
    });
  });

  return { inserted: true };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "emails\.ts" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): fetchAttachmentMeta + runExtractor + persistMessage

Attachment metadata fetch (best-effort, swallows GraphError since
attachments are not worth failing a message over). Extractor dispatch
based on classification source. persistMessage writes the
Communication + ExternalSync pair transactionally with idempotent
existence check, noise rows get null body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Per-message processor with retry

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append)

- [ ] **Step 1: Append processor**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
interface ProcessMessageSummary {
  classification: EmailClassification;
  extractedPlatform: "crexi" | "loopnet" | "buildout" | null;
  contactCreated: boolean;
  leadCreated: boolean;
  inserted: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Process a single Graph message end-to-end: normalize sender, compute hints,
 * classify, optionally run extractor + upsert lead Contact, fetch attachment
 * metadata for signal rows, persist. Three attempts on transient errors.
 */
export async function processOneMessage(
  message: GraphEmailMessage & { "@removed"?: { reason: string } },
  folder: EmailFolder,
): Promise<ProcessMessageSummary> {
  const cfg = loadMsgraphConfig();

  // Graph delta occasionally returns @removed tombstones — skip them.
  if (message["@removed"]) {
    return {
      classification: "noise",
      extractedPlatform: null,
      contactCreated: false,
      leadCreated: false,
      inserted: false,
    };
  }

  const normalizedSender = normalizeSenderAddress(
    message.from ?? message.sender ?? null,
    cfg.targetUpn,
  );

  const hints = await computeBehavioralHints(
    normalizedSender.address,
    message.conversationId,
  );

  const classification = classifyEmail(message, {
    folder,
    targetUpn: cfg.targetUpn,
    normalizedSender,
    hints,
  });

  const extracted =
    classification.classification === "signal"
      ? runExtractor(classification, message)
      : null;

  // Lead contact upsert (before Communication insert so contactId can point at it).
  let leadContactId: string | null = null;
  let leadCreated = false;
  let contactId: string | null = null;
  if (
    extracted &&
    "inquirer" in extracted &&
    extracted.inquirer?.email
  ) {
    const sourceMap: Record<"crexi" | "loopnet" | "buildout", LeadSource> = {
      crexi: "crexi",
      loopnet: "loopnet",
      buildout: "buildout",
    };
    const res = await upsertLeadContact({
      inquirer: extracted.inquirer,
      leadSource: sourceMap[extracted.platform],
      leadAt: new Date(message.receivedDateTime ?? Date.now()),
    });
    if (res) {
      leadContactId = res.contactId;
      leadCreated = res.created;
      contactId = res.contactId;
    }
  }

  // If no extractor lead, try to resolve Contact by the normalized sender email.
  if (!contactId && normalizedSender.address.includes("@")) {
    const match = await db.contact.findFirst({
      where: {
        email: { equals: normalizedSender.address, mode: "insensitive" },
      },
      select: { id: true },
    });
    contactId = match?.id ?? null;
  }

  // Attachment metadata — only for signal rows with attachments.
  let attachments: AttachmentMeta[] | undefined;
  if (
    classification.classification === "signal" &&
    message.hasAttachments &&
    !!message.id
  ) {
    attachments = await fetchAttachmentMeta(cfg.targetUpn, message.id);
  }

  // Persist with retry.
  const backoffs = [50, 200, 800];
  let lastError: unknown;
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    try {
      const { inserted } = await persistMessage({
        message,
        folder,
        normalizedSender,
        classification,
        extracted,
        attachments,
        contactId,
        leadContactId,
        leadCreated,
      });
      return {
        classification: classification.classification,
        extractedPlatform: extracted?.platform ?? null,
        contactCreated: leadCreated,
        leadCreated,
        inserted,
      };
    } catch (err) {
      lastError = err;
      if (attempt < backoffs.length - 1) {
        await sleep(backoffs[attempt]);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "emails\.ts" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): processOneMessage per-message orchestrator

Normalize sender → compute hints → classify → optional extractor +
lead upsert → attachment metadata for signal rows → transactional
persist with three-attempt retry (50/200/800ms backoff). Skips Graph
@removed tombstones as no-ops.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: syncEmails top-level orchestrator

**Files:**
- Modify: `full-kit/src/lib/msgraph/emails.ts` (append)

- [ ] **Step 1: Append top-level orchestrator**

Append to `full-kit/src/lib/msgraph/emails.ts`:

```ts
export interface SyncEmailOptions {
  daysBack?: number;
  forceBootstrap?: boolean;
}

export interface FolderSyncSummary {
  created: number;
  updated: number;
  classification: { signal: number; noise: number; uncertain: number };
  platformExtracted: { crexiLead: number; loopnetLead: number; buildoutEvent: number };
  errors: Array<{ graphId: string; message: string; attempts: number }>;
}

export interface SyncEmailResult {
  isBootstrap: boolean;
  bootstrapReason?: "no-cursor" | "delta-expired" | "forced";
  skippedLocked: boolean;
  perFolder: Record<EmailFolder, FolderSyncSummary>;
  contactsCreated: number;
  leadsCreated: number;
  durationMs: number;
  cursorAdvanced: boolean;
}

const ADVISORY_LOCK_KEY = "msgraph-email";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function emptyFolderSummary(): FolderSyncSummary {
  return {
    created: 0,
    updated: 0,
    classification: { signal: 0, noise: 0, uncertain: 0 },
    platformExtracted: { crexiLead: 0, loopnetLead: 0, buildoutEvent: 0 },
    errors: [],
  };
}

function emptyResult(skippedLocked: boolean, durationMs: number): SyncEmailResult {
  return {
    isBootstrap: false,
    skippedLocked,
    perFolder: { inbox: emptyFolderSummary(), sentitems: emptyFolderSummary() },
    contactsCreated: 0,
    leadsCreated: 0,
    durationMs,
    cursorAdvanced: false,
  };
}

async function tryAdvisoryLock(): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ got: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${ADVISORY_LOCK_KEY})) AS got
  `;
  return !!rows[0]?.got;
}

async function releaseAdvisoryLock(): Promise<void> {
  await db.$queryRaw`
    SELECT pg_advisory_unlock(hashtext(${ADVISORY_LOCK_KEY}))
  `;
}

export async function syncEmails(
  options: SyncEmailOptions = {},
): Promise<SyncEmailResult> {
  const t0 = Date.now();
  const daysBack = options.daysBack ?? 90;
  const sinceIso = new Date(Date.now() - daysBack * MS_PER_DAY).toISOString();

  const locked = await tryAdvisoryLock();
  if (!locked) {
    return emptyResult(true, Date.now() - t0);
  }

  try {
    if (options.forceBootstrap) {
      await deleteEmailCursor("inbox");
      await deleteEmailCursor("sentitems");
    }

    const inboxHadCursor = !!(await loadEmailCursor("inbox"));
    const sentHadCursor = !!(await loadEmailCursor("sentitems"));
    const isBootstrap = !inboxHadCursor || !sentHadCursor;

    let contactsCreated = 0;
    let leadsCreated = 0;
    let deltaExpiredSomewhere = false;

    const result: SyncEmailResult = {
      isBootstrap,
      bootstrapReason: options.forceBootstrap
        ? "forced"
        : isBootstrap
          ? "no-cursor"
          : undefined,
      skippedLocked: false,
      perFolder: { inbox: emptyFolderSummary(), sentitems: emptyFolderSummary() },
      contactsCreated: 0,
      leadsCreated: 0,
      durationMs: 0,
      cursorAdvanced: false,
    };

    const folders: EmailFolder[] = ["inbox", "sentitems"];
    let cursorAdvanced = true;

    for (const folder of folders) {
      const summary = result.perFolder[folder];
      let finalDeltaLink: string | undefined;
      try {
        for await (const { page } of fetchEmailDelta(folder, sinceIso)) {
          for (const rawMsg of page.value) {
            try {
              const res = await processOneMessage(rawMsg, folder);
              summary.classification[res.classification]++;
              if (res.inserted) summary.created++;
              if (res.extractedPlatform === "crexi") summary.platformExtracted.crexiLead++;
              if (res.extractedPlatform === "loopnet") summary.platformExtracted.loopnetLead++;
              if (res.extractedPlatform === "buildout") summary.platformExtracted.buildoutEvent++;
              if (res.contactCreated) contactsCreated++;
              if (res.leadCreated) leadsCreated++;
            } catch (err) {
              summary.errors.push({
                graphId: rawMsg.id,
                message: err instanceof Error ? err.message : String(err),
                attempts: 3,
              });
              await db.externalSync
                .upsert({
                  where: {
                    source_externalId: {
                      source: "msgraph-email",
                      externalId: rawMsg.id,
                    },
                  },
                  create: {
                    source: "msgraph-email",
                    externalId: rawMsg.id,
                    entityType: "communication",
                    status: "failed",
                    errorMsg:
                      err instanceof Error ? err.message : String(err),
                  },
                  update: {
                    status: "failed",
                    errorMsg:
                      err instanceof Error ? err.message : String(err),
                  },
                })
                .catch(() => {
                  /* best-effort */
                });
            }
          }
          if (page["@odata.deltaLink"]) {
            finalDeltaLink = page["@odata.deltaLink"];
          }
        }
      } catch (err) {
        if (
          err instanceof GraphError &&
          err.status === 410 &&
          /sync\s*state/i.test(err.code ?? "")
        ) {
          await deleteEmailCursor(folder);
          deltaExpiredSomewhere = true;
          cursorAdvanced = false;
          continue;
        }
        throw err;
      }

      if (summary.errors.length === 0 && finalDeltaLink) {
        await saveEmailCursor(folder, finalDeltaLink);
      } else {
        cursorAdvanced = false;
      }
    }

    if (deltaExpiredSomewhere) {
      result.bootstrapReason = "delta-expired";
      result.isBootstrap = true;
    }

    result.contactsCreated = contactsCreated;
    result.leadsCreated = leadsCreated;
    result.cursorAdvanced = cursorAdvanced;
    result.durationMs = Date.now() - t0;
    return result;
  } finally {
    await releaseAdvisoryLock();
  }
}
```

- [ ] **Step 2: Verify full typecheck of the module**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "msgraph/emails" | head -10`
Expected: No errors on emails.ts.

- [ ] **Step 3: Run full msgraph test suite**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/ 2>&1 | tail -15`
Expected: PASS — all existing msgraph tests plus the new filter + extractor + sender-normalize tests.

- [ ] **Step 4: Commit**

```bash
git add full-kit/src/lib/msgraph/emails.ts
git commit -m "feat(msgraph): syncEmails orchestrator with advisory lock

Top-level syncEmails() takes the msgraph-email advisory lock, iterates
inbox and sentitems folders via fetchEmailDelta, dispatches each message
through processOneMessage, and advances each folder's cursor only when
that folder had zero permanent failures. 410 syncState → cursor delete
and bootstrapReason='delta-expired'. Concurrent callers early-return
skippedLocked: true.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Barrel export update

**Files:**
- Modify: `full-kit/src/lib/msgraph/index.ts`

- [ ] **Step 1: Add email exports to barrel**

Modify `full-kit/src/lib/msgraph/index.ts` — append to the end of the file, before the trailing newline:

```ts
export { syncEmails } from "./emails";
export type {
  SyncEmailOptions,
  SyncEmailResult,
  FolderSyncSummary,
} from "./emails";
export { normalizeSenderAddress } from "./sender-normalize";
export type { NormalizedSender } from "./sender-normalize";
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "msgraph/index" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add full-kit/src/lib/msgraph/index.ts
git commit -m "feat(msgraph): export syncEmails + types from barrel

Downstream code (the dev trigger route, and future cron/webhook
wiring) imports through @/lib/msgraph per the boundary rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Gated dev trigger endpoint

**Files:**
- Create: `full-kit/src/app/api/integrations/msgraph/emails/sync/route.ts`

- [ ] **Step 1: Create the route**

Create `full-kit/src/app/api/integrations/msgraph/emails/sync/route.ts`:

```ts
import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  GraphError,
  loadMsgraphConfig,
  syncEmails,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  let config;
  try {
    config = loadMsgraphConfig();
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const daysBackRaw = url.searchParams.get("daysBack");
  const daysBack = daysBackRaw
    ? Math.max(1, Number.parseInt(daysBackRaw, 10) || 90)
    : undefined;
  const forceBootstrap = url.searchParams.get("forceBootstrap") === "true";

  try {
    const result = await syncEmails({ daysBack, forceBootstrap });
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

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd full-kit && pnpm exec tsc --noEmit 2>&1 | grep "emails/sync" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "full-kit/src/app/api/integrations/msgraph/emails/sync/route.ts"
git commit -m "feat(msgraph): gated POST /api/integrations/msgraph/emails/sync endpoint

Dev trigger for syncEmails(). Same defense-in-depth pattern as the
contacts sync route: kill switch on MSGRAPH_TEST_ROUTE_ENABLED,
constant-time admin-token compare, 405 on non-POST. Accepts
?daysBack=N and ?forceBootstrap=true query params.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: End-to-end verification checklist

No code — this is a manual verification pass against the live Graph + DB to confirm the pipeline works before handing off. Each bullet is a runnable check.

- [ ] **Step 1: Sanity-check typecheck and unit tests pass on main**

Run: `cd full-kit && pnpm exec vitest run src/lib/msgraph/ 2>&1 | tail -3`
Expected: All tests pass.

- [ ] **Step 2: Start dev server and hit the endpoint, small window**

Terminal A: `cd full-kit && pnpm dev`
Terminal B (once dev server is Ready):
```bash
cd full-kit
TOKEN=$(grep '^MSGRAPH_TEST_ADMIN_TOKEN=' .env.local | cut -d= -f2-)
curl -X POST -s --max-time 900 \
  -H "x-admin-token: $TOKEN" \
  "http://localhost:3000/api/integrations/msgraph/emails/sync?daysBack=7" \
  -o /tmp/email-sync-7day.json
cat /tmp/email-sync-7day.json | head -c 2000
```

Expected: `ok: true, isBootstrap: true, perFolder.inbox.created > 0, durationMs` in the low tens of seconds. Examine classification counts — signal + noise + uncertain should sum to the total created per folder.

- [ ] **Step 3: Verify idempotency — second run is fast and no-op**

```bash
curl -X POST -s -H "x-admin-token: $TOKEN" \
  "http://localhost:3000/api/integrations/msgraph/emails/sync" \
  | jq '.isBootstrap, .perFolder.inbox.created, .durationMs'
```
Expected: `false, 0, <2000ms`.

- [ ] **Step 4: Query DB to verify data integrity**

```sql
-- Classification totals (Supabase SQL editor or psql)
SELECT metadata->>'classification' AS cls, COUNT(*)
FROM communications
WHERE created_by = 'msgraph-email'
GROUP BY 1;

-- Any failed rows?
SELECT COUNT(*) FROM external_sync
WHERE source = 'msgraph-email' AND status = 'failed';

-- Leads created?
SELECT lead_source, COUNT(*)
FROM contacts
WHERE created_by LIKE 'msgraph-email-%-extract'
GROUP BY 1;

-- Sample a Crexi lead row and verify extracted metadata is populated
SELECT metadata->'extracted'
FROM communications
WHERE metadata->>'source' = 'crexi-lead'
LIMIT 3;
```

Expected: counts match the API response summary; no `failed` rows unless a specific Graph message throws; any `extracted` JSON shows the right `platform` and `kind` fields.

- [ ] **Step 5: Full 90-day bootstrap**

```bash
# Reset cursors and run the full 90-day window
curl -X POST -s --max-time 900 \
  -H "x-admin-token: $TOKEN" \
  "http://localhost:3000/api/integrations/msgraph/emails/sync?daysBack=90&forceBootstrap=true" \
  -o /tmp/email-sync-90day.json
cat /tmp/email-sync-90day.json | jq '.perFolder, .contactsCreated, .leadsCreated, .durationMs'
```

Expected: `perFolder.inbox.created` in the low tens of thousands, `leadsCreated > 0`, runtime 3–8 minutes.

- [ ] **Step 6: Spot-check the Focused/Other leak thesis**

Query rows tagged as crexi-lead where no outbound follow-up exists in the same conversation:

```sql
WITH leads AS (
  SELECT c.id, c.metadata->>'conversationId' AS conv, c.date
  FROM communications c
  WHERE c.metadata->>'source' = 'crexi-lead'
)
SELECT COUNT(*) AS unanswered_crexi_leads
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM communications r
  WHERE r.direction = 'outbound'
    AND r.metadata->>'conversationId' = l.conv
);
```

Expected: count > 0 validates the missed-deals hypothesis. These rows are the seed for the follow-up missed-deals surfacer spec.

- [ ] **Step 7: Commit verification notes back to the repo (no code)**

Write a one-page `recon-output/post-sync-verification-2026-04-23.md` summarizing:
- Total messages ingested per folder
- Classification breakdown
- Leads created per platform
- Any failed rows + their graph IDs
- The unanswered-crexi-leads count

```bash
git add full-kit/recon-output/post-sync-verification-*.md
git commit -m "docs(recon): post-email-ingestion-sync verification snapshot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Spec-coverage self-review

Each spec section → implementing task(s):

| Spec section | Implemented by |
|---|---|
| Schema changes (LeadSource/LeadStatus/Contact fields) | Task 1 |
| File layout | Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 |
| Public API (`syncEmails`, `SyncEmailResult`) | Task 15, 16 |
| Graph queries ($select + Prefer header + per-folder delta) | Task 10 |
| Sender identity normalization | Task 2 |
| Layer A auto-signal allowlist | Task 5 |
| Layer B hard-drop noise | Tasks 4, 5 |
| Layer C uncertain fallback | Task 5 |
| Crexi extractor | Task 6 |
| LoopNet extractor | Task 7 |
| Buildout event extractor | Task 8 |
| Communication row shape | Task 13 |
| Attachment metadata capture | Task 13 (`fetchAttachmentMeta`) |
| Concurrency (advisory lock, per-message transaction) | Tasks 13, 15 |
| Per-message retry + conditional cursor advance | Tasks 14, 15 |
| Dev trigger endpoint | Task 17 |
| Error handling | Tasks 10, 14, 15, 17 |
| Unit tests | Tasks 2, 4, 5, 6, 7, 8 |
| Integration test | Task 18 |
