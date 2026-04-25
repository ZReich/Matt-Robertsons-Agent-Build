"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface MarkViewedOnMountProps {
  leadId: string
}

export function MarkViewedOnMount({ leadId }: MarkViewedOnMountProps): null {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(`/api/vault/leads/${leadId}/view`, {
          method: "POST",
        })
        if (!cancelled && response.ok) {
          window.dispatchEvent(new Event("leads-unread-changed"))
          router.refresh()
        }
      } catch {
        // Best-effort reconciliation only.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [leadId, router])

  return null
}
