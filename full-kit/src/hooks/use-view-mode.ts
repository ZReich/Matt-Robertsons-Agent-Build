"use client"

import { useContext } from "react"

import { ViewContext } from "@/contexts/view-context"
import type { ViewMode } from "@/contexts/view-context"
import type { VaultCategory } from "@/lib/vault/types"

export function useViewMode() {
  const context = useContext(ViewContext)

  if (!context) {
    throw new Error("useViewMode must be used within a ViewProvider")
  }

  return context
}

/**
 * Returns true if the given category should be visible
 * based on the current view mode.
 */
export function matchesViewMode(
  category: VaultCategory,
  viewMode: ViewMode
): boolean {
  if (viewMode === "everything") return true
  return category === viewMode
}
