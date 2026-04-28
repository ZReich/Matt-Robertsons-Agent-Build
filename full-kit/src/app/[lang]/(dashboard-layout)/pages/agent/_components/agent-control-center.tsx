"use client"

import { useState } from "react"

import type { ScrubCoverageStats } from "@/lib/ai/scrub-queue"
import type { AgentMemoryView } from "./agent-memory-panel"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgentCoveragePanel } from "@/components/agent/agent-coverage-panel"
import { AgentActivityLog } from "./agent-activity-log"
import { AgentConfig } from "./agent-config"
import { AgentMemoryPanel } from "./agent-memory-panel"
import { AgentQueue } from "./agent-queue"

export interface AgentActionView {
  id: string
  actionType: string
  tier: string
  status: "pending" | "approved" | "rejected" | "executed" | "snoozed"
  summary: string
  targetEntity: string | null
  feedback: string | null
  sourceCommunicationId: string | null
  promptVersion: string
  duplicateOfActionId: string | null
  dedupedToTodoId: string | null
  createdAt: string
  executedAt: string | null
  sourceCommunication?: {
    id: string
    subject: string | null
    date: string
    archivedAt: string | null
  } | null
  todo?: { id: string; title: string; status: string } | null
  targetTodo?: {
    id: string
    title: string
    status: string
    contactId: string | null
    dealId: string | null
  } | null
  dedupedToTodo?: { id: string; title: string; status: string } | null
}

interface Props {
  initialActions: AgentActionView[]
  initialMemory: AgentMemoryView[]
  coverage: ScrubCoverageStats
}

export function AgentControlCenter({
  initialActions,
  initialMemory,
  coverage,
}: Props) {
  const [actions, setActions] = useState(initialActions)
  const [memory] = useState(initialMemory)

  const pendingActions = actions.filter(
    (a) => a.status === "pending" && a.tier === "approve"
  )
  const completedActions = actions.filter((a) => a.status !== "pending")

  const handleActionUpdate = (
    id: string,
    newStatus: AgentActionView["status"]
  ) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }

  return (
    <Tabs defaultValue="queue">
      <TabsList>
        <TabsTrigger value="queue">
          Queue
          {pendingActions.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">
              {pendingActions.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="activity">Activity Log</TabsTrigger>
        <TabsTrigger value="coverage">Coverage</TabsTrigger>
        <TabsTrigger value="memory">Memory & Rules</TabsTrigger>
        <TabsTrigger value="config">Configuration</TabsTrigger>
      </TabsList>

      <TabsContent value="queue" className="mt-4">
        <AgentQueue
          actions={pendingActions}
          onActionUpdate={handleActionUpdate}
        />
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <AgentActivityLog actions={completedActions} />
      </TabsContent>

      <TabsContent value="coverage" className="mt-4">
        <AgentCoveragePanel coverage={coverage} />
      </TabsContent>

      <TabsContent value="memory" className="mt-4">
        <AgentMemoryPanel memory={memory} />
      </TabsContent>

      <TabsContent value="config" className="mt-4">
        <AgentConfig />
      </TabsContent>
    </Tabs>
  )
}
