# Lead-derived deals: leads as inquirers, not primary contacts

**Date:** 2026-04-30
**Status:** Approved (design)

## Problem

When an inbound inquiry from Buildout, Crexi, or LoopNet arrives for a property that has no existing seller-rep deal, `upsertDealForLead` ([full-kit/src/lib/deals/lead-to-deal.ts:56](../../../full-kit/src/lib/deals/lead-to-deal.ts:56)) creates a new `Deal` and sets the deal's `contactId` to the inquirer's contact id (e.g., Bethany Nordell, a buyer-side lead). That makes the lead look like the deal's primary contact, even though the deal's *real* primary contact should be the **listing client** — the seller Matt represents — which we don't yet know at inquiry time.

Two downstream effects today:

1. The deal detail page shows the lead as the primary contact.
2. `findRelatedLeadsForDeal` ([full-kit/src/lib/deals/related-leads.ts:203](../../../full-kit/src/lib/deals/related-leads.ts:203)) explicitly excludes the deal's primary contact from the inquirers list (`c.id <> deal.contactId`). The lead therefore never appears as an inquirer either — they're hidden from the very list they belong on.

The same flaw applies to every existing `dealSource = 'lead_derived'` deal in production.

## Goal

Leads are inquirers, full stop. A lead-derived deal that has no known listing client carries a **null** primary contact until Matt (or a future Buildout new-listing event) assigns a real one.

## Design

### 1. Schema: `Deal.contactId` becomes nullable

```prisma
model Deal {
  ...
  contactId String? @map("contact_id")
  ...
  contact   Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)
  ...
}
```

- The existing `@@index([contactId])` is fine with NULL.
- `onDelete` flips from `Restrict` to `SetNull` so deleting a contact who happens to be a deal's primary contact doesn't block the delete and doesn't dangle the FK. (For lead-derived deals this won't fire today — the only contacts that get deleted are leads, who under the new model are no longer the primary contact of any deal.)
- Migration produced via the workflow in `CLAUDE.md`: `prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script` → save → `prisma db execute` → `prisma migrate resolve --applied`.

### 2. `upsertDealForLead`: don't set `contactId` on creation

In the create branch, drop `contactId` from the `data:` object so the new deal is inserted with `contactId = null`. The communication still gets `dealId` set so the inquiry attaches to the deal.

Also remove the `syncContactRoleFromDeals(input.contactId)` calls on **both** the create branch and the "existing deal found" branch. In the new model the lead is never the deal's primary contact, so this deal's existence shouldn't influence the lead's `clientType`. Their `clientType` continues to be driven by deals where they actually *are* the primary contact (which, for a buyer-side lead, would be a future buyer-rep deal — handled by other code paths).

### 3. `findRelatedLeadsForDeal`: null-safe primary-contact exclusion

In the lead arm's `WHERE`, change:

```sql
AND c.id <> ${deal.contactId}
```

to:

```sql
AND (${deal.contactId}::text IS NULL OR c.id <> ${deal.contactId})
```

When the deal has no primary contact, no inquirer is excluded — every lead including the originating inquirer surfaces. When a deal does have a primary contact (a real listing client), they continue to be excluded from inquirers as before.

### 4. UI: handle null primary contact

Surfaces that currently read `deal.contact.<field>` need null handling:

- **Deal detail page** ([deals/[id]/page.tsx](../../../full-kit/src/app/[lang]/(dashboard-layout)/pages/deals/[id]/page.tsx)): the primary-contact card renders a placeholder ("No listing client assigned") instead of contact details. The Inquirers tab is unchanged structurally — it'll just have one more row now.
- **Pipeline Kanban card** ([deals/_components/deal-card.tsx](../../../full-kit/src/app/[lang]/(dashboard-layout)/pages/deals/_components/deal-card.tsx)): where the contact name is shown on the card, render a muted "No listing client" placeholder when `deal.contact` is null.
- **Vault context resolver** ([vault/resolve-context.ts](../../../full-kit/src/lib/vault/resolve-context.ts)): if it dereferences `deal.contact`, gate the dereference on a null check.

The placeholder is intentionally passive (no big call-to-action). When Matt knows the listing client he can assign it from the deal page; otherwise the deal sits with a blank slot until a future Buildout new-listing event populates it.

### 5. Backfill: null out the leads-as-primary-contacts on existing deals

One-shot script at `full-kit/scripts/backfill-lead-derived-deal-contacts.mjs`. Behavior:

1. Find every Deal where `dealSource = 'lead_derived'` AND the joined Contact has `lead_source IS NOT NULL`. The `lead_source` filter is the safety net: if Matt has manually edited a deal to point at a real listing client (whose contact has no `lead_source`), we leave it untouched.
2. For each match, `UPDATE deals SET contact_id = NULL WHERE id = $1`.
3. Collect the distinct contact ids that were unassigned and re-run `syncContactRoleFromDeals` for each so their `clientType` recomputes from their remaining (now-correct) deal history.
4. Print summary: deals scanned, deals nulled, contacts re-synced, contacts whose `clientType` actually changed.

The script is idempotent — running it twice produces no further changes.

### 6. Tests

- **`lead-to-deal.test.ts`**: update the create-branch assertion to expect `dealId` returned and `contactId === null` on the inserted Deal. Drop assertions about `syncContactRoleFromDeals` being called from this path. Existing-deal branch assertions stay the same except for dropping the role-sync expectation.
- **`related-leads.test.ts`** (new test or extend existing): a deal with `contactId: null` returns every matching inquirer; a deal with `contactId` set still excludes that contact from inquirers.
- **`backfill-lead-derived-deal-contacts.test.ts`** (new): seed three deals — (a) lead_derived with a lead-source contact (should null), (b) lead_derived with a non-lead-source contact representing a manually-assigned listing client (should leave alone), (c) non-lead_derived deal (should leave alone). Assert correct rows are nulled and others untouched.

## Out of scope

- Wiring a Buildout "new listing" event into populating `contactId` — separate feature.
- Renaming `contactId` → `listingClientId` schema-wide. Conceptually more accurate but too much surface area for this fix.
- Changes to non-lead-derived deal flows (manual creation via `api/deals/route.ts`, AI agent-action deals via `agent-actions-deal.ts`, buyer-rep deals via `buyer-rep-action.ts`). All of these set `contactId` from real contacts already.

## Risks

- **Tests that assume non-null `deal.contact`**: a quick grep before implementation will catch these. Type-check (`pnpm exec tsc --noEmit`) will surface any remaining null-deref.
- **Backfill mis-targets a manually-curated deal**: the `lead_source IS NOT NULL` filter is the guard. If Matt has assigned a real listing client whose contact happens to also have a `lead_source` (rare — would mean that person was originally captured as a lead and later promoted), the script would still null them. Mitigation: log the contact id and name for every nulled deal before applying, so any false-positive is recoverable from logs.
