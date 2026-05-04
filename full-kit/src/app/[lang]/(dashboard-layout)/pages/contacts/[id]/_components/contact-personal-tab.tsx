import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink } from "lucide-react"

import { getOutlookDeeplinkForSource } from "@/lib/communications/outlook-deeplink"
import {
  groupFactsByDisplayCategory,
  isPersonalCategory,
} from "@/lib/contacts/profile-fact-display"
import { db } from "@/lib/prisma"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  contactId: string
  lang: string
}

export function ContactPersonalTabFallback() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    </div>
  )
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

export async function ContactPersonalTab({ contactId, lang }: Props) {
  const profileFacts = await db.contactProfileFact.findMany({
    where: {
      contactId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ category: "asc" }, { lastSeenAt: "desc" }],
  })

  const personalFacts = profileFacts.filter((f) =>
    isPersonalCategory(f.category)
  )

  if (personalFacts.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
          <p>
            No personal context extracted yet. As emails come in, the scrub
            queue surfaces facts about family, pets, hobbies, travel, and other
            relationship texture here.
          </p>
          <p>
            If this contact has a long email history that predates the v6 scrub
            prompt, you can opt-in to re-scrub their inbox to backfill personal
            facts (operator action, costs Anthropic credit).
          </p>
        </CardContent>
      </Card>
    )
  }

  // Personal-tab data: split out personal-category facts and resolve their
  // source communications so each fact links back to where it was extracted
  // from. We deliberately fetch the source comms in one extra query rather
  // than blowing up the main profileFacts query with a relation join, since
  // most contacts have <20 facts and the join-overhead would be paid even
  // when the Personal tab isn't viewed.
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
    <div className="grid gap-4">
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Talking points pulled from prior emails. Each fact links back to the
          source so you can verify wording before a call. Sensitive context
          (medical, legal, financial distress) is filtered out at extraction
          time.
        </CardContent>
      </Card>
      {groupedPersonalFacts.personal.map((group) => (
        <Card key={group.category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {group.meta.label}
            </CardTitle>
            {group.meta.hint ? (
              <p className="text-xs text-muted-foreground">{group.meta.hint}</p>
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
                      Last seen {format(fact.lastSeenAt, "MMM d, yyyy")}
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
    </div>
  )
}
