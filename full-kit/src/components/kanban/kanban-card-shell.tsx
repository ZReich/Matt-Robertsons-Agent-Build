import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function KanbanCardShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  )
}
