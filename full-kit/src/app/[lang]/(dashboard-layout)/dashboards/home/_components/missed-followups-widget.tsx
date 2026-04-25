import Link from "next/link"
import { differenceInCalendarDays } from "date-fns"
import { ArrowRight, MailWarning } from "lucide-react"

import type { MissedFollowup } from "@/lib/dashboard/queries"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MissedFollowupsWidgetProps {
  followups: MissedFollowup[]
  total: number
  lang: string
  className?: string
}

export function MissedFollowupsWidget({
  followups,
  total,
  lang,
  className,
}: MissedFollowupsWidgetProps) {
  return (
    <Card className={`flex flex-col ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <MailWarning className="size-3.5" /> Missed Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {followups.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No follow-ups missed - nice work.
          </p>
        ) : (
          <div className="space-y-3">
            {followups.map((followup) => {
              const days = Math.max(
                2,
                differenceInCalendarDays(new Date(), followup.date)
              )
              const preview = trimPreview(
                followup.subject ?? followup.body ?? "Inbound message"
              )
              return (
                <Link
                  key={`${followup.contactId}-${followup.referenceCommunicationId}`}
                  href={`/${lang}/pages/leads/${followup.contactId}`}
                  className="flex items-start justify-between gap-3 rounded-md p-1 -m-1 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">
                      {followup.contactName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {preview}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${days >= 4 ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}
                  >
                    {days}d
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-4">
        <Link
          href={`/${lang}/pages/leads?needsFollowup=true`}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all {total} <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  )
}

function trimPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized
}
