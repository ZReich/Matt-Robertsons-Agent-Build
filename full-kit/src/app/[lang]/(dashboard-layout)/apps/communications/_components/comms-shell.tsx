"use client"

import { useState } from "react"

import type { CommunicationMeta, TodoMeta, VaultNote } from "@/lib/vault"

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

import { CommsList } from "./comms-list"
import { CommsDetail, CommsDetailEmpty } from "./comms-detail"

type CommNote = VaultNote<CommunicationMeta>
type TodoNote = VaultNote<TodoMeta>

interface CommsShellProps {
  notes: CommNote[]
  todos: TodoNote[]
}

export function CommsShell({ notes, todos }: CommsShellProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState("all")
  const [category, setCategory] = useState("all")

  // Mobile: toggle between list and detail view
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  const handleSelect = (path: string) => {
    setSelectedPath(path)
    setMobileView("detail")
  }

  const handleBack = () => {
    setMobileView("list")
  }

  // Detect mobile vs desktop to avoid mounting both trees
  // (dual mount causes duplicate fetches in CommsDetail)
  const [isMobile, setIsMobile] = useState(false)

  // Sync with CSS breakpoint on mount + resize
  if (typeof window !== "undefined") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(() => {
      const mq = window.matchMedia("(max-width: 767px)")
      setIsMobile(mq.matches)
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    })
  }

  if (isMobile) {
    // Mobile: stacked views — only one tree mounted at a time
    return (
      <div className="h-[calc(100vh-8rem)]">
        {mobileView === "list" ? (
          <div className="h-full border rounded-lg">
            <CommsList
              notes={notes}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              search={search}
              onSearchChange={setSearch}
              channel={channel}
              onChannelChange={setChannel}
              category={category}
              onCategoryChange={setCategory}
            />
          </div>
        ) : selectedPath ? (
          <div className="h-full border rounded-lg">
            <CommsDetail
              selectedPath={selectedPath}
              allTodos={todos}
              onBack={handleBack}
            />
          </div>
        ) : null}
      </div>
    )
  }

  // Desktop: split pane — single mount
  return (
    <div className="h-[calc(100vh-8rem)]">
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <CommsList
            notes={notes}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            channel={channel}
            onChannelChange={setChannel}
            category={category}
            onCategoryChange={setCategory}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={65} minSize={40}>
          {selectedPath ? (
            <CommsDetail
              selectedPath={selectedPath}
              allTodos={todos}
            />
          ) : (
            <CommsDetailEmpty />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
