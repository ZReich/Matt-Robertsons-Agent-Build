"use client"

import { Briefcase, Globe, User } from "lucide-react"

import type { ViewMode } from "@/contexts/view-context"

import { cn } from "@/lib/utils"

import { useViewMode } from "@/hooks/use-view-mode"

const modes: { value: ViewMode; label: string; icon: typeof Globe }[] = [
  { value: "everything", label: "All", icon: Globe },
  { value: "business", label: "Work", icon: Briefcase },
  { value: "personal", label: "Life", icon: User },
]

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode()

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {modes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setViewMode(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            viewMode === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
