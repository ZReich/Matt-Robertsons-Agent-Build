import type { LeadStatus } from "@prisma/client"

import { cn } from "@/lib/utils"

const LABELS: Record<LeadStatus, string> = {
  new: "New",
  vetted: "Vetted",
  contacted: "Contacted",
  converted: "Converted",
  dropped: "Dropped",
}

const CLASSES: Record<LeadStatus, string> = {
  new: "border-blue-500/35 bg-blue-500/15 text-blue-600",
  vetted: "border-border bg-muted text-muted-foreground",
  contacted: "border-amber-500/30 bg-amber-500/15 text-amber-700",
  converted: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700",
  dropped: "border-border/60 bg-muted/50 text-muted-foreground",
}

export function StatusChip({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        CLASSES[status]
      )}
    >
      {LABELS[status]}
    </span>
  )
}
