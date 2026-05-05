import { isPersonalCategory } from "@/lib/contacts/profile-fact-display"
import { db } from "@/lib/prisma"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ProfileFactReviewActions } from "./profile-fact-review-actions"

interface Props {
  contactId: string
}

export function ContactRelationshipProfileCardFallback() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  )
}

function groupProfileFacts<
  T extends { category: string; id: string; fact: string; status: string },
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

function profileFactEvidence(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const evidence = (metadata as Record<string, unknown>).evidence
  return typeof evidence === "string" && evidence.trim()
    ? evidence.trim()
    : null
}

export async function ContactRelationshipProfileCard({ contactId }: Props) {
  // status: { in: ["active", "review"] } (audit fix May 2026): see the
  // matching comment in contact-personal-tab.tsx — review-status rows are
  // v7 inferred facts that need operator confirmation. They render with an
  // "Inferred — review" badge and inline Confirm / Dismiss buttons.
  const facts = await db.contactProfileFact.findMany({
    where: {
      contactId,
      status: { in: ["active", "review"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ category: "asc" }, { lastSeenAt: "desc" }],
  })

  const nonPersonal = facts.filter((f) => !isPersonalCategory(f.category))
  const hasPersonal = facts.some((f) => isPersonalCategory(f.category))

  if (nonPersonal.length === 0) {
    // Empty state instead of returning null. The skeleton resolving to
    // nothing pops the layout up; an empty card keeps the section
    // visible and makes it obvious that the AI extractor has run.
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Relationship Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>No workflow / transactional facts extracted yet.</p>
          {hasPersonal ? (
            <p className="text-xs">
              Personal context (family, hobbies, etc.) shown on the Personal
              tab.
            </p>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Relationship Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(groupProfileFacts(nonPersonal)).map(
          ([category, group]) => (
            <div key={category} className="space-y-1">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {formatProfileCategory(category)}
              </div>
              <ul className="space-y-2">
                {group.map((fact) => {
                  const isInferred = fact.status === "review"
                  return (
                    <li
                      key={fact.id}
                      className={`space-y-0.5 text-sm ${
                        isInferred
                          ? "rounded-md border border-amber-300 bg-amber-50/40 p-2"
                          : ""
                      }`}
                    >
                      {isInferred ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="border-amber-400 text-amber-700 bg-amber-50 text-[10px] py-0 px-1.5"
                            >
                              Inferred — review
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            AI inferred this from contextual signals; click
                            to confirm or dismiss.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      <div>{fact.fact}</div>
                      <div className="text-xs text-muted-foreground">
                        Source: {fact.sourceCommunicationId}
                        {profileFactEvidence(fact.metadata)
                          ? ` - ${profileFactEvidence(fact.metadata)}`
                          : ""}
                      </div>
                      {isInferred ? (
                        <ProfileFactReviewActions
                          contactId={contactId}
                          factId={fact.id}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        )}
        {hasPersonal ? (
          <p className="text-xs text-muted-foreground">
            Personal context (family, hobbies, etc.) shown on the Personal tab.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
