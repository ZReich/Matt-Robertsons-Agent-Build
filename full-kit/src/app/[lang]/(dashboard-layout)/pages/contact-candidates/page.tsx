import Link from "next/link"
import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react"

import type { CandidateReviewRow } from "@/lib/contact-promotion-candidates"
import type { ContactPromotionCandidateStatus } from "@prisma/client"
import type { Metadata } from "next"

import { getSession } from "@/lib/auth"
import { getOutlookDeeplinkForSource } from "@/lib/communications/outlook-deeplink"
import { listContactPromotionCandidates } from "@/lib/contact-promotion-candidates"
import { db } from "@/lib/prisma"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CandidateActions } from "./_components/candidate-actions"
import { ContactCandidateSignOutButton } from "./_components/sign-out-button"
import { CandidateThreadSummary } from "@/components/contact-candidates/thread-summary"
import {
  contactCandidateSignInUrl,
  resolveContactCandidatePageAccess,
} from "./access"

export const metadata: Metadata = {
  title: "Contact Candidates",
}

export const dynamic = "force-dynamic"

const STATUS_FILTERS: Array<{
  label: string
  value?: ContactPromotionCandidateStatus
}> = [
  { label: "Reviewable" },
  { label: "Pending", value: "pending" },
  { label: "Needs Evidence", value: "needs_more_evidence" },
  { label: "Snoozed", value: "snoozed" },
  { label: "Approved", value: "approved" },
  { label: "Linked", value: "merged" },
  { label: "Rejected", value: "rejected" },
  { label: "Not a Contact", value: "not_a_contact" },
]

type ContactCandidatesPageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ContactCandidatesPage({
  params,
  searchParams,
}: ContactCandidatesPageProps) {
  const { lang } = await params
  const access = await resolveContactCandidatePageAccess(lang)
  if (!access.allowed) {
    const session = await getSession()
    return (
      <ContactCandidateAccessDenied lang={lang} email={session?.user?.email} />
    )
  }

  const resolvedSearchParams = await searchParams
  const rawStatus = singleValue(resolvedSearchParams?.status)
  const status = STATUS_FILTERS.some((filter) => filter.value === rawStatus)
    ? (rawStatus as ContactPromotionCandidateStatus)
    : undefined

  const [candidates, contacts] = await Promise.all([
    listContactPromotionCandidates({ status }),
    db.contact.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, email: true },
    }),
  ])

  // Batch-load any cached thread summaries for the visible candidates so
  // the page can pre-fill the summary panel without a per-row LLM call.
  const summaryActions =
    candidates.length > 0
      ? await db.agentAction.findMany({
          where: {
            actionType: "summarize-thread",
            status: "executed",
            feedback: null,
            targetEntity: {
              in: candidates.map((c) => `thread:${c.id}`),
            },
          },
          orderBy: { executedAt: "desc" },
          select: {
            targetEntity: true,
            payload: true,
            executedAt: true,
            createdAt: true,
          },
        })
      : []
  // Keep one summary per candidate (most-recent wins, since prior rows are
  // marked superseded by the writer but defense-in-depth here too).
  const summaryByCandidate = new Map<
    string,
    { summary: string; generatedAt: string; modelUsed: string }
  >()
  for (const action of summaryActions) {
    if (!action.targetEntity) continue
    const candidateId = action.targetEntity.replace(/^thread:/, "")
    if (summaryByCandidate.has(candidateId)) continue
    const payload = action.payload as Record<string, unknown> | null
    if (!payload || typeof payload.summary !== "string") continue
    summaryByCandidate.set(candidateId, {
      summary: payload.summary,
      generatedAt: (action.executedAt ?? action.createdAt).toISOString(),
      modelUsed:
        typeof payload.modelUsed === "string" ? payload.modelUsed : "unknown",
    })
  }

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Contact Candidates</h1>
            <p className="text-sm text-muted-foreground">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}{" "}
              awaiting Contact approval
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${lang}/pages/leads`}>Leads</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        This is the approval gate for uncertain people before they become
        Contacts. Buildout lead emails with inquirer email evidence now go
        straight to Leads like Crexi and LoopNet; this queue is for extracted
        people that still need a human safety check.
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const href = filter.value
            ? `/${lang}/pages/contact-candidates?status=${filter.value}`
            : `/${lang}/pages/contact-candidates`
          const active = filter.value === status || (!filter.value && !status)
          return (
            <Button
              key={filter.label}
              variant={active ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={href}>{filter.label}</Link>
            </Button>
          )
        })}
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
          No candidates in this queue.
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              contacts={contacts}
              cachedThreadSummary={summaryByCandidate.get(candidate.id) ?? null}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ContactCandidateAccessDenied({
  lang,
  email,
}: {
  lang: string
  email: string | null | undefined
}) {
  const callbackUrl = contactCandidateSignInUrl(lang)

  return (
    <section className="container grid min-h-[60vh] place-items-center p-6">
      <div className="grid max-w-xl gap-5 rounded-md border bg-background p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              Contact candidate access is restricted
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email || "an account that is not allowed"}.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This review queue only opens for emails listed in
          CONTACT_CANDIDATE_REVIEWER_EMAILS. Sign out, then sign in with
          zreichert@rovevaluations.com or another configured reviewer email.
        </p>

        <div className="flex flex-wrap gap-2">
          <ContactCandidateSignOutButton callbackUrl={callbackUrl} />
          <Button variant="outline" asChild>
            <Link href={`/${lang}/dashboards/home`}>Back to Home</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function CandidateCard({
  candidate,
  contacts,
  cachedThreadSummary,
}: {
  candidate: CandidateReviewRow
  contacts: Array<{
    id: string
    name: string
    company: string | null
    email: string | null
  }>
  cachedThreadSummary: {
    summary: string
    generatedAt: string
    modelUsed: string
  } | null
}) {
  const preferredContactId =
    candidate.suggestedContactId ??
    candidate.matchingContacts[0]?.id ??
    candidate.approvedContactId
  const contactChoices = mergeContactChoices(
    candidate.matchingContacts,
    contacts
  )

  return (
    <article className="rounded-md border bg-background p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                {candidate.displayName ||
                  candidate.normalizedEmail ||
                  "Unknown"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[candidate.company, candidate.normalizedEmail, candidate.phone]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{candidate.status}</Badge>
              {candidate.sourcePlatform ? (
                <Badge variant="secondary">{candidate.sourcePlatform}</Badge>
              ) : null}
              {candidate.sourceKind ? (
                <Badge variant="outline">{candidate.sourceKind}</Badge>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <EvidenceItem label="Platform" value={candidate.sourcePlatform} />
            <EvidenceItem label="Source kind" value={candidate.sourceKind} />
            <EvidenceItem label="Source" value={candidate.source} />
            <EvidenceItem
              label="Evidence"
              value={`${candidate.evidenceCount} item${
                candidate.evidenceCount !== 1 ? "s" : ""
              }`}
            />
            <EvidenceItem
              label="First seen"
              value={formatDate(candidate.firstSeenAt)}
            />
            <EvidenceItem
              label="Last seen"
              value={formatDate(candidate.lastSeenAt)}
            />
          </dl>

          {candidate.message ? (
            <blockquote className="overflow-hidden whitespace-pre-wrap break-words rounded-md border-l-4 bg-muted/40 px-3 py-2 text-sm">
              {candidate.message}
            </blockquote>
          ) : null}

          {candidate.communication ? (
            <div className="overflow-hidden rounded-md border bg-muted/20 p-3 text-sm">
              {renderEvidenceRow(candidate.communication)}
            </div>
          ) : null}

          {candidate.evidenceCommunications.length > 1 ? (
            <div className="overflow-hidden rounded-md border p-3 text-sm">
              <p className="font-medium">Evidence communications</p>
              <div className="mt-2">
                <CandidateThreadSummary
                  candidateId={candidate.id}
                  initialSummary={cachedThreadSummary}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {candidate.evidenceCommunications.map((communication) =>
                  renderEvidenceRow(communication)
                )}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-3 lg:sticky lg:top-4 lg:self-start">
          {candidate.status === "approved" || candidate.status === "merged" ? (
            <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Approved Contact: {candidate.approvedContactId}
            </p>
          ) : (
            <CandidateActions
              candidateId={candidate.id}
              contacts={contactChoices}
              preferredContactId={preferredContactId}
              hasMatchingContact={candidate.matchingContacts.length > 0}
            />
          )}
          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer text-xs font-medium uppercase text-muted-foreground">
              Raw evidence metadata
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">
              {metadataToString(candidate.metadata)}
            </pre>
          </details>
        </aside>
      </div>
    </article>
  )
}

function EvidenceItem({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate">{value || "-"}</dd>
    </div>
  )
}

function mergeContactChoices(
  primary: CandidateReviewRow["matchingContacts"],
  contacts: Array<{
    id: string
    name: string
    company: string | null
    email: string | null
  }>
) {
  const byId = new Map<string, (typeof contacts)[number]>()
  for (const contact of [...primary, ...contacts]) {
    byId.set(contact.id, {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      email: contact.email,
    })
  }
  return [...byId.values()]
}

function formatDate(value: Date): string {
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function renderEvidenceRow(
  communication: CandidateReviewRow["evidenceCommunications"][number]
) {
  // Use the established source-system gate (Communication.createdBy) so
  // future non-msgraph email importers don't accidentally inherit Outlook
  // deeplinks. resolve-context.test.ts pins this contract.
  const deeplink = getOutlookDeeplinkForSource(
    communication.externalMessageId,
    communication.createdBy
  )
  const snippet = bodySnippet(communication.body)
  const title = communication.subject?.trim() || "(no subject)"

  return (
    <div
      key={communication.id}
      className="grid gap-1 border-b pb-2 last:border-b-0 last:pb-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {deeplink ? (
          <a
            href={deeplink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 max-w-full items-center gap-1 truncate font-medium text-blue-600 hover:underline"
          >
            <span className="truncate">{title}</span>
            <ExternalLink className="size-3 shrink-0 opacity-70" />
          </a>
        ) : (
          <span className="truncate font-medium">{title}</span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(communication.date)}
        </span>
      </div>
      {snippet ? (
        <p className="line-clamp-2 break-words text-xs text-muted-foreground">
          {snippet}
        </p>
      ) : null}
    </div>
  )
}

// Inbound emails can have noisy boilerplate at the top (header lines, mailto
// links, image src URLs). Strip the worst of it for the snippet so the user
// sees something readable in the 2-line preview.
function bodySnippet(body: string | null | undefined): string | null {
  if (!body) return null
  const cleaned = body
    .replace(/<https?:\/\/[^>]+>/g, "")
    .replace(/\[(?:cid|image)[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (cleaned.length === 0) return null
  return cleaned.length > 280 ? cleaned.slice(0, 280) + "…" : cleaned
}

function metadataToString(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
