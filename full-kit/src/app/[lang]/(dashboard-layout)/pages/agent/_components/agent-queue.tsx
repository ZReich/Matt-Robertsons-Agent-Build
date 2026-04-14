"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Check, Clock, X } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  actions: VaultNote<AgentActionMeta>[]
  onActionUpdate: (path: string, status: AgentActionMeta["status"]) => void
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  "create-todo": "Create Todo",
  "update-todo": "Update Todo",
  "create-deal": "Create Deal",
  "update-deal": "Update Deal",
  "move-deal-stage": "Move Deal Stage",
  "create-communication": "Log Communication",
  "create-meeting": "Schedule Meeting",
  "update-meeting": "Update Meeting",
  "send-email": "Send Email",
  "send-text": "Send Text",
  "create-client": "Create Client",
  "update-client": "Update Client",
  "create-contact": "Create Contact",
  "update-contact": "Update Contact",
  "archive-deal": "Archive Deal",
  general: "General Action",
}

const TIER_COLORS: Record<string, string> = {
  auto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "log-only": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approve:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

export function AgentQueue({ actions, onActionUpdate }: Props) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  async function handleAction(path: string, status: "approved" | "rejected") {
    setLoadingMap((prev) => ({ ...prev, [path]: true }))

    try {
      await fetch("/api/vault/agent-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          status,
          ...(feedbackMap[path] && { feedback: feedbackMap[path] }),
        }),
      })

      onActionUpdate(path, status)
    } catch (err) {
      console.error("Failed to update action:", err)
    } finally {
      setLoadingMap((prev) => ({ ...prev, [path]: false }))
    }
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No pending actions</p>
          <p className="text-sm text-muted-foreground">
            The agent will submit actions here for your approval.
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
        <Card key={action.path}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  {action.meta.summary}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <span>
                    {ACTION_TYPE_LABELS[action.meta.action_type] ??
                      action.meta.action_type}
                  </span>
                  {action.meta.target_entity && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{action.meta.target_entity}</span>
                    </>
                  )}
                  <span className="text-muted-foreground/50">|</span>
                  <span>
                    {formatDistanceToNow(new Date(action.meta.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </CardDescription>
              </div>
              <Badge
                className={TIER_COLORS[action.meta.tier] ?? ""}
                variant="secondary"
              >
                {action.meta.tier}
              </Badge>
            </div>
          </CardHeader>

          {action.content && (
            <>
              <Separator />
              <CardContent className="pt-3">
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {action.content}
                </pre>
              </CardContent>
            </>
          )}

          <Separator />
          <CardContent className="pt-3">
            <Textarea
              placeholder="Optional feedback for the agent..."
              className="mb-3 h-16 resize-none text-sm"
              value={feedbackMap[action.path] ?? ""}
              onChange={(e) =>
                setFeedbackMap((prev) => ({
                  ...prev,
                  [action.path]: e.target.value,
                }))
              }
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(action.path, "approved")}
                disabled={loadingMap[action.path]}
              >
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(action.path, "rejected")}
                disabled={loadingMap[action.path]}
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
