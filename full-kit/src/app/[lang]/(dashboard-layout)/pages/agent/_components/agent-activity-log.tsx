"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Check, Clock, Filter, Pause, Play, X } from "lucide-react"

import type { AgentActionView } from "./agent-control-center"

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
  actions: AgentActionView[]
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Check; color: string; label: string }
> = {
  approved: { icon: Check, color: "text-emerald-600", label: "Approved" },
  executed: { icon: Play, color: "text-blue-600", label: "Executed" },
  rejected: { icon: X, color: "text-red-600", label: "Rejected" },
  snoozed: { icon: Pause, color: "text-amber-600", label: "Snoozed" },
  pending: { icon: Clock, color: "text-orange-600", label: "Pending" },
}

export function AgentActivityLog({ actions }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const filtered = useMemo(() => {
    const items =
      filterStatus === "all"
        ? [...actions]
        : actions.filter((action) => action.status === filterStatus)
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [actions, filterStatus])

  const grouped = useMemo(() => {
    const groups: Record<string, AgentActionView[]> = {}
    for (const action of filtered) {
      const dateKey = format(new Date(action.createdAt), "yyyy-MM-dd")
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
            {[
              "all",
              "executed",
              "approved",
              "rejected",
              "snoozed",
              "pending",
            ].map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => setFilterStatus(status)}
              >
                {status === "all" ? "All Statuses" : status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No activity yet</p>
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
                  STATUS_CONFIG[action.status] ?? STATUS_CONFIG.pending
                const Icon = config.icon
                return (
                  <Card key={action.id}>
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
                              {action.summary}
                            </CardTitle>
                            <CardDescription className="mt-0.5 text-xs">
                              {action.actionType} -{" "}
                              {format(new Date(action.createdAt), "h:mm a")}
                              {action.targetEntity && (
                                <> - {action.targetEntity}</>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {action.feedback === "duplicate"
                            ? "Rejected duplicate"
                            : config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    {action.feedback && (
                      <CardContent className="pb-3 pt-0">
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          Feedback: {action.feedback}
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
