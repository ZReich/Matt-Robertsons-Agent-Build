import Link from "next/link"

import { findMatchesForContact } from "@/lib/matching/queries"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  contactId: string
  lang: string
}

export function ContactPropertyMatchesCardFallback() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  )
}

export async function ContactPropertyMatchesCard({ contactId, lang }: Props) {
  const propertyMatches = await findMatchesForContact(contactId, { limit: 8 })
  if (propertyMatches.length === 0) {
    // Empty state instead of returning null — keeps layout stable across
    // the Suspense skeleton transition and signals to the user that the
    // matching engine ran but produced nothing (vs the section silently
    // not existing).
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Matching properties
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No matching properties for this contact&apos;s search criteria.
        </CardContent>
      </Card>
    )
  }

  return (
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
  )
}
