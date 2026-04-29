import Link from "next/link"
import { Building2, Clock } from "lucide-react"

import type { Metadata } from "next"

import {
  narrowToBoardDeals,
  parsePipelineFilters,
  serializeDealBoard,
} from "@/lib/pipeline/server/board"
import { toURLSearchParams } from "@/lib/pipeline/server/search-params"
import { DEAL_STAGE_LABELS } from "@/lib/pipeline/stage-probability"
import { db } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DealsKanban } from "./_components/deals-kanban"
import { PipelineFiltersBar } from "@/components/pipeline/pipeline-filters-bar"

export const metadata: Metadata = {
  title: "Deals",
}

export const dynamic = "force-dynamic"

interface DealsPageProps {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}
export default async function DealsPage({
  params,
  searchParams,
}: DealsPageProps) {
  const { lang } = await params
  const resolvedSearchParams = toURLSearchParams(await searchParams)
  const view = resolvedSearchParams.get("view") === "kanban" ? "kanban" : "list"
  const filters = parsePipelineFilters(resolvedSearchParams)
  const closedCutoff = new Date(Date.now() - 90 * 86_400_000)

  const dealsRaw = await db.deal.findMany({
    where: {
      archivedAt: null,
      // Board surfaces only seller-rep deals with a parsed property; buyer-rep
      // and unparsed-property deals get their own surfaces later.
      dealType: "seller_rep",
      propertyAddress: { not: null },
      propertyType: { not: null },
      ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
      ...(filters.source ? { contact: { leadSource: filters.source } } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                propertyAddress: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                contact: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
              {
                contact: {
                  company: { contains: filters.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(filters.showAll
        ? {}
        : {
            OR: [
              { stage: { not: "closed" } },
              { stageChangedAt: { gte: closedCutoff } },
              { stageChangedAt: null, updatedAt: { gte: closedCutoff } },
            ],
          }),
    },
    include: {
      contact: {
        select: { id: true, name: true, company: true, leadSource: true },
      },
    },
    orderBy: [{ stageChangedAt: "desc" }, { updatedAt: "desc" }],
  })

  const deals = narrowToBoardDeals(dealsRaw)
  const board = serializeDealBoard(deals, filters)
  const listCards = board.columns.flatMap((column) => column.cards)
  const activeDeals = listCards.filter((deal) => deal.stage !== "closed")

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">All Deals</h1>
          <p className="text-sm text-muted-foreground">
            {activeDeals.length} active · {listCards.length} total ·{" "}
            {formatCurrency(board.aggregates.grossValue)} pipeline value
          </p>
        </div>
      </div>

      <PipelineFiltersBar
        basePath={`/${lang}/pages/deals`}
        view={view}
        filters={filters}
        showPropertyType
      />

      {view === "kanban" ? (
        <DealsKanban columns={board.columns} />
      ) : listCards.length === 0 ? (
        <p className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
          No deals match these filters.
        </p>
      ) : (
        <div className="space-y-6">
          {board.columns
            .filter((column) => column.cards.length > 0)
            .map((column) => (
              <div key={column.id}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="border-0 bg-muted text-foreground">
                    {DEAL_STAGE_LABELS[column.id]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {column.aggregate.count} deal
                    {column.aggregate.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {column.cards.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/${lang}/pages/deals/${deal.id}`}
                    >
                      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">
                              {deal.propertyAddress}
                            </p>
                            <span className="shrink-0 text-xs font-semibold">
                              {deal.value !== null
                                ? formatCurrency(deal.value)
                                : "-"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {deal.clientName ?? "No contact"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-0 bg-muted text-xs capitalize text-foreground">
                              {deal.propertyType.replace(/_/g, " ")}
                            </Badge>
                            {deal.ageInStageDays !== null ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />{" "}
                                {deal.ageInStageDays}d
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}
