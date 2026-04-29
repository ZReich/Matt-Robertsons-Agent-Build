# Data retention policy

This document records retention windows for sensitive coverage and email data
stored by the full-kit. Operators are responsible for running the retention
helpers on a schedule that matches their compliance requirements; nothing
auto-runs in production today.

## Why this exists

Phase 7 of the coverage relationship follow-ups RAL plan
(`.omx/plans/coverage-relationship-followups-ralplan.md`) requires that
long-term privacy and operational risk be reduced by:

- enforcing retention windows on raw mailbox content and audit artifacts;
- preserving aggregate counts after sensitive fields are deleted/anonymized;
- making batch action history inspectable without leaking message content.

Each section below names the table, the kind of data stored, the retention
window, and the helper or migration that enforces it.

## Policies

### Raw email body retention — `email_raw_body_retention`

- **What it stores:** raw and redacted message bodies pulled from Microsoft
  Graph during scrub/backfill. Already includes `raw_body_retention_expires_at`
  per row, populated at write time from the active scrub policy.
- **Retention window:** governed per row by
  `raw_body_retention_expires_at` (typically 30 days for raw, 90 days for
  redacted bodies). The retention sweeper for this table is owned by the
  scrub pipeline and is out of scope for the coverage observability helpers.
- **What MUST be cleared on expiry:** `redacted_body`, plus any storage
  pointer the row holds. Aggregate counts (`body_length`, classification
  outcomes captured in `email_filter_audits`) are preserved.

### Email filter audit samples — `email_filter_audits`

- **What it stores:** per-message classifier decisions plus optional sample
  artifacts attached to flagged decisions.
- **Retention window:** sample artifacts older than **90 days** must be
  deleted; the row itself is preserved so promotion/demotion counts remain
  accurate. Sample artifact retention is owned by the email filter team
  (separate playbook); coverage observability does not delete these rows.

### Operational review rows — `operational_email_reviews`

- **What it stores:** drilldown review items including operator notes,
  evidence snippets, and minimized metadata.
- **Retention window:** **90 days** after `created_at` for terminal rows
  (`status` in `resolved`, `ignored`, `snoozed`). Open rows are retained
  indefinitely so reviewers can act on them.
- **Anonymization (preferred over delete):** `operator_notes` is cleared,
  `metadata.evidenceSnippets` is dropped, and `metadata` is replaced with a
  minimal aggregate snapshot (`type`, `status`, `policyVersion`,
  `retainedAt`). Aggregate counts in
  `getCoverageObservabilityCounters` continue to work because the row's
  `type`, `status`, `operator_outcome`, `created_at`, and `resolved_at`
  fields remain intact.
- **Helper:** `retainCoverageReviewRows({ olderThanDays, status, batchSize })`
  in `src/lib/coverage/coverage-observability.ts`. Defaults to 90 days and
  the three terminal statuses listed above.

### Profile fact evidence — `contact_profile_facts.metadata.evidence`

- **What it stores:** short evidence snippets attached to auto-derived
  profile facts (e.g. quoted phrases that justified a fact).
- **Retention window:** evidence snippets MUST be retained no longer than the
  parent fact's `expiresAt`. Facts with no `expiresAt` retain evidence as
  long as the fact remains `status='active'`. Facts that move to
  `status='dropped'` (handled by future curation) MUST have evidence cleared
  on the same write.
- **Anonymization:** evidence snippets are removed from `metadata`; the rest
  of the row (category, normalizedKey, confidence, sourceCommunicationId)
  remains so saved/reviewed/dropped counters keep working.
- **Helper:** evidence pruning is owned by the profile-fact curation lane
  (not in this commit). Document it here so the policy is discoverable.

### Coverage action audit log — `coverage_action_audit_logs`

- **What it stores:** aggregate audit rows for every reviewer-driven
  coverage mutation. Fields: `actor` (reviewer label), `action`, `runId`,
  `dryRun`, `policyVersion`, `reviewItemIds` (≤ 100 ids), `outcomeSummary`,
  `createdAt`. **No raw email bodies, recipients, Graph IDs,
  `internetMessageId`, or operator notes are written into this table.**
- **Retention window:** raw rows kept **90 days** after `createdAt`. After
  that, the row is anonymized in place: `actor` is replaced with
  `anon:<short-hash>`, `actor_hash` records the full SHA-256 of the
  original actor, `review_item_ids` is cleared to an empty array, and
  `anonymized_at` is stamped. Aggregate counts (`outcomeSummary`,
  `dryRun`, `runId`, `policyVersion`, `createdAt`) remain unchanged.
- **Helper:** `retainCoverageActionAuditLog({ olderThanDays, batchSize })`
  in `src/lib/coverage/coverage-observability.ts`.

## Operations

Retention sweeps are NOT auto-run by the harness today. To enforce a window
manually:

```ts
import {
  retainCoverageReviewRows,
  retainCoverageActionAuditLog,
} from "@/lib/coverage/coverage-observability"

await retainCoverageReviewRows({ olderThanDays: 90, batchSize: 500 })
await retainCoverageActionAuditLog({ olderThanDays: 90, batchSize: 500 })
```

Each helper returns the number of rows scanned and the number of rows
anonymized. Both helpers leave newer rows untouched and only act on rows
older than the boundary.

## Counters preserved after retention

After a retention sweep, the following counters in
`getCoverageObservabilityCounters` remain accurate:

- drilldown rows by type (open rows are never retained);
- reviewed `true_noise` and `false_negative` rates (status + outcome
  preserved);
- pending mark-done proposals (lives on `agent_actions`, untouched);
- duplicate contact blocks (lives on `contact_promotion_candidates`,
  untouched);
- profile facts saved/reviewed/dropped (status preserved; only evidence
  text is cleared).
