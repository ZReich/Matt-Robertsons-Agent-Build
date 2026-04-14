import Link from "next/link"
import { differenceInDays } from "date-fns"
import { Building2, Clock } from "lucide-react"

import type { DealMeta, DealStage } from "@/lib/vault"
import type { Metadata } from "next"

import { DEAL_STAGE_LABELS, listNotes } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Deals",
}

const CRE_STAGES: DealStage[] = [
  "prospecting",
  "listing",
  "marketing",
  "showings",
  "offer",
  "under-contract",
  "due-diligence",
  "closing",
  "closed",
]

const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-slate-100 text-slate-700",
  listing: "bg-blue-100 text-blue-700",
  marketing: "bg-indigo-100 text-indigo-700",
  showings: "bg-violet-100 text-violet-700",
  offer: "bg-amber-100 text-amber-700",
  "under-contract": "bg-orange-100 text-orange-700",
  "due-diligence": "bg-yellow-100 text-yellow-800",
  closing: "bg-emerald-100 text-emerald-700",
  closed: "bg-green-100 text-green-700",
}

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  office: "bg-blue-100 text-blue-800",
  retail: "bg-green-100 text-green-800",
  industrial: "bg-orange-100 text-orange-800",
  multifamily: "bg-purple-100 text-purple-800",
  land: "bg-amber-100 text-amber-800",
  "mixed-use": "bg-indigo-100 text-indigo-800",
  hospitality: "bg-pink-100 text-pink-800",
  medical: "bg-red-100 text-red-800",
  other: "bg-gray-100 text-gray-800",
}

function makeTaskId(path: string): string {
  return path
    .replace(/[/\\]/g, "-")
    .replace(/\.md$/, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
}

function formatValue(value?: number): string {
  if (!value) return ""
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString()}`
}

interface DealsPageProps {
  params: Promise<{ lang: string }>
}

export default async function DealsPage({ params }: DealsPageProps) {
  const { lang } = await params

  const notes = await listNotes<DealMeta>("clients")
  const deals = notes.filter((n) => n.meta.type === "deal")

  const activeDeals = deals.filter((d) => d.meta.stage !== "closed")
  const totalValue = deals.reduce((sum, d) => sum + (d.meta.value ?? 0), 0)

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">All Deals</h1>
          <p className="text-sm text-muted-foreground">
            {activeDeals.length} active · {deals.length} total ·{" "}
            {formatValue(totalValue)} pipeline value
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {CRE_STAGES.filter((stage) =>
          deals.some((d) => d.meta.stage === stage)
        ).map((stage) => {
          const stageDeals = deals.filter((d) => d.meta.stage === stage)
          return (
            <div key={stage}>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  className={`${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700"} border-0`}
                >
                  {DEAL_STAGE_LABELS[stage]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stageDeals.map((deal) => {
                  const dealId = makeTaskId(deal.path)
                  const clientName = deal.meta.client?.replace(/\[\[|\]\]/g, "")
                  const daysInStage = deal.meta.listed_date
                    ? differenceInDays(
                        new Date(),
                        new Date(deal.meta.listed_date)
                      )
                    : null

                  return (
                    <Link
                      key={deal.path}
                      href={`/${lang}/pages/deals/${dealId}`}
                    >
                      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm leading-snug">
                              {deal.meta.property_address}
                            </p>
                            {deal.meta.value && (
                              <span className="text-xs font-semibold shrink-0">
                                {formatValue(deal.meta.value)}
                              </span>
                            )}
                          </div>
                          {clientName && (
                            <p className="text-xs text-muted-foreground">
                              {clientName}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {deal.meta.property_type && (
                              <Badge
                                className={`text-xs capitalize border-0 ${PROPERTY_TYPE_COLORS[deal.meta.property_type] ?? "bg-gray-100 text-gray-800"}`}
                              >
                                {deal.meta.property_type.replace("-", " ")}
                              </Badge>
                            )}
                            {daysInStage !== null && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                {daysInStage}d
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {deals.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">
            No deals in the vault yet.
          </p>
        )}
      </div>
    </section>
  )
}
