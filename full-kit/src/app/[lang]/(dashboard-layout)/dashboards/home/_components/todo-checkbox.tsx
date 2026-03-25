"use client"

import { useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"

interface TodoCheckboxProps {
  path: string
  done: boolean
}

export function TodoCheckbox({ path, done: initialDone }: TodoCheckboxProps) {
  const [done, setDone] = useState(initialDone)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (done || loading) return
    setLoading(true)
    setDone(true) // optimistic update
    try {
      await fetch("/api/vault/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, status: "done" }),
      })
    } catch {
      setDone(false) // revert on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="shrink-0 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
      aria-label={done ? "Done" : "Mark as done"}
    >
      {done ? (
        <CheckCircle2 className="size-4 text-green-600" />
      ) : (
        <Circle className="size-4" />
      )}
    </button>
  )
}
