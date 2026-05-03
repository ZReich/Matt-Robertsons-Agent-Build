"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { AlertTriangle, Check, Clock, Pause, X } from "lucide-react"

import type { AgentActionView } from "./agent-control-center"

import { DEFAULT_AGENT_ACTION_SNOOZE_MS } from "@/lib/ai/review-constants"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  actions: AgentActionView[]
  onActionUpdate: (id: string, status: AgentActionView["status"]) => void
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  "create-todo": "Create Todo",
  "update-deal": "Update Deal",
  "move-deal-stage": "Move Deal Stage",
  "create-meeting": "Schedule Meeting",
  "update-meeting": "Update Meeting",
  "create-agent-memory": "Save Agent Memory",
  "mark-todo-done": "Mark Todo Done",
}

const TIER_COLORS: Record<string, string> = {
  auto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  log_only: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approve:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

export function AgentQueue({ actions, onActionUpdate }: Props) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  async function handleAction(
    action: AgentActionView,
    intent: "approve" | "reject" | "snooze"
  ) {
    setLoadingMap((prev) => ({ ...prev, [action.id]: true }))
    try {
      const body =
        intent === "reject"
          ? { feedback: feedbackMap[action.id] ?? "" }
          : intent === "snooze"
            ? {
                snoozedUntil: new Date(
                  Date.now() + DEFAULT_AGENT_ACTION_SNOOZE_MS
                ).toISOString(),
              }
            : {}
      const response = await fetch(
        `/api/agent/actions/${action.id}/${intent}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      const result = (await response.json()) as {
        error?: string
        code?: string
        status?: string
      }
      if (!response.ok) {
        toast.error(result.error ?? "Agent action failed", {
          description: result.code,
        })
        return
      }
      if (result.status === "executed") onActionUpdate(action.id, "executed")
      if (result.status === "snoozed") onActionUpdate(action.id, "snoozed")
      if (
        result.status === "rejected" ||
        result.status === "rejected_duplicate"
      ) {
        onActionUpdate(action.id, "rejected")
      }
    } finally {
      setLoadingMap((prev) => ({ ...prev, [action.id]: false }))
    }
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No pending actions</p>
          <p className="text-sm text-muted-foreground">
            AI suggestions that need approval will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-medium">
          {actions.length} action{actions.length !== 1 ? "s" : ""} awaiting
          approval
        </p>
      </div>

      {actions.map((action) => (
        <Card key={action.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{action.summary}</CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <span>
                    {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                  </span>
                  {action.targetEntity && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{action.targetEntity}</span>
                    </>
                  )}
                  <span className="text-muted-foreground/50">|</span>
                  <span>
                    {formatDistanceToNow(new Date(action.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  className={TIER_COLORS[action.tier] ?? ""}
                  variant="secondary"
                >
                  {action.tier}
                </Badge>
                {action.tier === "auto" && (
                  <Badge
                    className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    variant="secondary"
                    data-testid="high-confidence-badge"
                  >
                    High confidence
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <Separator />
          <CardContent className="pt-3">
            {action.sourceCommunication && (
              <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Evidence: {action.sourceCommunication.subject ?? "Email"} -{" "}
                {new Date(action.sourceCommunication.date).toLocaleString()}
              </p>
            )}
            {action.targetTodo && (
              <div className="mb-3 rounded-md border px-3 py-2 text-xs">
                <p className="font-medium">
                  Target todo: {action.targetTodo.title}
                </p>
                <p className="text-muted-foreground">
                  Status: {action.targetTodo.status}
                  {action.targetTodo.contactId
                    ? ` | Contact: ${action.targetTodo.contactId}`
                    : ""}
                  {action.targetTodo.dealId
                    ? ` | Deal: ${action.targetTodo.dealId}`
                    : ""}
                </p>
              </div>
            )}
            <Textarea
              placeholder="Optional feedback for the agent..."
              className="mb-3 h-16 resize-none text-sm"
              value={feedbackMap[action.id] ?? ""}
              onChange={(e) =>
                setFeedbackMap((prev) => ({
                  ...prev,
                  [action.id]: e.target.value,
                }))
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(action, "approve")}
                disabled={loadingMap[action.id]}
              >
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(action, "snooze")}
                disabled={loadingMap[action.id]}
              >
                <Pause className="mr-1 h-4 w-4" />
                Snooze
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(action, "reject")}
                disabled={loadingMap[action.id]}
              >
                <X className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
