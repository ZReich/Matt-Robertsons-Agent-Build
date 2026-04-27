> **Supersession notice (2026-04-26):** Sections below that mention `upsertLeadContact()`, `would_create_lead_contact`, direct Contact creation/update, or setting `Communication.contactId` to a newly created platform lead Contact are superseded by `docs/superpowers/specs/2026-04-26-transcript-email-communication-handling-design.md`. Platform inquirers now create/update `ContactPromotionCandidate` records first; Contacts are created/promoted only after approval.
# Historical Lead Extractor Diagnostics - Design

**Date:** 2026-04-25
**Author:** Zach Reichert (with Codex/Ralplan)
**Status:** Draft for implementation
**Depends on:** [Email Ingestion](2026-04-23-email-ingestion-design.md)
**Related:** [Communication Contact Backfill](2026-04-25-communication-contact-backfill-design.md), [AI Scrub Backfill Orchestration](2026-04-25-email-ai-scrub-backfill-orchestration-design.md)

---

## Problem

Current Supabase recon reports only **1 Contact flagged as a lead** out of 22,597 historical emails. That is suspicious because the ingestion specs expect Crexi, LoopNet, and Buildout lead traffic to create/update `Contact.leadSource`, `leadStatus`, and `leadAt`.

Before spending API money on broad AI scrubbing, we need to know whether:

1. The historical mailbox truly contains almost no platform lead inquiries.
2. The filter layer is misclassifying platform lead emails as `noise` or `uncertain`.
3. The platform source rules are too narrow for real sender/subject variants.
4. Extractors fail because body formats differ from fixtures.
5. Historical `Communication` rows lack body/raw metadata needed for extraction.
6. Lead Contacts were created but not marked with `leadSource`/`leadStatus` due to a backfill gap.

---

## Goals

- Produce a factual diagnostic report explaining the "only 1 lead" result.
- Re-run current filter/extractor code against historical rows without mutating data.
- Capture real anonymized/sanitized fixture shapes for missed Crexi/LoopNet/Buildout patterns.
- Define exactly what needs fixing before scrub backfill runs.
- Add regression tests for every confirmed missed platform pattern.
- Provide a safe reprocess plan to mark/create historical leads once extractor fixes are validated.

## Non-goals

- No broad AI scrub in this diagnostic.
- No automatic Contact creation until diagnostics identify specific extractor fixes and dry-run counts.
- No paid model calls required.
- No manual eyeballing of all 22k emails; use targeted queries and sampled review.

---

## Diagnostic phases

### Phase 1 - platform inventory queries

Create a read-only diagnostic helper:

```txt
full-kit/src/lib/backfill/lead-extractor-diagnostics.ts
full-kit/src/lib/backfill/lead-extractor-diagnostics.test.ts
```

Expose it through a read-only admin route:

`POST /api/integrations/email-backfill/diagnose-leads`

Request:

```json
{
  "limit": 1000,
  "cursor": null,
  "platforms": ["crexi", "loopnet", "buildout"],
  "includeSamples": true,
  "sampleLimitPerBucket": 5,
  "runId": "lead-diagnostic-20260425-001"
}
```

Auth/gates:

- `EMAIL_BACKFILL_ROUTES_ENABLED=true`
- `EMAIL_BACKFILL_ADMIN_TOKEN`
- Always read-only; it must not create/update Contacts, Communications, queue
  rows, or fixture files. Fixture capture is a separate local-dev command or a
  follow-up write-gated route.

Response:

```ts
interface LeadDiagnosticResponse {
  ok: true
  runId: string
  scanned: number
  nextCursor: string | null
  byPlatform: Record<string, number>
  byClassification: Record<string, number>
  byOutcome: Record<LeadDiagnosticOutcome, number>
  topSenderDomains: Array<{ domain: string; count: number }>
  topSubjectBuckets: Array<{ bucket: string; count: number }>
  samples: Array<{
    communicationId: string
    platform: "crexi" | "loopnet" | "buildout"
    outcome: LeadDiagnosticOutcome
    subjectRedacted: string
    senderDomain: string
    hasBody: boolean
    wouldCreateOrUpdateContact: boolean
  }>
}
```

It reports counts by:

- `metadata.classification`
- `metadata.source`
- sender email/domain from `metadata.from.address`
- subject regex buckets for known platform phrases
- `body IS NULL` / body length buckets
- `metadata.extracted.platform` and `metadata.leadContactId` when present
- created/updated contacts with `createdBy LIKE 'msgraph-email-%-extract'`

Known platform searches:

- Crexi sender/domain variants containing `crexi.com`, with special attention to:
  - `emails@notifications.crexi.com`
  - `notifications@crexi.com`
  - `emails@pro.crexi.com`
  - `emails@search.crexi.com`
- LoopNet sender variants containing `loopnet.com`, especially `leads@loopnet.com`.
- Buildout sender variants containing `buildout.com`, especially `support@buildout.com` and notification/no-reply variants.

Subject bucket examples:

