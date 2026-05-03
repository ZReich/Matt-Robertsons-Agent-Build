# Transcript Follow-ups Implementation Plan

**Source:** Conversation between Zach and Matt on 2026-04-30/05-01 about the CRE app build (transcript pasted into session).

**Goal:** Ship the lead auto-reply path Matt named as his #1 priority, plus the foundational entities it needs (Property catalog, Contact tags/notes/criteria UI, criteria↔property matcher), and a sensitive-content filter Matt asked for. Defer hosting, real outbound send, and Genevieve's spreadsheet ingestion until Zach is back to direct.

**Tech Stack:** Next.js 15 / TypeScript / Prisma 5 / Postgres (Supabase) / DeepSeek (existing OpenAI-compatible provider) / Vitest / pnpm.

---

## What's already built (no need to repeat)
- Leads kanban + lead detail + candidate gate
- Deals kanban + lead→deal conversion flow
- Contacts list + AI relationship summaries (cached, hash-invalidated)
- Templates (DB-stored, viewer + copy-to-clipboard, no send)
- Email scrub (DeepSeek), todo auto-creation from emails

## Transcript items NOT covered by existing plan, that this plan addresses
1. **Auto-reply on inbound lead inquiries** (Matt's #1 ask)
2. **Property catalog** (Genevieve will email a sheet later — schema + ingestion path now)
3. **Contact tags UI** (referrer, referral, buyer, owner, tenant, christmas-mailer)
4. **Contact manual notes UI** (field already exists, no UI)
5. **Contact buyer/tenant criteria** (structured: type, sqft, location, budget)
6. **Property↔criteria matcher** (auto-suggest matches both directions)
7. **Cross-reference: lead inquiry on property A → suggest matching B/C/D in reply draft**
8. **Sensitive content filter** (financial keywords → skip AI processing)

## Transcript items DEFERRED (need Zach/Matt input on return)
- **Real outbound send** of auto-replies (Matt must approve template + send-on-behalf-of). Build to "Pending Replies queue" with copy-to-clipboard + approve action; don't wire Microsoft Graph send-mail yet.
- **Hosting/deployment** (currently localhost). Out of scope for this batch.
- **Deep people enrichment** (vendor + cost decision). Defer.
- **Reply-style learning corpus** (depends on outbound corpus volume). Defer to Phase 2.
- **Daily Tyrer-list scrub** (depends on Tyrer's email format being captured). Defer.
- **NDA gating on auto-reply** (template authoring decision). Defer.
- **Relationship summary snapshots over time** (DB design decision worth a chat). Defer.
- **Auto-running summaries on cron** (cost decision). Defer.

---

## Decisions baked in (per Zach via transcript + reminder)
- **DeepSeek stays.** All new AI features default to the existing DeepSeek provider via `scrub-provider.ts`. Do NOT introduce direct Anthropic calls in this plan.
- **Sensitive emails skip AI entirely** rather than route to a different model. Filter list: `bank statement`, `wire transfer`, `wire instructions`, `routing number`, `account number`, `ssn`, `social security`, `voided check`, `ach authorization`, plus regex for 9-digit (routing) and 13-19 digit (card) numbers in body. Skip = mark as `aiSkipReason="sensitive_keywords"` and don't enqueue for scrub.
- **No new Property model — wait, yes new Property model.** Today property data is embedded on `Deal`. Genevieve's spreadsheet describes properties (active/under-contract/closed) that may not yet have any inquiry → so they have no Deal yet. We need a `Property` table. Deal can keep its embedded fields and add an optional `propertyId` FK to denormalize-link.
- **Auto-reply is DRAFT-only.** Generated, surfaced, approved, copied. No `send-mail` to Graph until Matt blesses on return.
- **Criteria storage is on Contact (not Deal).** Transcript: criteria belongs to the buyer relationship, not a specific deal. Add `Contact.searchCriteria Json?` and `Contact.contactRoles String[]` (preset multi-tag for owner/tenant/buyer/investor/referrer).

---

## Phases (executed in order, with parallel sub-agent dispatch where independent)

### Phase A — Property catalog
- **A1.** Prisma migration: add `Property` model + `PropertyStatus` enum (`active`, `under_contract`, `closed`, `archived`). Fields: id, name, address, propertyKey (computed), propertyType (reuse enum), squareFeet, unit, listPrice, capRate, occupiedSquareFeet, status, listingUrl (build-out flyer), description, tags, createdBy, createdAt, updatedAt, archivedAt.
- **A2.** Add `Deal.propertyId String? FK Property` (optional, denormalized — keep existing fields).
- **A3.** API routes: `GET/POST /api/properties`, `GET/PATCH/DELETE /api/properties/[id]`, `POST /api/properties/import-csv`.
- **A4.** UI: `/pages/properties` (list, search, status filter), `/pages/properties/[id]` (detail with matched contacts + matched leads), `/pages/properties/new` (manual add), `/pages/properties/import` (CSV upload + preview + commit).
- **A5.** Sidebar nav entry.

### Phase B — Contact tags + notes UI
- **B1.** Reusable `<TagsEditor>` with preset taxonomy: `owner`, `tenant`, `buyer`, `investor`, `referrer`, `referral`, `christmas-mailer`, `do-not-contact`. Free-form custom tags also allowed.
- **B2.** Render tags as colored badges on contacts list + contact detail.
- **B3.** `<ManualNotesEditor>` on contact detail — autosave on blur, plain text, multi-line.
- **B4.** PATCH route updates wired (likely already supports tags+notes; verify and fix).

### Phase C — Contact buyer/tenant criteria
- **C1.** Migration: add `Contact.searchCriteria Json?`. Shape: `{ propertyTypes: PropertyType[], minSqft?: number, maxSqft?: number, locations: string[], maxPrice?: number, notes?: string }`.
- **C2.** UI: `<CriteriaEditor>` on contact detail — only renders when contact has `buyer` or `tenant` or `investor` tag.
- **C3.** API PATCH supports `searchCriteria`.

### Phase D — Property↔Criteria matcher
- **D1.** Pure function `matchProperty(property, criteria) → { score, reasons[] }` in `src/lib/matching/property-criteria.ts`. Score 0-100 weighted: type match (40), sqft band (25), location keyword (25), budget (10).
- **D2.** Server action `findMatchesForProperty(propertyId)` — loads all contacts with criteria, scores, returns ≥50 sorted desc.
- **D3.** Server action `findMatchesForContact(contactId)` — symmetric.
- **D4.** Render "Matches" tab on Property detail (top 20) and "Matching Properties" panel on Contact detail.
- **D5.** Tests: snapshot the matching of three sample properties × three sample criteria, assert known scores.

### Phase E — Auto-reply DRAFT pipeline
- **E1.** Migration: add `PendingReply` model. Fields: id, leadCommunicationId FK (the inbound), contactId, propertyId (the matched listing), draftSubject, draftBody, suggestedAttachments Json, status enum (`pending`, `approved`, `dismissed`), createdAt, approvedAt, approvedBy.
- **E2.** Service `generatePendingReply(communicationId)` in `src/lib/ai/auto-reply.ts`. Calls DeepSeek via existing provider. Builds prompt from: inbound email body, matched property record, top 3 cross-references via Phase D matcher, existing template body for the property type/inquiry kind. Returns subject + body + reasoning. Saves a PendingReply row.
- **E3.** Hook: extend the existing lead-promotion pipeline — after a `ContactPromotionCandidate` becomes a real Lead with `leadStatus=new`, fire `generatePendingReply` if the inbound has a propertyKey and a matching Property exists. Don't fire if sensitive filter (Phase F) tripped.
- **E4.** UI: `/pages/pending-replies` list (count badge in sidebar), card per pending reply showing inquirer + property + draft (editable) + "approved" / "dismiss" / "copy" buttons. Approve marks status, optionally creates a Communication row with direction=outbound and metadata={ source: "auto-reply-approved" } so it appears in the contact timeline.
- **E5.** Surface "Pending reply ready" badge on lead detail page; deep-link to /pending-replies/[id].

### Phase F — Sensitive content filter
- **F1.** Pure function `containsSensitiveContent(subject, body) → { tripped: boolean, reasons: string[] }` in `src/lib/ai/sensitive-filter.ts`. Tests for the keyword list above + regex patterns.
- **F2.** Wire into `enqueueScrub` (or whatever the entry point is named). If tripped, skip enqueue and write `aiSkipReason` on the Communication metadata.
- **F3.** Wire into auto-reply generator from E2 — refuse to draft if tripped.
- **F4.** Tests: 6 positive cases, 4 negative cases.

### Phase G — Audit + browser verify
- Run `pnpm test` and `pnpm tsc --noEmit --pretty false` clean.
- Adversarial re-read of every new file looking for: missing null guards, unhandled promise rejections, broken links, unmatched route params, untested code paths.
- Browser walkthrough: start dev server (preview tools), visit each new page, screenshot, exercise create/edit/delete, look at console + network.

---

## Out of scope (explicitly)
- Anything requiring Microsoft Graph send-mail API
- Hosting/deployment changes
- Genevieve's actual property spreadsheet (don't have it — provide CSV import path that handles a reasonable shape; final shape can be adjusted on her first email)
- Plaud / SMS / phone log integration (separate project track)
- Buildout API integration
- Reply-style fine-tuning corpus

---

## Execution: inline by Claude (no subagent dispatch unless a phase spawns 2+ truly independent tracks). Test gates after each phase. Commit per phase.
