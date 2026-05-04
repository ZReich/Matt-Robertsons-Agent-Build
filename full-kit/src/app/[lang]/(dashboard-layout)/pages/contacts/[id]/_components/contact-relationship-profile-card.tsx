import { isPersonalCategory } from "@/lib/contacts/profile-fact-display"
import { db } from "@/lib/prisma"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
  const facts = await db.contactProfileFact.findMany({
    where: {
      contactId,
      status: "active",
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
              <ul className="space-y-1">
                {group.map((fact) => (
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
