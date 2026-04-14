"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { VaultNote, AgentActionMeta, AgentMemoryMeta } from "@/lib/vault/shared"

import { AgentQueue } from "./agent-queue"
import { AgentActivityLog } from "./agent-activity-log"
import { AgentMemoryPanel } from "./agent-memory-panel"
import { AgentConfig } from "./agent-config"

interface Props {
  initialActions: VaultNote<AgentActionMeta>[]
  initialMemory: VaultNote<AgentMemoryMeta>[]
}

export function AgentControlCenter({ initialActions, initialMemory }: Props) {
  const [actions, setActions] = useState(initialActions)
  const [memory] = useState(initialMemory)

  const pendingActions = actions.filter((a) => a.meta.status === "pending")
  const completedActions = actions.filter((a) => a.meta.status !== "pending")

  const handleActionUpdate = (
    path: string,
    newStatus: AgentActionMeta["status"]
  ) => {
    setActions((prev) =>
      prev.map((a) =>
        a.path === path ? { ...a, meta: { ...a.meta, status: newStatus } } : a
      )
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

      <TabsContent value="memory" className="mt-4">
        <AgentMemoryPanel memory={memory} />
      </TabsContent>

      <TabsContent value="config" className="mt-4">
        <AgentConfig />
      </TabsContent>
    </Tabs>
  )
}
