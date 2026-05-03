# Information-Architecture Redesign Proposal

**Date:** 2026-05-02
**Trigger:** Zach raised that the sidebar (Clients, Leads, Contact Candidates, Deals, Properties, Pending Replies, Contacts) was sprawling and confusing — Deals and Properties feel duplicative; Contact Candidates and Leads conflate; Pending Replies doesn't fit cleanly anywhere.

## Findings: what Matt actually said vs. what we built

Direct quotes from the 2026-04-30/05-01 transcript with Matt:

| Matt's words | What we built | Sprawl signal |
|---|---|---|
| "you have 2000 and some contacts" | `/pages/contacts` (DB Contact table) | Master list — keep |
| "the deal side of things... Buildout is our truth source... I don't know if we would live in here for the deal" | `/pages/deals` (Deal model, kanban + list) | Matt was uncertain whether deals belong in our app at all. Currently we have them but he didn't ask for the surface. |
| "this allows you, like, if you wanted to link, like if you wanted to create a contact out of one of And then link this other batch to them" | `/pages/contact-candidates` (ContactPromotionCandidate model) | Matt liked the candidate gate — Zach's later feedback confirmed "Matt really liked the contact candidates page." |
| "Now we've got new leads in here and we can put them embedded, contacted, converted, dropped" | `/pages/leads` (Contact filtered by leadStatus) | Matt thought of "leads" as a kanban — we built that. Confusion: he conflated "leads" with "contact candidates" sometimes. |
| "we automatically create a property card for that property" | `/pages/properties` (Property model — added later) | Properties emerged from this conversation; weren't a primary surface for him. |
| "all leads that automatically come in, automatically get replied to with property information" | `/pages/pending-replies` | Matt asked for the *behavior*, not a queue UI. We built the queue as the safe-default approval gate. |
| "Everything would get pulled into here automatically" | (no single surface) | The "front door" Matt wanted is a unified daily dashboard — currently `/dashboards/home`, but the sidebar still surfaces 7 People pages. |
| "I don't know if we would live in here for the deal... we have to live in build out for the deals, would we also live in here?" | We do live in here. | Direct sprawl confession. |

## Conceptual model (cleaner than the current sidebar)

There are **three primary entity classes** in this domain:

1. **People** — anyone Matt has interacted with. A Contact is the canonical record. ContactPromotionCandidate is a *pre-Contact* record (waiting for human approval). Lead-status, client-type, criteria-tags are all *attributes* on a Contact, not separate tables.

2. **Properties** — physical assets being marketed or sought. A Property is a catalog entry. Deal is a *transaction-in-progress* between a Person and a Property — strictly speaking, a deal is a relationship row, not a primary entity.

3. **Activity** — communications, calendar events, todos, AI drafts. These are signals/work-items that connect People to Properties through time.

The current 7-item "People" sidebar group conflates entities, attributes, and approval-state views.

## Industry benchmark

CRE-CRM industry skews **flat top-level navigation, not nested**:

- **HubSpot:** Contacts, Companies, Deals, Tasks, Inbox, Lists — flat
- **Salesforce Sales Cloud:** Leads, Accounts, Contacts, Opportunities (with conversion atomic) — flat
- **ClientLook (CRE-specific):** Contacts, Properties, Deals — relational + search-driven, not deeply nested
- **Apto (legacy CRE):** fragmented; market is moving away from it

Matt's "we shouldn't have to switch between tabs" instinct aligns with HubSpot/ClientLook patterns: fewer top-level peers, drill-into-context for related data.

## Proposed sidebar (down from 14 to 9 items)

```
Main
  Home

People                 ← single landing page with tabs (All / Leads / Clients / Candidates)
  └ Contact Candidates ← second-class link for the reviewer cohort

Pipeline
  └ Deals
  └ Properties

Activity
  └ Pending Replies   ← AI drafts queue lives here, not under People
  └ Communications
  └ Calendar
  └ Todos

Resources
  └ Templates
  └ Files

System
  └ Agent
  └ Settings
```

Rationale per change:

| Change | Why |
|---|---|
| Collapse Clients/Leads/Contacts into one **People** page with tabs | They're three views of the same Contact rows. Matt searched by name, not by classification. Keep the Contact Candidates link visible for reviewers because Matt liked that page specifically. |
| Move **Pending Replies** under Activity | It's an AI work-item queue, not a People entity. It pairs naturally with Todos (which is also a work queue). |
| Group **Deals** + **Properties** under Pipeline | They are flip-sides of the same conversation: "what deal is this property part of?" / "what property does this deal concern?" Cross-link drilldowns. |
| Keep **Templates** + **Files** under Resources | Reference material that doesn't fit elsewhere. Already correctly grouped. |
| Keep **Agent** + **Settings** under System | Admin/maintenance surfaces. |

## Drilldown UX (Matt's "click and read" requirement)

Matt was emphatic: "if it gives us a blurb as to what the to do is about, and gives us the things that it came from. We should be able to click on those, and read the information."

Current state — most artifacts give you a label and force you to navigate to a separate page to read context. Proposal: **inline drawer-based drilldown everywhere AI-generated content surfaces.**

Concretely:

| Surface | Current | Proposed |
|---|---|---|
| Todos page — `ai_rationale` line | Plain text | Click → Sheet drawer showing: source email full body, linked Contact card, linked Deal card, the original AgentAction payload, "Mark done" / "Edit" / "Open in inbox" buttons |
| Pending Replies card | Subject + body | "View source inquiry" button → drawer with the inbound email body + the inquirer's relationship summary |
| Lead AI Suggestions card | Action summary line | Click → drawer showing the source comm body + the suggested action's full payload + approve/reject inline |
| Property detail "Matching contacts" | Score + reasons | Click → drawer with the contact's criteria + recent activity inline |
| Contact detail "Matching properties" | Score + reasons | Click → drawer with property highlights + relevant past comms about it |

**The pattern:** every AI-derived item has a Sheet-component drilldown that surfaces source material without leaving the current page.

## Implementation order

1. **Now (this session):**
   - Sidebar restructure (small, additive)
   - Drilldown drawer for Todos (highest impact — Matt said this explicitly)
   - Criteria backfill on full contact set
   - Browser-verify each change

2. **Next session (after the parallel session merges):**
   - Drilldown drawers for the other surfaces
   - Add the tabs-on-People page if the Sidebar restructure isn't enough on its own
   - Audit cross-links so every entity links to every related entity in one click

## Risks of doing this in parallel with the deal-pipeline session

- The other session is editing `src/lib/buildout/*`, `src/lib/contacts/role-lifecycle.ts`, `src/lib/ai/buyer-rep-detector.ts`, `src/lib/contact-promotion-candidates.ts`, `vercel.json` (per their plan).
- I'm editing `src/data/navigations.ts`, `src/data/dictionaries/{en,ar}.json`, `src/components/todos/*`, `src/app/[lang]/(dashboard-layout)/apps/todos/*`.
- File-level overlap is minimal. Worst case: dictionary keys conflict. Mitigation: keep my dictionary additions namespaced and append-only.
