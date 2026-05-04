import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Mail, MapPin, Phone, User } from "lucide-react"

import type { SearchCriteriaShape } from "@/components/contacts/contact-edit-panel"
import type { Metadata } from "next"

import { readCachedSummary } from "@/lib/ai/contact-summarizer"
import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { PERSONAL_CATEGORY_RENDER_ORDER } from "@/lib/contacts/profile-fact-display"
import { db } from "@/lib/prisma"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactActivityTab } from "./_components/contact-activity-tab"
import {
  ContactDealsCard,
  ContactDealsCardFallback,
} from "./_components/contact-deals-card"
import {
  ContactPersonalTab,
  ContactPersonalTabFallback,
} from "./_components/contact-personal-tab"
import {
  ContactPropertyMatchesCard,
  ContactPropertyMatchesCardFallback,
} from "./_components/contact-property-matches-card"
import {
  ContactRecentCommsCard,
  ContactRecentCommsCardFallback,
} from "./_components/contact-recent-comms-card"
import {
  ContactRelationshipProfileCard,
  ContactRelationshipProfileCardFallback,
} from "./_components/contact-relationship-profile-card"
import {
  ContactUpcomingMeetingsCard,
  ContactUpcomingMeetingsCardFallback,
} from "./_components/contact-upcoming-meetings-card"
import { ContactArcSummary } from "@/components/contacts/contact-arc-summary"
import { ContactEditPanel } from "@/components/contacts/contact-edit-panel"
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

  // Header-critical data: contact row, AI summary blobs the header cards
  // hydrate from, plus the two `(N)` badge counts the user wants on the
  // Activity / Personal tab triggers. The counts use the new composite
  // indexes (contact_id, archived_at) and (contact_id, status) and are
  // cheap enough to keep upfront — they fit in the same Promise.all wave
  // as the contact lookup.
  //
  // Everything else streams in below via Suspense so the user sees the
  // page shell within ~100ms instead of waiting on ~9 parallel queries.
  const [
    contact,
    aiSuggestions,
    cachedArcSummary,
    totalActivityCount,
    personalFactCount,
  ] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    getAiSuggestionState({ entityType: "contact", entityId: id }),
    readCachedSummary(id),
    db.communication.count({ where: { contactId: id, archivedAt: null } }),
    db.contactProfileFact.count({
      where: {
        contactId: id,
        status: "active",
        category: { in: [...PERSONAL_CATEGORY_RENDER_ORDER] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
  ])

  if (!contact) notFound()

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
            {personalFactCount > 0
              ? `Personal (${personalFactCount})`
              : "Personal"}
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({totalActivityCount})
          </TabsTrigger>
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

          <Suspense fallback={<ContactRelationshipProfileCardFallback />}>
            <ContactRelationshipProfileCard contactId={contact.id} />
          </Suspense>

          <Suspense fallback={<ContactPropertyMatchesCardFallback />}>
            <ContactPropertyMatchesCard contactId={contact.id} lang={lang} />
          </Suspense>

          <Suspense fallback={<ContactDealsCardFallback />}>
            <ContactDealsCard contactId={contact.id} lang={lang} />
          </Suspense>

          <Suspense fallback={<ContactUpcomingMeetingsCardFallback />}>
            <ContactUpcomingMeetingsCard contactId={contact.id} />
          </Suspense>

          <Suspense fallback={<ContactRecentCommsCardFallback />}>
            <ContactRecentCommsCard contactId={contact.id} lang={lang} />
          </Suspense>
        </TabsContent>

        {/* Personal — relationship-building texture (family, hobbies, etc.) */}
        <TabsContent value="personal" className="mt-4">
          <Suspense fallback={<ContactPersonalTabFallback />}>
            <ContactPersonalTab contactId={contact.id} lang={lang} />
          </Suspense>
        </TabsContent>

        {/* Activity Tab — client-fetched feed. Radix unmounts non-active
            TabsContent so this component (and its fetch) only mounts once
            the user actually clicks the Activity tab — Overview no longer
            pays the cost of the 200-row activity query. */}
        <TabsContent value="activity" className="mt-4">
          <ContactActivityTab contactId={contact.id} lang={lang} />
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

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function parseSearchCriteria(value: unknown): SearchCriteriaShape | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as SearchCriteriaShape
}
