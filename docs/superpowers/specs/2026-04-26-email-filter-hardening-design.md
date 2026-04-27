# Email Filter Hardening Design

Date: 2026-04-26
Status: Ralplan approved for execution handoff
Related PRD: `.omx/plans/prd-email-filter-hardening.md`
Related test spec: `.omx/plans/test-spec-email-filter-hardening.md`
Related context: `.omx/context/email-filter-hardening-20260426T015302Z.md`

## Executive summary

Do not run another large Outlook pull with the current assumption that `noise` equals safe to skip. The current filter is useful for post-ingestion classification, but not yet safe for metadata-first body skip or full-year rollout. The next implementation must separate:

1. **classification**: signal / uncertain / noise, and
2. **acquisition/body decision**: fetch body / metadata-only quarantine / safe body skip.

Phase 1 must observe, quarantine, and audit only. Exact safe skips can be promoted later, after sample review proves zero critical false negatives.

## Current risk in plain English

The existing filters are trying to do the right thing: avoid thousands of listing blasts and marketing emails. But the same mailbox has real business inside noisy-looking channels. Large brokerage domains, marketing-system headers, and direct-to-Matt listing blasts are too tangled to trust broad rules without audit.

The live diagnostic showed that current noise is dominated by:

- List-Unsubscribe: 6,420 rows.
- Domain drops: 4,133 rows.
- Sender drops: 2,616 rows.
- Automated local part drops: 683 rows.

Those categories must be sampled and rule-reviewed before becoming pre-download skips.

## Design decisions

### 1. Classifier/body decision split

`classifyEmail()` may still classify messages, but a new evaluator must decide body acquisition. Body acquisition depends on rule registry state, risk flags, rescue flags, current phase, and stop gates.

### 2. Raw body retention/redaction

Current code may retain full body in `ExternalSync.rawData.graphSnapshot` even when `Communication.body` is null. This must be fixed before claiming body-storage savings or safe privacy posture.

Policy:

- Store raw body only in restricted storage with TTL when needed.
- Store redacted audit artifact for review. Treat `bodyPreview` as body-derived sensitive content, not harmless metadata; prune or redact it anywhere full body would be pruned or redacted.
- Store hash/length/content type/redaction status.
- Remove/prune full body from unrestricted raw snapshots when policy says redacted.

### 3. Hybrid registry

Code seed + DB runtime.

- Code: types, fixtures, defaults, emergency disabled defaults.
- DB: enablement, rollout state, owner, evidence, approval, counters, review history.

### 4. Cursor safety

A Microsoft Graph cursor is not committed until every message in the chunk has durable terminal state. If body fetch/audit/quarantine persistence fails, retry from prior cursor.

### 5. Full-year rollout

The 365-day pull is chunked, with review after each chunk. No single unbounded yearly run.

## Minimum implementation path

1. Add schema for rule/run/chunk/audit/body-retention/cursor state.
2. Add evaluator types and rule registry seed.
3. Add raw snapshot pruning/redaction helpers.
4. Add run/chunk/audit persistence.
5. Modify Graph sync to support metadata-stage and targeted body-stage fetch.
6. Add dry-run/filter-audit route.
7. Add stop gates and reports.
8. Only after dry-run/canary, promote exact safe rules.

## Specific risky areas to fix

### Mixed CRE/broker domains

Never blanket body-skip domains like:

- CBRE.
- Cushman/Cushwake.
- JLL.
- Colliers.
- Marcus & Millichap.
- Sands.
- Newmark.
- SRS.
- SIOR-like domains.
- NAI-related domains.

They may classify as likely noise only when exact sender/pattern evidence exists, but skip promotion requires sample proof.

### List-Unsubscribe

May suggest bulk mail. It cannot alone safe-skip risky contexts.

Rescue if:

- known Contact.
- Matt replied before.
- NAI/internal direct context.
- attachment/deal document indicators.
- platform lead pattern.
- referral/deal/property/action keywords.
- mixed CRE/broker domain.

### Platform emails

Crexi/LoopNet/Buildout/DocuSign/Dotloop must be split into lead/deal/doc signal, listing/recommendation noise, or uncertain platform notification. Ambiguous platform mail is not skipped.

## Operational modes

- `dry_run`: evaluate and report only.
- `observe`: persist observations and audit records.
- `quarantine_only`: create recoverable quarantine decisions.
- `promoted_rules_limited`: apply exact promoted rules to a small canary.
- `active`: only after gates pass.

## API shape

Preferred route:

```http
POST /api/integrations/email-backfill/filter-audit
```

Request:

```json
{
  "mode": "dry_run",
  "daysBack": 90,
  "dateFrom": null,
  "dateTo": null,
  "folderScope": ["inbox", "sentitems"],
  "chunkSize": 250,
  "maxMessages": 2000,
  "ruleSetVersion": "observe-2026-04-26",
  "fetchBodies": "candidate_only",
  "quarantineEnabled": false
}
```

Response includes `runId`, chunk summaries, counts, stop gate results, and sample buckets.

## Required reports

Every run must report:

- counts by classification.
- counts by body decision.
- counts by rule version.
- top senders/domains/subjects for proposed skip/quarantine.
- rescue flags.
- body fetch failures.
- Graph throttling/retry counts.
- stop gate status.
- sample review status.

## Security/privacy notes

Email bodies are sensitive. The plan must avoid both extremes:

- retaining all private bodies forever in raw snapshots, and
- dropping bodies before we can prove filter correctness.

The compromise is restricted raw retention with TTL plus redacted audit artifacts.

## Implementation handoff lanes

### Ralph lane

Use if implementing sequentially:

1. Schema/audit contract.
2. Evaluator/registry.
3. Graph two-stage fetch.
4. Route/reporting.
5. Tests/verification.

### Team lane

Use if parallelizing:

- Lane A: schema + persistence.
- Lane B: evaluator + registry.
- Lane C: Graph acquisition/cursor safety.
- Lane D: redaction + audit reports.
- Lane E: tests + verification.

## Final guardrails

- Do not run another 90-day pull with unaudited body skips.
- Do not run the 365-day pull until 90-day dry-run/canary gates pass.
- Do not promote any exact skip rule without sample evidence and owner approval.
- Do not allow DB runtime rule changes to affect an active chunk; pin rule versions per run.
- Do not advance Graph cursor before chunk terminal state.
