"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import type { LeadCard as LeadCardData } from "@/lib/pipeline/server/board"

import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { KanbanCardShell } from "@/components/kanban/kanban-card-shell"

export function LeadCard({ card }: { card: LeadCardData }) {
  const params = useParams()
  const lang = (params?.lang as string) ?? "en"

  return (
    <Link
      href={`/${lang}${card.href}`}
      className="block focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <KanbanCardShell>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold">{card.name}</p>
            <p className="text-xs text-muted-foreground">
              {card.company ?? card.email ?? "No company"}
            </p>
          </div>
          {card.snippet ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              “{card.snippet}”
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {card.leadSource.replace(/_/g, " ")}
            </Badge>
            {card.estimatedValue !== null ? (
              <Badge variant="outline">
                {formatCurrency(card.estimatedValue)}
              </Badge>
            ) : null}
            {card.ageDays !== null ? (
              <Badge variant="outline">{card.ageDays}d</Badge>
            ) : null}
          </div>
          {card.lastTouchAt ? (
            <p className="text-xs text-muted-foreground">
              Last touch {new Date(card.lastTouchAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      </KanbanCardShell>
    </Link>
  )
}
