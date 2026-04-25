"use client"

import { createContext, useContext } from "react"

export const KanbanContext = createContext<{ disabled?: boolean }>({})

export function useKanbanContext() {
  return useContext(KanbanContext)
}