- `new leads? found for`
- `requesting information on`
- `you have new leads to be contacted`
- `loopnet lead for`
- `favorited`
- `a new lead has been added`
- `deal stage updated on`
- `you've been assigned a task`
- `critical date`
- `ca executed`

### Phase 2 - replay current code against stored rows

For candidate platform rows, replay:

1. Current `classifyEmail()` source rules when enough Graph-like metadata exists.
2. Current `runExtractor()` or direct platform extractor on `{ subject, bodyText }`.
3. Current `upsertLeadContact()` dry-run equivalent that reports whether it would:
   - create a Contact,
   - mark an existing non-client Contact as a lead,
   - skip because the contact is already a client,
   - skip because the extractor lacks inquirer email.

Output categories:

```ts
type LeadDiagnosticOutcome =
  | "would_create_lead_contact"
  | "would_mark_existing_contact_as_lead"
  | "already_client_no_lead_status"
  | "already_lead"
  | "platform_signal_but_extractor_null"
  | "extractor_has_no_inquirer_email"
  | "classified_noise_but_platform_candidate"
  | "classified_uncertain_but_platform_candidate"
  | "missing_body_or_metadata"
```

### Phase 3 - real-fixture capture

For each missed bucket, persist a sanitized fixture file under:

```txt
full-kit/src/lib/msgraph/__fixtures__/historical-leads/
```

Sanitization rules:

- Replace real names with `Person A`, `Person B`.
- Replace emails with `person@example.test`.
- Replace phone numbers with `555-0100` style placeholders.
- Preserve sender domain class, subject structure, body field labels, and whitespace structure.

### Phase 4 - extractor/filter fixes

Only after Phase 1-3 identify concrete misses:

- Add/adjust regexes in `email-filter.ts` and/or `email-extractors.ts`.
- Add tests using sanitized fixtures.
- Keep platform admin/noise emails as noise; do not over-broaden Crexi/Buildout domains without subject gates.

### Phase 5 - historical lead reprocess plan

After tests pass, add a gated backfill operation:

`POST /api/integrations/email-backfill/reprocess-leads`

Request:

```json
{
  "dryRun": true,
  "limit": 500,
  "platforms": ["crexi", "loopnet", "buildout"],
  "runId": "lead-reprocess-20260425-001"
}
```

Write mode may:

- update `Communication.metadata.extracted` for platform candidates where extractor now succeeds,
- create/update Contact lead fields using the existing `upsertLeadContact()` rules,
- set `Communication.contactId` to the created/found lead contact,
- enqueue scrub if classification is signal/uncertain and queue row is missing.

Every mutation writes audit metadata:

```ts
metadata.backfill.leadReprocess = {
  runId: string,
  reprocessedAt: string,
  platform: "crexi" | "loopnet" | "buildout",
  previousContactId: string | null,
  newContactId: string | null,
  extractedKind: string,
  createdOrMarkedLead: boolean
}
```

---

## Acceptance criteria

1. Diagnostic dry-run produces counts that explain how many platform-like emails exist and where they currently fall (`signal`, `uncertain`, `noise`).
2. Diagnostic identifies whether "only 1 lead" is caused by true scarcity, filter misses, extractor misses, missing bodies, or lead-status update rules.
3. No Supabase mutation occurs in diagnostic mode.
4. Every confirmed missed real pattern receives a sanitized fixture and regression test.
5. Fixes do not promote known platform admin/noise emails to leads.
6. Lead reprocess write mode is gated, dry-run-first, idempotent, and batch-limited.
7. Existing client Contacts with deals are not incorrectly moved into lead status; their communications can still link via `contactId`.

---

## Test plan

### Unit tests

- Platform inventory parser recognizes known sender/subject buckets.
- Replay result categorizes extractor null versus missing body versus missing inquirer email.
- Sanitizer removes emails, phone numbers, and names from fixture output while preserving structure.
- New real-pattern fixtures pass `extractCrexiLead`, `extractLoopNetLead`, or `extractBuildoutEvent` as appropriate.
- Negative fixtures remain null/noise.

### Regression commands

```powershell
pnpm test -- email-filter email-extractors lead-extractor-diagnostics
pnpm exec tsc --noEmit
pnpm lint
```

### Manual Supabase checks

1. Run diagnostic route in dry-run mode.
2. Review top platform buckets and 20 sanitized samples.
3. Apply extractor fixes.
4. Run dry-run reprocess and verify expected `would_create`/`would_mark_existing` counts.
5. Write in small batches only after tests and dry-run samples are accepted.

---

## Stop/go gate before AI scrub backfill

Do not run paid bulk AI scrub until this diagnostic answers:

- Are platform leads being correctly classified as `signal`?
- Are inquirer details extractable from stored bodies/raw data?
- How many historical Contacts will become leads after deterministic reprocess?
- Do dashboard/leads counts look plausible after the reprocess dry-run?

If the diagnostic reveals missing bodies/raw payloads, pause and decide whether to re-fetch those Graph messages before scrub.
