# Email Filter Audit Review Guide for Matt

Purpose: give Matt a very small set of edge cases to confirm before we ever allow the system to skip email bodies during future mailbox pulls.

Matt should **not** review hundreds of rows. The export is now a tiny decision pack:

- up to 15 rows that the system is unsure about and wants Matt's judgment on
- up to 5 examples the system thinks should be kept
- up to 5 examples the system thinks are safe noise

The current handoff export uses a tighter cap: **10 review rows + 5 keep examples + 5 noise examples = 20 rows total**, not hundreds.

## Where the review data comes from

Use the admin endpoint:

`POST /api/integrations/msgraph/emails/filter-audit/samples`

Recommended body for a spreadsheet export:

```json
{
  "format": "csv",
  "reviewPackLimit": 10,
  "perBucketLimit": 25
}
```

This returns `email-filter-audit-review-samples.csv`.

## How Matt should review it

Open the CSV in Excel or Google Sheets. Matt only needs to edit two columns:

1. `matt_decision`
2. `matt_notes`

Use these decision values:

- `KEEP` — future emails like this should be connected to the second brain, summarized, linked to a contact/client/deal, or turned into a todo.
- `NOISE` — future emails like this are safe to ignore as junk, marketing, automated clutter, or non-business noise.
- `UNSURE` — Matt cannot tell from the row. We should keep/fetch these for now until the rule is clearer.

## What counts as a lead or todo

A `KEEP` / lead-type email is anything where someone is asking about a property or wants information, for example:

- “requesting information”
- LoopNet/Crexi/Buildout lead
- favorited a property
- asking about availability, pricing, tour, space, suite, listing, flyer, property info

A todo/follow-up candidate is anything that could bring in money or prevent a deal from slipping, for example:

- Matt has already replied or there is an existing thread
- Matt has forwarded the thread or sent any email inside that conversation
- buyer / tenant / landlord / broker / referral language
- LOI, lease, purchase agreement, contract, under contract, closing
- critical date, task assigned, deal stage update
- DocuSign, Dotloop, Buildout, Crexi, LoopNet

## What Matt is checking

For each row, look at:

- `system_recommendation` — system's first pass: KEEP, NOISE, or REVIEW.
- `review_priority` — higher means more likely to matter.
- `why_this_matters` — why the system thinks it may matter.
- `likely_todo` — what kind of action might be created.
- `suggested_category` — `business` or `personal`; school/family items such as Grace Montessori/Billings Christian should go under `personal`.
- `subject` — email subject only.
- `sender` and `sender_domain` — who sent it.
- `risk_flags` — why the system thought it might be noise.
- `rescue_flags` — why the system thought it might still matter.

Important: the CSV intentionally does not include raw email body text.

## Review rules of thumb

Mark `KEEP` if the row looks like any of these:

- Matt replied, forwarded, or sent anything in that email thread. These are automatically important because the second brain needs both sides of the conversation for context.
- It was sent directly to Matt and looks like something he should review, even if it is not CRE revenue.
- Personal/family/school items should be kept as `personal` review items.
- Owned-property/admin items, such as Bin 119 or Billings Logistics, should be kept as business/property review items.
- client, contact, broker, colleague, SIOR, JLL, Cushman, CBRE, NAI, SRS, etc.
- possible lead, property inquiry, buyer/tenant/landlord signal
- deal stage, task, critical date, DocuSign, Buildout, LoopNet, Crexi
- anything Matt might want in notes, todos, activity, contact profile, client profile, or deal history

Mark `NOISE` only if Matt is confident future emails like it can be ignored.
From Matt's latest feedback, examples that do **not** need action include generic top-producer event/details emails and the Laurel MT BOV + NAI Billings introduction pattern.
Also treat mailer-daemon/undeliverable notices, SIOR informational/event messages, Heja growth notices, generic estate marvel/listing-style notes, and breach/cease communications as noise unless Matt has already engaged the thread.
The one exception from that sample was `HGC Board Packet and Financials`, which should be kept as a **personal** review item because Matt is a Highlands/Hilands Golf Course member.

When in doubt, mark `UNSURE`. The system should fetch/keep uncertain emails, not skip them.

## What Zach/the system does after Matt reviews it

1. Import or read Matt's marked CSV.
2. Convert obvious `KEEP` patterns into rescue rules.
3. Convert only very high-confidence `NOISE` patterns into skip candidates.
4. Run another dry-run audit.
5. Promote body skipping only after sampled misses are zero.
