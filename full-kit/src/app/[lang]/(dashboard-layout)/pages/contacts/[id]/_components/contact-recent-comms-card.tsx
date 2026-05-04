import { db } from "@/lib/prisma"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { renderCommRow } from "./contact-comm-row"

interface Props {
  contactId: string
  lang: string
}

export function ContactRecentCommsCardFallback() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </CardContent>
    </Card>
  )
}

export async function ContactRecentCommsCard({ contactId, lang }: Props) {
  const recent = await db.communication.findMany({
    where: { contactId, archivedAt: null },
    orderBy: { date: "desc" },
    take: 5,
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
  })

  if (recent.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Communications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recent.map((c) => renderCommRow(c, lang))}
      </CardContent>
    </Card>
  )
}
