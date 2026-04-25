"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

let dashboardMutationCount = 0

export function isDashboardMutationInFlight() {
  return dashboardMutationCount > 0
}

export async function runDashboardMutation<T>(mutation: () => Promise<T>) {
  dashboardMutationCount += 1
  try {
    return await mutation()
  } finally {
    dashboardMutationCount = Math.max(0, dashboardMutationCount - 1)
  }
}

export function RevalidateOnFocus() {
  const router = useRouter()
  const lastRefreshAt = useRef(Date.now())

  useEffect(() => {
    function onFocus() {
      const now = Date.now()
      if (now - lastRefreshAt.current < 30_000) return
      if (isDashboardMutationInFlight()) return

      lastRefreshAt.current = now
      router.refresh()
    }

    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router])

  return null
}
