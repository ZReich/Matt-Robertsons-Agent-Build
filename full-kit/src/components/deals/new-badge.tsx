"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

interface CountResponse {
  ok: true
  count: number
}

export function DealsNewBadge() {
  const pathname = usePathname()
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    void (async () => {
      try {
        const response = await fetch("/api/deals/new-count", {
          cache: "no-store",
        })
        if (!response.ok) return
        const body = (await response.json()) as CountResponse
        setCount(body.count)
      } catch {
        setCount(0)
      }
    })()
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    window.addEventListener("deals-changed", refresh)
    return () => window.removeEventListener("deals-changed", refresh)
  }, [refresh])

  if (count === 0) return null

  return (
    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}
