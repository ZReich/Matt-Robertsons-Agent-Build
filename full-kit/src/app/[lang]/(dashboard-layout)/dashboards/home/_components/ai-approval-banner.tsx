"use client"

import Link from "next/link"
import { ArrowRight, Bot } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface AIApprovalBannerProps {
  proposedCount: number
  proposedTitles: string[]
  agentSuggestionCount: number
  agentSuggestionTitles: string[]
  agentQueueHref: string
}

export function AIApprovalBanner({
  proposedCount,
  proposedTitles,
  agentSuggestionCount,
  agentSuggestionTitles,
  agentQueueHref,
}: AIApprovalBannerProps) {
  const totalCount = proposedCount + agentSuggestionCount
  if (totalCount === 0) return null

  function focusReviewSection() {
    const target = document.getElementById("dashboard-todos-review")
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
    target?.focus({ preventScroll: true })
  }

  const titles = [...proposedTitles, ...agentSuggestionTitles].slice(0, 3)
  const showQueueLink = agentSuggestionCount > 0

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <Bot className="size-5" />
          </div>
          <div>
            <p className="font-semibold">
              {totalCount} AI-proposed task{totalCount !== 1 ? "s" : ""} waiting
              for approval
            </p>
            {titles.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {titles.join(" • ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {proposedCount > 0 && (
            <Button size="sm" onClick={focusReviewSection}>
              Review <ArrowRight className="ms-1 size-3.5" />
            </Button>
          )}
          {showQueueLink && (
            <Button
              size="sm"
              variant={proposedCount > 0 ? "outline" : "default"}
              asChild
            >
              <Link href={agentQueueHref}>
                Agent Queue <ArrowRight className="ms-1 size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
