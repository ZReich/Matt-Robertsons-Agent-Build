# Closed-Deal Classifier Prompt

> Stage 1 of the lease-lifecycle pipeline. Cheap broad scan via DeepSeek.
> Each Communication (one email, one transcript, one text) is classified
> into one of four buckets. Only `closed_lease` and `closed_sale`
> candidates are forwarded to the Stage-2 extractor.
>
> The actual prompt body is intentionally left blank — fill in below when
> wiring up. The validation in `closed-deal-classifier.ts` enforces:
> - `classification ∈ {closed_lease, closed_sale, lease_in_progress, not_a_deal}`
> - `confidence ∈ [0, 1]`
> - `signals` is a string array (may be empty)
> Anything outside those constraints is rejected before the result reaches
> the caller.

## Role

<!-- TODO: WIRE PROMPT — describe the model's role as a CRE-aware classifier
that distinguishes closed deals from in-progress LOIs, marketing emails,
and unrelated traffic. -->

## Inputs

<!-- TODO: WIRE PROMPT — describe the {subject, body} pair the model
receives, plus any structured context (sender, direction). -->

## Output schema

The model must emit a JSON object that matches this shape exactly:

```json
{
  "classification": "closed_lease | closed_sale | lease_in_progress | not_a_deal",
  "confidence": 0.0,
  "signals": ["string", "..."]
}
```

<!-- TODO: WIRE PROMPT — describe each field, especially what kinds of
phrases qualify as `signals`. -->

## Decision rules

<!-- TODO: WIRE PROMPT — describe the heuristics:
  - `closed_lease`: signed lease, lease commencement, fully executed
  - `closed_sale`: closed escrow, recorded deed, commission disbursement
  - `lease_in_progress`: LOI, term sheet, "we're negotiating"
  - `not_a_deal`: marketing, intros, vendor pitches, social
-->

## Examples

<!-- TODO: WIRE PROMPT — drop in 4–6 worked examples (one per class) to
calibrate confidence. -->
