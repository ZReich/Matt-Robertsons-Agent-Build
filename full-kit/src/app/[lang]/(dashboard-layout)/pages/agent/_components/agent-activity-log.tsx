"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Check, Clock, Filter, Play, X } from "lucide-react"

import type { AgentActionMeta, VaultNote } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Props {
  actions: VaultNote<AgentActionMeta>[]
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Check; color: string; label: string }
> = {
  approved: {
    icon: Check,
    color: "text-emerald-600",
    label: "Approved",
  },
  executed: {
    icon: Play,
    color: "text-blue-600",
    label: "Executed",
  },
  rejected: {
    icon: X,
    color: "text-red-600",
    label: "Rejected",
  },
  pending: {
    icon: Clock,
    color: "text-orange-600",
    label: "Pending",
  },
}

export function AgentActivityLog({ actions }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const filtered = useMemo(() => {
    let items = [...actions]

    if (filterStatus !== "all") {
      items = items.filter((a) => a.meta.status === filterStatus)
    }

    // Sort by date descending
    items.sort(
      (a, b) =>
        new Date(b.meta.created_at).getTime() -
        new Date(a.meta.created_at).getTime()
    )

    return items
  }, [actions, filterStatus])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, VaultNote<AgentActionMeta>[]> = {}
    for (const action of filtered) {
      const dateKey = format(new Date(action.meta.created_at), "yyyy-MM-dd")
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(action)
    }
    return groups
  }, [filtered])

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} action{filtered.length !== 1 ? "s" : ""} recorded
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1 h-4 w-4" />
              {filterStatus === "all" ? "All Statuses" : filterStatus}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterStatus("all")}>
              All Statuses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("executed")}>
              Executed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("approved")}>
              Approved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus("rejected")}>
              Rejected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No activity yet</p>
            <p className="text-sm text-muted-foreground">
              Agent actions will appear here once the agent starts working.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([dateKey, items]) => (
          <div key={dateKey}>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
            </p>
            <div className="grid gap-2">
              {items.map((action) => {
                const config =
                  STATUS_CONFIG[action.meta.status] ?? STATUS_CONFIG.pending
                const Icon = config.icon

                return (
                  <Card key={action.path}>
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-full p-1 ${config.color}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">
                              {action.meta.summary}
                            </CardTitle>
                            <CardDescription className="mt-0.5 text-xs">
                              {action.meta.action_type} &middot;{" "}
                              {format(
                                new Date(action.meta.created_at),
                                "h:mm a"
                              )}
                              {action.meta.target_entity && (
                                <> &middot; {action.meta.target_entity}</>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    {action.meta.feedback && (
                      <CardContent className="pb-3 pt-0">
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          Feedback: {action.meta.feedback}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
