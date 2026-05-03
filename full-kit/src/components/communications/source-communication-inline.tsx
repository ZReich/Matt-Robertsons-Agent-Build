"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"

interface SourceComm {
  id: string
  channel: string
  subject: string | null
  body: string | null
  date: string
  direction: string | null
  externalMessageId: string | null
  from: { name: string | null; address: string | null } | null
  contact: {
    id: string
    name: string
    email: string | null
    company: string | null
  } | null
}

/**
 * Click-to-expand inline view of a source Communication. Used inside any
 * drilldown drawer so the user can read the original email/text/transcript
 * that triggered an AI todo / draft / suggestion without navigating away.
 *
 * Lazy-fetches: nothing happens until the user clicks "Read source email".
 * Body is fetched once and cached in component state.
 */
export function SourceCommunicationInline({
  communicationId,
  defaultExpanded = false,
}: {
  communicationId: string
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [loading, setLoading] = useState(false)
  const [comm, setComm] = useState<SourceComm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  async function ensureLoaded() {
    if (comm || loading) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/communications/${communicationId}`, {
        signal: controller.signal,
      })
      const json = (await res.json()) as
        | { communication: SourceComm }
        | { error: string }
      if (!mountedRef.current) return
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : "Could not load source")
        return
      }
      setComm(json.communication)
    } catch (e) {
      if (controller.signal.aborted) return
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : "Network error")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  async function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next) await ensureLoaded()
  }

  return (
    <div className="rounded-md border bg-muted/20">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/40"
      >
        <span className="flex items-center gap-1.5">
          {comm?.direction === "outbound" ? (
            <ArrowUpRight className="size-3.5 text-blue-600" />
          ) : (
            <ArrowDownLeft className="size-3.5 text-emerald-600" />
          )}
          {expanded ? "Hide source" : "Read source email"}
        </span>
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {expanded ? (
        <div className="border-t px-3 py-3 text-xs">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : comm ? (
            <div className="grid gap-2">
              <div className="grid gap-0.5 text-[11px] text-muted-foreground">
                {comm.from?.name || comm.from?.address ? (
                  <div>
                    <span className="font-medium">From:</span>{" "}
                    {comm.from.name ? `${comm.from.name} ` : ""}
                    {comm.from.address ? `<${comm.from.address}>` : ""}
                  </div>
                ) : null}
                {comm.contact ? (
                  <div>
                    <span className="font-medium">Contact:</span>{" "}
                    {comm.contact.name}
                    {comm.contact.company ? ` · ${comm.contact.company}` : ""}
                  </div>
                ) : null}
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {format(new Date(comm.date), "MMM d, yyyy h:mm a")}
                </div>
                {comm.subject ? (
                  <div>
                    <span className="font-medium">Subject:</span> {comm.subject}
                  </div>
                ) : null}
              </div>
              <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded bg-background p-3 font-sans text-xs leading-relaxed">
                {comm.body ?? "(no body captured)"}
              </pre>
              {comm.externalMessageId ? (
                <div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                  >
                    <a
                      href={`https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(comm.externalMessageId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Outlook
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
