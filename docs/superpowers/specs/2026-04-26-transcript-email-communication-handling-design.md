# Transcript Email/Communication Handling Design

Date: 2026-04-26
Status: Ralplan consensus approved for implementation planning
Related context: `.omx/context/transcript-communications-plan-20260426T002932Z.md`
Related PRD: `.omx/plans/prd-transcript-email-communication-backfill.md`
Related test spec: `.omx/plans/test-spec-transcript-email-communication-backfill.md`

## What the transcript changed

The transcript expanded the email backfill from “recover platform leads and link communications” into Matt's broader second-brain foundation:

- Emails are the first channel; phone logs, Plaud transcripts, and texts come later.
- Matt has four relationship modes that must not be collapsed into one bucket:
  - contacts,
  - leads,
  - clients/past clients,
  - colleagues/referral partners.
- NAI and outside brokers are not ordinary noise. Direct co-brokerage/referrals can drive major revenue.
- Buildout is a pipeline source of truth; emails from Buildout can mirror deal stages/tasks/critical dates later.
- DocuSign and future file links matter as deal/file metadata, not as sender identities.
- A 90-day pilot is preferred before processing all historical mail.

## Claude notes reviewed

Earlier Claude-authored design artifacts were reviewed:

- `docs/superpowers/specs/2026-04-23-email-ingestion-design.md`
- `docs/superpowers/plans/2026-04-23-email-ingestion.md`
- `docs/superpowers/specs/2026-04-24-ai-email-scrub-design.md`
- `full-kit/src/lib/ai/scrub-prompt.ts`

Useful carry-forward decisions:

- Keep NAI direct/co-brokerage and broker referrals as high-value signal.
- Do not blanket drop large broker domains.
- Buildout event and SIOR directory import were already identified as follow-ups.
- Scrub prompt currently forbids direct `create-contact` actions, which aligns with candidate-first promotion.

Important correction:

- Previous lead-recovery work that directly created/marked Contacts from platform inquirers is now superseded. The safe design is candidate-first.

## Database diagnostic results

A temporary read-only diagnostic was run against live Supabase data and removed after use.

Key counts:

| Category | Count |
|---|---:|
| Communications | 22,597 |
| Existing unique contact emails | 1,145 |
| Signal emails | 3,670 |
| Uncertain emails | 5,075 |
| Noise emails | 13,852 |
| Platform lead emails with extracted inquirer | 82 |
| NAI direct rows | 903 |
| NAI likely blast rows | 2,833 |
| NAI direct human unknown rows | 532 |
| Big broker rows | 2,898 |
| Big broker potential referrals | 439 |
| Buildout rows | 138 |
| Buildout lead rows | 20 |
| Buildout stage rows | 14 |
| DocuSign rows | 252 |

Diagnostic conclusion:

- Broad auto-add rules are unsafe.
- Conservative candidate promotion is required before building dossiers/profiles.
- Deals are not imported yet, so client/past-client classification must remain provisional.

## Relationship taxonomy for the pilot

Use candidate taxonomy first, then write Contact tags/metadata only after approval.

Candidate kinds:

- `lead_candidate`
- `client_candidate`
- `past_client_candidate`
- `colleague_candidate`
- `referral_partner_candidate`
- `internal_team_candidate`
- `vendor_candidate`
- `unknown_business_contact`
- `system_or_platform_sender`

Promoted Contact tags should be pilot-safe strings, e.g.:

- `lead`
- `client-candidate`
- `past-client-candidate`
- `colleague`
- `referral-partner`
- `network:nai`
- `network:sior`
- `source:crexi`
- `source:loopnet`
- `source:buildout`

Do not add a permanent Contact kind enum until pilot review validates the categories.

## Source handling rules

### Outlook Contacts

- Trusted baseline.
- Exact normalized email match first.
- Duplicate emails are conflicts.

### NAI

- Direct, human, small-recipient NAI messages are signal/candidate evidence.
- NAI blasts/e-blasts/list mail are noise or low-priority evidence.
- NAI domain alone never auto-creates a Contact.

### Outside brokers and SIOR

- Large broker domains are mixed signal/noise.
- Never blanket drop CBRE/JLL/Cushman/Colliers/Marcus/Sands/MWCRE/SIOR-like domains.
- Referral/work language creates candidates, not Contacts.
- Authoritative SIOR import can later seed candidates/contacts with explicit provenance.

### Platform leads: Crexi, LoopNet, Buildout

