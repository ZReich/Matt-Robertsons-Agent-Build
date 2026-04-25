import type { LeadSource } from "@prisma/client"

import { cn } from "@/lib/utils"

const LABELS: Record<LeadSource, string> = {
  crexi: "Crexi",
  loopnet: "LoopNet",
  buildout: "Buildout",
  email_cold: "Email",
  referral: "Referral",
}

const CLASSES: Record<LeadSource, string> = {
  crexi: "border-orange-500/35 bg-orange-500/15 text-orange-600",
  loopnet: "border-blue-500/35 bg-blue-500/15 text-blue-600",
  buildout: "border-violet-500/35 bg-violet-500/15 text-violet-600",
  email_cold: "border-gray-500/35 bg-gray-500/15 text-gray-600",
  referral: "border-teal-500/35 bg-teal-500/15 text-teal-600",
}

export function SourceBadge({ source }: { source: LeadSource }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CLASSES[source]
      )}
    >
      {LABELS[source]}
    </span>
  )
}
