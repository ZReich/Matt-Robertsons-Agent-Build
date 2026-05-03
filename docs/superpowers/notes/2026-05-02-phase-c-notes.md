# Phase C — Role lifecycle (past-client split) + Phase E PendingReply dedupe index

Date: 2026-05-02
Branch: `main`

## What landed

1. Schema: two new `ClientType` enum values (`past_listing_client`,
   `past_buyer_client`); legacy `past_client` preserved for backward
   compatibility during the rollout window.
2. Schema: partial unique index `pending_replies_dedupe_uidx` on
   `pending_replies (trigger_communication_id, contact_id, property_id)`
   where all three are non-null. This was the deferred Phase E race-fix.
3. New pure helper `src/lib/contacts/role-lifecycle.ts::nextClientType` plus
   14-case test table.
4. `syncContactRoleFromDeals` now imports `nextClientType` (single source of
   truth — no parallel `applyRoleLifecycle`).
5. Backfill script rewritten with `--apply` / `--migrate-past-client` flags;
   default is dry-run.
6. Schema-drift fix: added `@@index([approvedCommunicationId])` and
   `@@index([leaseRecordId])` on `PendingReply` so the live DB and
   `schema.prisma` agree (these had been created via raw SQL in earlier
   migrations but never declared in the Prisma model).
7. `Clients` page + table updated to recognize `past_listing_client` and
   `past_buyer_client` (label map + REAL_CLIENT_TYPES filter +
   `dealTypesForClient` switch).

## Migration mechanics

- Migration dir: `prisma/migrations/20260503143415_phase_c_role_lifecycle_and_pending_reply_dedupe/`
- Workflow per CLAUDE.md root-of-repo: `migrate diff` → save SQL → `db execute` → `migrate resolve --applied` → `prisma generate`.
- `ALTER TYPE ADD VALUE` runs outside a transaction — used `IF NOT EXISTS`
  guard for idempotency. `db execute` does NOT auto-wrap, so this works.
- Pre-flight duplicate count for the partial unique index was 1 group (2 rows
  with same trigger/contact/property: ids `1263d19f...` pending and
  `2503a682...` dismissed). The migration deletes the older `dismissed` row
  before creating the index — total `pending_replies` rows went 11 → 10.
- `prisma generate` initially blocked by Windows DLL lock from the running
  dev server (PID 90568, port 3000). Worked around by renaming the locked
  DLL out of the way before `generate`, then deleting the rename. Generated
  client types were copied into both `node_modules/.pnpm/...` (the .pnpm
  store) and `node_modules/.prisma/client/` (the public-facing copy) so
  TypeScript resolves correctly from either path.

## Decision: tiebreaker for mixed past-client deals

Most-recent-closed wins. Ties broken by input order (legacy rows missing
`closedAt` sort to the end so they don't outrank rows that have it). No
weighting by deal value or won/lost outcome — kept it simple. Documented
in the function header.

## Decision: `tenant_rep` is buyer-side

Both for active classification (already in place) and for past-client
classification (new): `tenant_rep` → `past_buyer_client`. Matches Matt's
mental model — tenant-rep is service-to-the-buyer-side.

## Decision: outcome doesn't change past-* bucket

A `closed` deal is past-client regardless of `outcome` (`won`, `lost`,
`withdrawn`, `expired`). Outcome detail lives on `Deal.outcome`. Fixes the
buggy old backfill script's `prospect` fallback for closed-but-not-won
deals.

## Backfill counts

Run: `node scripts/backfill-contact-client-type.mjs` (default dry-run).

```
Mode: DRY-RUN | Scope: all non-archived contacts
Inspecting 2993 contacts

Transitions (406 contacts would change):
   205  null → past_buyer_client
   154  null → past_listing_client
    25  null → active_buyer_rep_client
    20  null → active_listing_client
     2  past_client → past_listing_client
```

The 359 `null → past_*_client` transitions reflect the long tail of
contacts whose closed deals predate the role-lifecycle helper landing —
the helper was added but never retrofitted. These are correct fixes, not
errors.

The 45 `null → active_*_client` transitions are similar — they fix
contacts with active deals whose `clientType` was never set.

The 2 `past_client → past_listing_client` transitions are the actual
Phase C work: legacy `past_client` rows promoted to the proper new
variant.

## What was applied vs flagged

- **APPLIED:** the 2 `past_client → past_*_client` transitions
  (`node scripts/backfill-contact-client-type.mjs --migrate-past-client --apply`).
  Both were `seller_rep` closed deals → `past_listing_client`.
- **FLAGGED FOR USER:** the 404 `null → *` transitions. These exceed the
  Phase C plan's < 200 contacts threshold, so I left them dry-run-only
  pending sign-off. Run
  `node scripts/backfill-contact-client-type.mjs --apply` to apply.

## Tests

- `src/lib/contacts/role-lifecycle.test.ts` — 14 cases, all passing.
- `src/lib/contacts/sync-contact-role.test.ts` — extended with 3 new past-
  client transition tests; 10 cases total, all passing.
- Full suite: 891 passed, 1 skipped, 0 failures. tsc clean.

## Open / punted

- `null → *` mass classification (404 contacts) deferred to user approval —
  see "What was applied vs flagged" above.
- `past_client` enum value preserved (not removed) — defer removal to a
  future cleanup migration once production has had time to settle and we
  can confirm zero remaining rows. Removal would require a
  `ALTER TYPE ... DROP VALUE` (non-trivial — Postgres doesn't support it
  directly; would need rename/recreate).
- One partial-unique-index edge case to flag: the constraint is global
  across all PendingReply rows regardless of status. So if a row is
  `dismissed`, a new `pending` row with the same trigger/contact/property
  would be blocked. The dedupe helper (`enforcePendingReplyDedupe` from
  Phase E) handles this in app code by checking for existing rows with
  the same key — but if a parallel writer races past it, the unique index
  will block the second write at the DB layer. That's the intended
  behavior. If we ever need "allow re-draft after dismiss" we'd scope
  the index `WHERE status IN ('pending', 'approved')` instead.
