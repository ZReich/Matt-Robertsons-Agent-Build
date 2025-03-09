"use client"

import * as React from "react"

import { KanbanContext } from "../contexts/kanban-context"

export function useKanbanContext() {
  const context = React.useContext(KanbanContext)
  if (context === undefined) {
    throw new Error("useKanbanContext must be used within a KanbanProvider")
  }
  return context
}
