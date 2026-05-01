"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import type { DealCard as DealCardData } from "@/lib/pipeline/server/board"

import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { KanbanCardShell } from "@/components/kanban/kanban-card-shell"

export function DealCard({ card }: { card: DealCardData }) {
  const params = useParams()
  const lang = (params?.lang as string) ?? "en"

  return (
    <Link
      href={`/${lang}${card.href}`}
      className="block focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <KanbanCardShell>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold">
              {card.propertyAddress}
            </p>
            <span className="shrink-0 text-xs font-semibold">
              {card.value !== null ? formatCurrency(card.value) : "-"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {card.clientName ?? "No contact"}
            {card.clientCompany ? ` - ${card.clientCompany}` : ""}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {card.propertyType
                ? card.propertyType.replace(/_/g, " ")
                : "Type pending"}
            </Badge>
            <Badge variant="outline">{card.probability}%</Badge>
            {card.ageInStageDays !== null ? (
              <Badge variant="outline">{card.ageInStageDays}d</Badge>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Weighted commission:{" "}
            <span className="font-medium text-foreground">
              {card.weightedCommission !== null
                ? formatCurrency(card.weightedCommission)
                : "-"}
            </span>
          </div>
        </div>
      </KanbanCardShell>
    </Link>
  )
}
