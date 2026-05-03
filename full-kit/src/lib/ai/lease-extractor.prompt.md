# Lease / Sale Extractor Prompt

> Stage 2 of the lease-lifecycle pipeline. US-based model (Claude Haiku) per
> Zach's sensitive-content decision (2026-04-30): closed-deal emails may
> contain rent figures and tenant identities; we don't route them through
> non-US providers.
>
> Invoked only after Stage 1 returned `closed_lease` or `closed_sale`. Pulls
> structured fields out of the email/transcript so the downstream pipeline
> (LeaseRecord persistence, calendar event, renewal alerts) has something
> to work with.
>
> The actual prompt body is intentionally left blank — fill in below when
> wiring up. The validation in `lease-extractor.ts` enforces:
> - `contactName` is a non-empty string
> - `contactEmail` is null OR a vaguely-email-looking string
> - `closeDate` / `leaseStartDate` / `leaseEndDate` are null OR `YYYY-MM-DD`
> - `leaseEndDate >= leaseStartDate` when both present
> - `leaseTermMonths` is null OR a positive integer; if all three are
>   present, the months value must roughly match the date range
> - `rentAmount` is null OR a positive number
> - `rentPeriod ∈ {monthly, annual}` when present
> - `mattRepresented ∈ {owner, tenant, both}` when present
> - `dealKind ∈ {lease, sale}` and matches the upstream classifier
> - For `dealKind === "sale"`, all lease-only fields must be null
> - `confidence ∈ [0, 1]`
> - `reasoning` is a non-empty string

## Role

<!-- TODO: WIRE PROMPT — CRE-aware lease/purchase document extractor for a
broker's archive. Pull structured fields without speculating. -->

## Inputs

<!-- TODO: WIRE PROMPT — receive `{subject, body, classification, signals}`
where classification has already been narrowed to `closed_lease` or
`closed_sale` by the upstream classifier. -->

## Output schema

```json
{
  "contactName": "string (required)",
  "contactEmail": "string | null",
  "propertyAddress": "string | null",
  "closeDate": "YYYY-MM-DD | null",
  "leaseStartDate": "YYYY-MM-DD | null",
  "leaseEndDate": "YYYY-MM-DD | null",
  "leaseTermMonths": "integer | null",
  "rentAmount": "number | null",
  "rentPeriod": "monthly | annual | null",
  "mattRepresented": "owner | tenant | both | null",
  "dealKind": "lease | sale",
  "confidence": 0.0,
  "reasoning": "string explaining the extraction"
}
```

## Decision rules

<!-- TODO: WIRE PROMPT — guidance on:
  - When to leave a field null vs guess
  - How to choose between rent monthly vs annual when both appear
  - How to determine `mattRepresented` from greeting/CC patterns
  - When to drop confidence below 0.6 (the human-review floor)
  - For sales, leave all lease-only fields null
-->

## Examples

<!-- TODO: WIRE PROMPT — 3–5 worked examples covering a clean lease, a
clean sale, an ambiguous case (drop confidence), and a sale that
incorrectly mentions a "lease" of equipment (still null). -->
