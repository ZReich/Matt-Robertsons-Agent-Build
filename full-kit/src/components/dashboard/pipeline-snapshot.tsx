import Link from "next/link"

import type { DealStage, LeadStatus } from "@prisma/client"

import {
  serializeDealBoard,
  serializeLeadBoard,
} from "@/lib/pipeline/server/board"
import { db } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export async function PipelineSnapshot({
  board,
}: {
  board: "deals" | "leads"
}) {
  if (board === "deals") {
    const deals = await db.deal.findMany({
      where: {
        archivedAt: null,
        stage: { in: ["offer", "under_contract", "closing"] },
      },
      include: {
        contact: {
          select: { id: true, name: true, company: true, leadSource: true },
        },
      },
      orderBy: [{ stageChangedAt: "desc" }, { updatedAt: "desc" }],
      take: 24,
    })
    const snapshot = serializeDealBoard(deals).columns.filter((column) =>
      (["offer", "under_contract", "closing"] as DealStage[]).includes(
        column.id
      )
    )

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deal pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {snapshot.map((column) => (
            <div key={column.id} className="rounded-lg border p-3">
              <div className="mb-2 flex justify-between text-sm font-medium">
                <span>{column.title}</span>
                <span>{column.aggregate.count}</span>
              </div>
              <div className="space-y-2">
                {column.cards.slice(0, 3).map((card) => (
                  <div key={card.id} className="text-xs">
                    <div className="font-medium">{card.propertyAddress}</div>
                    <div className="text-muted-foreground">
                      {card.value !== null ? formatCurrency(card.value) : "-"}
                    </div>
                  </div>
                ))}
              </div>
              {column.cards.length > 3 ? (
                <Link
                  className="mt-2 block text-xs text-primary"
                  href="/pages/deals?view=kanban"
                >
                  +{column.cards.length - 3} more
                </Link>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const leads = await db.contact.findMany({
    where: {
      archivedAt: null,
      leadSource: { not: null },
      leadStatus: { in: ["new", "vetted", "contacted"] },
    },
    include: { communications: { orderBy: { date: "desc" }, take: 5 } },
    orderBy: [{ leadAt: "desc" }, { updatedAt: "desc" }],
    take: 24,
  })
  const snapshot = serializeLeadBoard(leads).columns.filter((column) =>
    (["new", "vetted", "contacted"] as LeadStatus[]).includes(column.id)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lead pipeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {snapshot.map((column) => (
          <div key={column.id} className="rounded-lg border p-3">
            <div className="mb-2 flex justify-between text-sm font-medium">
              <span>{column.title}</span>
              <span>{column.aggregate.count}</span>
            </div>
            <div className="space-y-2">
              {column.cards.slice(0, 3).map((card) => (
                <div key={card.id} className="text-xs">
                  <div className="font-medium">{card.name}</div>
                  <div className="text-muted-foreground">
                    {card.company ?? card.email ?? "No company"}
                  </div>
                </div>
              ))}
            </div>
            {column.cards.length > 3 ? (
              <Link
                className="mt-2 block text-xs text-primary"
                href="/pages/leads?view=kanban"
              >
                +{column.cards.length - 3} more
              </Link>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
