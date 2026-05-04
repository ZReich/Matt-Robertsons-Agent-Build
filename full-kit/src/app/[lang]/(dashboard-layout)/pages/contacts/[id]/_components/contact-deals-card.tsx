import Link from "next/link"
import { Building2 } from "lucide-react"

import { DEAL_STAGES } from "@/lib/pipeline/stage-probability"
import { db } from "@/lib/prisma"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  contactId: string
  lang: string
}

export function ContactDealsCardFallback() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
      </CardContent>
    </Card>
  )
}

export async function ContactDealsCard({ contactId, lang }: Props) {
  const deals = await db.deal.findMany({
    where: { contactId, archivedAt: null },
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
  })

  if (deals.length === 0) {
    // Empty-state card (instead of `return null`) so the skeleton
    // resolves to something visible. Returning null caused a layout pop
    // — skeleton shown during Suspense → component returns null →
    // everything below jumps up. The empty state is also a UX win since
    // the user can see the section exists.
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Deals
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No deals yet.
        </CardContent>
      </Card>
    )
  }

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

  return (
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
  )
}
