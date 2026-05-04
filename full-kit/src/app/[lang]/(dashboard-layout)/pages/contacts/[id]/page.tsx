import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Smartphone,
  User,
} from "lucide-react"

import type { Metadata } from "next"
import type { ReactNode } from "react"

import { readCachedSummary } from "@/lib/ai/contact-summarizer"
import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { getOutlookDeeplinkForSource } from "@/lib/communications/outlook-deeplink"
import {
  groupFactsByDisplayCategory,
  isPersonalCategory,
} from "@/lib/contacts/profile-fact-display"
import { findMatchesForContact } from "@/lib/matching/queries"
import { DEAL_STAGES } from "@/lib/pipeline/stage-probability"
import { db } from "@/lib/prisma"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactArcSummary } from "@/components/contacts/contact-arc-summary"
import {
  ContactEditPanel,
  type SearchCriteriaShape,
} from "@/components/contacts/contact-edit-panel"
import { LeadAISuggestions } from "@/components/leads/lead-ai-suggestions"

interface ContactDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export async function generateMetadata({
  params,
}: ContactDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const contact = await db.contact.findUnique({
    where: { id },
    select: { name: true },
  })
  return {
    title: contact?.name ?? "Contact",
  }
}

// Always render from the live DB; never statically pre-render.
export const dynamic = "force-dynamic"

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { id, lang } = await params

  const COMM_LIMIT = 200
  const [
    contact,
    profileFacts,
    contactComms,
    totalCommCount,
    contactMeetingAttendees,
    deals,
    aiSuggestions,
    cachedArcSummary,
    propertyMatches,
  ] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    db.contactProfileFact.findMany({
      where: {
        contactId: id,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ category: "asc" }, { lastSeenAt: "desc" }],
    }),
    db.communication.findMany({
      where: { contactId: id, archivedAt: null },
      orderBy: { date: "desc" },
      take: COMM_LIMIT,
      select: {
        id: true,
        channel: true,
        subject: true,
        date: true,
        direction: true,
        createdBy: true,
        externalMessageId: true,
        deal: { select: { id: true, propertyAddress: true } },
      },
    }),
    db.communication.count({
      where: { contactId: id, archivedAt: null },
    }),
    db.meetingAttendee.findMany({
      where: { contactId: id, meeting: { archivedAt: null } },
      orderBy: { meeting: { date: "desc" } },
      select: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
          },
        },
      },
    }),
    db.deal.findMany({
      where: { contactId: id, archivedAt: null },
      // We sort in JS by canonical pipeline order; Prisma `stage: asc` would
      // sort lexically (e.g., "closed" before "marketing") which is wrong.
      orderBy: { stageChangedAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        stage: true,
        dealType: true,
        stageChangedAt: true,
      },
    }),
    getAiSuggestionState({ entityType: "contact", entityId: id }),
    readCachedSummary(id),
    findMatchesForContact(id, { limit: 8 }),
  ])

  if (!contact) notFound()

  const contactMeetings = contactMeetingAttendees
    .map((row) => row.meeting)
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const now = new Date()
  const upcomingMeetings = contactMeetings.filter((m) => m.date >= now)

  // Sort deals by canonical pipeline-stage order (prospecting → closed),
  // breaking ties with most-recent stage change first. Prisma can't sort by
  // enum order natively.
  const stageRank = new Map<string, number>(
    DEAL_STAGES.map((stage, idx) => [stage, idx])
  )
  const orderedDeals = [...deals].sort((a, b) => {
    const rankA = stageRank.get(a.stage) ?? DEAL_STAGES.length
    const rankB = stageRank.get(b.stage) ?? DEAL_STAGES.length
    if (rankA !== rankB) return rankA - rankB
    const tA = a.stageChangedAt?.getTime() ?? 0
    const tB = b.stageChangedAt?.getTime() ?? 0
    return tB - tA
  })

  const totalActivity = totalCommCount + contactMeetings.length
  const commsTruncated = totalCommCount > contactComms.length

  // Personal-tab data: split out personal-category facts and resolve their
  // source communications so each fact links back to where it was extracted
  // from. We deliberately fetch the source comms in one extra query rather
  // than blowing up the main profileFacts query with a relation join, since
  // most contacts have <20 facts and the join-overhead would be paid even
  // when the Personal tab isn't viewed.
  const personalFacts = profileFacts.filter((f) => isPersonalCategory(f.category))
  const personalFactSourceIds = Array.from(
    new Set(personalFacts.map((f) => f.sourceCommunicationId).filter(Boolean))
  )
  const personalFactSourceComms =
    personalFactSourceIds.length > 0
      ? await db.communication.findMany({
          where: { id: { in: personalFactSourceIds } },
          select: {
            id: true,
            subject: true,
            date: true,
            channel: true,
            externalMessageId: true,
            createdBy: true,
            deal: { select: { id: true, propertyAddress: true } },
          },
        })
      : []
  const personalFactSourceById = new Map(
    personalFactSourceComms.map((c) => [c.id, c])
  )
  const groupedPersonalFacts = groupFactsByDisplayCategory(personalFacts)

  return (
    <section className="container max-w-3xl grid gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <User className="size-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          {(contact.role || contact.company) && (
            <p className="text-muted-foreground">
              {[contact.role, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {parseTags(contact.tags).map((t) => (
              <Badge key={t} variant="secondary" className="capitalize">
                {t.replace(/-/g, " ")}
              </Badge>
            ))}
            {upcomingMeetings.length > 0 && (
              <Badge variant="secondary">
                {upcomingMeetings.length} upcoming meeting
                {upcomingMeetings.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {contactComms.length > 0 && (
              <Badge variant="outline">
                {contactComms.length} comm
                {contactComms.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <ContactArcSummary
        contactId={contact.id}
        initialSummary={
          cachedArcSummary
            ? {
                contactId: cachedArcSummary.contactId,
                summary: cachedArcSummary.summary,
                generatedAt: cachedArcSummary.generatedAt.toISOString(),
                modelUsed: cachedArcSummary.modelUsed,
                fromCache: true,
              }
            : null
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">
            Personal{personalFacts.length > 0 ? ` (${personalFacts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity ({totalActivity})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {contact.address}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <LeadAISuggestions state={aiSuggestions} lang={lang} />

          {profileFacts.some((f) => !isPersonalCategory(f.category)) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Relationship Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(
                  groupProfileFacts(
                    profileFacts.filter((f) => !isPersonalCategory(f.category))
                  )
                ).map(([category, facts]) => (
                  <div key={category} className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {formatProfileCategory(category)}
                    </div>
                    <ul className="space-y-1">
                      {facts.map((fact) => (
                        <li key={fact.id} className="space-y-0.5 text-sm">
                          <div>{fact.fact}</div>
                          <div className="text-xs text-muted-foreground">
                            Source: {fact.sourceCommunicationId}
                            {profileFactEvidence(fact.metadata)
                              ? ` - ${profileFactEvidence(fact.metadata)}`
                              : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {personalFacts.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Personal context (family, hobbies, etc.) shown on the
                    Personal tab.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          {propertyMatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Matching properties ({propertyMatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {propertyMatches.map((m) => (
                  <Link
                    key={m.property.id}
                    href={`/${lang}/pages/properties/${m.property.id}`}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {m.property.name ?? m.property.address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.reasons.slice(0, 2).join(" · ")}
                      </div>
                    </div>
                    <Badge
                      variant={m.score >= 80 ? "default" : "secondary"}
                      className="shrink-0 text-xs"
                    >
                      {m.score}%
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {orderedDeals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Deals ({orderedDeals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orderedDeals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${lang}/pages/deals/${d.id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {d.propertyAddress ?? "(no address)"}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {d.stage.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {upcomingMeetings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingMeetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span className="font-medium">{m.title}</span>
                    <span className="text-muted-foreground">
                      {format(m.date, "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {contactComms.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Communications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contactComms.slice(0, 5).map((c) =>
                  renderCommRow(c, lang)
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Personal — relationship-building texture (family, hobbies, etc.) */}
        <TabsContent value="personal" className="mt-4 grid gap-4">
          {personalFacts.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
                <p>
                  No personal context extracted yet. As emails come in, the
                  scrub queue surfaces facts about family, pets, hobbies,
                  travel, and other relationship texture here.
                </p>
                <p>
                  If this contact has a long email history that predates the
                  v6 scrub prompt, you can opt-in to re-scrub their inbox to
                  backfill personal facts (operator action, costs Anthropic
                  credit).
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4 text-xs text-muted-foreground">
                  Talking points pulled from prior emails. Each fact links
                  back to the source so you can verify wording before a
                  call. Sensitive context (medical, legal, financial
                  distress) is filtered out at extraction time.
                </CardContent>
              </Card>
              {groupedPersonalFacts.personal.map((group) => (
                <Card key={group.category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {group.meta.label}
                    </CardTitle>
                    {group.meta.hint ? (
                      <p className="text-xs text-muted-foreground">
                        {group.meta.hint}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.facts.map((fact) => {
                      const sourceComm = personalFactSourceById.get(
                        fact.sourceCommunicationId
                      )
                      const deeplink = sourceComm
                        ? getOutlookDeeplinkForSource(
                            sourceComm.externalMessageId,
                            sourceComm.createdBy
                          )
                        : null
                      const evidence = profileFactEvidence(fact.metadata)
                      return (
                        <div
                          key={fact.id}
                          className="space-y-1 rounded-md border p-3 text-sm"
                        >
                          <div className="font-medium">{fact.fact}</div>
                          {evidence ? (
                            <div className="text-xs italic text-muted-foreground">
                              &ldquo;{evidence}&rdquo;
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Last seen{" "}
                              {format(fact.lastSeenAt, "MMM d, yyyy")}
                            </span>
                            {sourceComm ? (
                              <>
                                <span>·</span>
                                {deeplink ? (
                                  <a
                                    href={deeplink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    {sourceComm.subject?.trim() ||
                                      `(${sourceComm.channel})`}
                                    <ExternalLink className="size-3 opacity-70" />
                                  </a>
                                ) : (
                                  <span>
                                    {sourceComm.subject?.trim() ||
                                      `(${sourceComm.channel})`}
                                  </span>
                                )}
                                {sourceComm.deal ? (
                                  <>
                                    <span>·</span>
                                    <Link
                                      href={`/${lang}/pages/deals/${sourceComm.deal.id}`}
                                      className="hover:underline"
                                    >
                                      {sourceComm.deal.propertyAddress ?? "deal"}
                                    </Link>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Activity Tab — Prisma-backed chronological feed */}
        <TabsContent value="activity" className="mt-4">
          {totalActivity === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No activity recorded for this contact yet.
            </p>
          ) : (
            <Card>
              <CardContent className="space-y-1 p-4">
                {commsTruncated ? (
                  <p className="mb-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Showing latest {contactComms.length} communications of{" "}
                    {totalCommCount} total. Older communications are not
                    rendered.
                  </p>
                ) : null}
                {buildActivityFeed(contactComms, contactMeetings).map(
                  (event) => renderActivityEvent(event, lang)
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Notes & profile */}
        <TabsContent value="notes" className="mt-4">
          <ContactEditPanel
            contactId={contact.id}
            initialTags={parseTags(contact.tags)}
            initialNotes={contact.notes}
            initialSearchCriteria={parseSearchCriteria(contact.searchCriteria)}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function groupProfileFacts<
  T extends { category: string; id: string; fact: string },
>(facts: T[]): Record<string, T[]> {
  return facts.reduce<Record<string, T[]>>((groups, fact) => {
    const key = fact.category || "other"
    groups[key] = [...(groups[key] ?? []), fact]
    return groups
  }, {})
}

function formatProfileCategory(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function parseSearchCriteria(value: unknown): SearchCriteriaShape | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as SearchCriteriaShape
}

function profileFactEvidence(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const evidence = (metadata as Record<string, unknown>).evidence
  return typeof evidence === "string" && evidence.trim()
    ? evidence.trim()
    : null
}

type CommRow = {
  id: string
  channel: string
  subject: string | null
  date: Date
  direction: "inbound" | "outbound" | null
  createdBy: string | null
  externalMessageId: string | null
  deal: { id: string; propertyAddress: string | null } | null
}

type MeetingRow = {
  id: string
  title: string
  date: Date
  location: string | null
}

type ActivityEvent =
  | { kind: "comm"; date: Date; comm: CommRow }
  | { kind: "meeting"; date: Date; meeting: MeetingRow }

function buildActivityFeed(
  comms: CommRow[],
  meetings: MeetingRow[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...comms.map((comm) => ({ kind: "comm" as const, date: comm.date, comm })),
    ...meetings.map((meeting) => ({
      kind: "meeting" as const,
      date: meeting.date,
      meeting,
    })),
  ]
  // Sort by date desc with id tiebreaker so render order is stable across
  // re-renders when two events share a millisecond.
  events.sort((a, b) => {
    const dt = b.date.getTime() - a.date.getTime()
    if (dt !== 0) return dt
    const idA = a.kind === "comm" ? a.comm.id : a.meeting.id
    const idB = b.kind === "comm" ? b.comm.id : b.meeting.id
    return idA.localeCompare(idB)
  })
  return events
}

function channelIcon(channel: string): ReactNode {
  switch (channel) {
    case "email":
      return <Mail className="size-4 text-blue-500" />
    case "call":
    case "voice":
      return <Phone className="size-4 text-green-500" />
    case "text":
    case "sms":
      return <MessageSquare className="size-4 text-violet-500" />
    case "whatsapp":
      return <Smartphone className="size-4 text-teal-500" />
    case "meeting":
      return <Calendar className="size-4 text-amber-500" />
    default:
      return <MessageSquare className="size-4 text-muted-foreground" />
  }
}

function renderCommRow(c: CommRow, lang: string): ReactNode {
  const deeplink = getOutlookDeeplinkForSource(c.externalMessageId, c.createdBy)
  const subject = c.subject?.trim() || `(${c.channel})`
  return (
    <div key={c.id} className="flex items-center gap-2 text-sm">
      <span className="shrink-0">{channelIcon(c.channel)}</span>
      {c.direction === "inbound" ? (
        <ArrowDownLeft className="size-3 shrink-0 text-muted-foreground" />
      ) : c.direction === "outbound" ? (
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
      ) : null}
      {deeplink ? (
        <a
          href={deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 truncate text-blue-600 hover:underline"
        >
          {subject}
          <ExternalLink className="ms-1 inline size-3 opacity-70" />
        </a>
      ) : (
        <span className="flex-1 truncate">{subject}</span>
      )}
      {c.deal ? (
        <Link
          href={`/${lang}/pages/deals/${c.deal.id}`}
          className="shrink-0 text-xs text-muted-foreground hover:underline"
        >
          {c.deal.propertyAddress ?? "deal"}
        </Link>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground">
        {format(c.date, "MMM d, yyyy")}
      </span>
    </div>
  )
}

function renderActivityEvent(event: ActivityEvent, lang: string): ReactNode {
  if (event.kind === "comm") {
    return (
      <div key={`comm:${event.comm.id}`} className="border-b py-2 last:border-b-0">
        {renderCommRow(event.comm, lang)}
      </div>
    )
  }
  return (
    <div
      key={`meeting:${event.meeting.id}`}
      className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0"
    >
      <Calendar className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1 truncate font-medium">{event.meeting.title}</span>
      {event.meeting.location ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {event.meeting.location}
        </span>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground">
        {format(event.meeting.date, "MMM d, yyyy h:mm a")}
      </span>
    </div>
  )
}