- Extracted inquirer becomes `ContactPromotionCandidate`.
- Platform sender bot is source metadata only.
- Live ingestion and historical backfill must not directly create Contact rows.

### Buildout events

- Treat as pipeline/event source.
- Extract stage updates, tasks, critical dates, document views, and paid/deal events.
- Do not update Deal stage until deal import/source-of-truth matching exists.

### DocuSign / Dotloop

- Extract document/deal/file metadata.
- Do not create Contacts from bot senders.
- Store/link metadata; binary file storage is out of scope.

### Future phone/text/Plaud

- Email candidate infrastructure should be channel-agnostic enough to accept future evidence.
- Plaud transcript matching requires call-log/phone bridge timestamps before reliable contact matching.


## Pre-download filter tightening for the next pulls

The previous 90-day integration tried to reduce cost and storage by avoiding emails that looked like obvious noise. That direction is right, but the transcript makes the risk clear: Matt's important work hides inside domains that also send junk. Before another 90-day pull, and definitely before the one-year pull, the filters need a formal audit lane. The canonical deep-dive plan for this lane is .omx/plans/prd-email-filter-hardening.md, with tests in .omx/plans/test-spec-email-filter-hardening.md and design summary in docs/superpowers/specs/2026-04-26-email-filter-hardening-design.md.

### Required filter posture

- **Do not trust broad domain drops for CRE domains.** NAI, SIOR, Cushman, JLL, Colliers, CBRE, Marcus, Sands, MWCRE, SRS, and similar broker domains are mixed. They can only be skipped by a specific safe-noise sender/pattern rule.
- **Prefer quarantine over deletion.** If a message cannot be proven noise from metadata, store it as `uncertain` or quarantine it for later classifier review.
- **Separate metadata fetch from body fetch.** It is acceptable to avoid downloading/storing full bodies for proven noise, but the system must retain audit metadata and enough reason codes to explain the decision.
- **Sample what we skip.** Every hard-drop rule needs a review sample before it can be used for a larger lookback.
- **Any miss demotes the rule.** If a skipped sample contains a real lead, referral, deal, direct client, task, or document event, the rule moves back to quarantine/uncertain until fixed.

### Hard-drop eligibility

A pre-download/body-skip rule is eligible only when all are true:

1. It has a named rule id.
2. It is covered by unit tests and a live-count diagnostic.
3. It has negative tests for NAI/direct-human, known-counterparty, platform-lead, and broker-referral cases.
4. It records audit metadata even when body download is skipped.
5. It passes sampled review with zero critical false negatives.

### Full-year rollout gate

The 365-day pull must not rely on the current filter set blindly. Before expanding:

1. Re-run a 90-day dry pull/dry classification with the tightened filters.
2. Report skip counts by rule and top skipped senders/domains/subjects.
3. Review samples from every high-volume hard-drop rule.
4. Move any questionable rule to quarantine/uncertain.
5. Only then run the one-year pull in chunks with the same metrics after each batch.

## Implementation sequencing

1. Supersede stale direct-contact lead-backfill specs.
2. Add `ContactPromotionCandidate` schema/migration.
3. Add candidate domain service and tests.
4. Refactor live ingestion in `emails.ts` away from `upsertLeadContact()`.
5. Refactor historical lead apply backfill away from Contact writes.
6. Add pilot metric report/dry-run route or command.
7. Run 90-day dry-run pilot and inspect examples.
8. Only then enable bounded write-mode candidate generation.
9. Build review/approval UI/API.
10. After deal import/Buildout matching, revisit client/past-client promotion.

## Non-goals for this lane

- Full contact review UI.
- Deal import from Buildout/deal-flow spreadsheet.
- Automatic client classification without Deal evidence.
- Full phone/text/Plaud transcript linking.
- Bulk AI dossier generation before contact/linking quality is stable.

## Verification path

Use the test spec, then run:

```powershell
cd full-kit
pnpm exec prisma generate
pnpm exec tsc --noEmit
pnpm test -- contact-promotion
pnpm test -- msgraph
pnpm test -- lead-apply-backfill
pnpm lint
pnpm test
pnpm build
```

## Consensus result

Planner, Architect, and Critic consensus approved the candidate-first plan after iterations. Mandatory guardrails:

- Remove/disable both direct `upsertLeadContact` write paths before pilot.
- Make approval-create race-safe.
- Prove rejected candidates are not recreated.
- Prove `dedupeKey` uniqueness/idempotency.
- Update/replace stale PRD/test/spec artifacts before implementation follows them.
