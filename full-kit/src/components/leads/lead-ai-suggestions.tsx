"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Paperclip,
  Search,
  Sparkles,
} from "lucide-react"

import type { AiSuggestionState } from "@/lib/ai/suggestions"
import type { BackfillResult } from "@/lib/contacts/mailbox-backfill"

import { DEFAULT_AGENT_ACTION_SNOOZE_MS } from "@/lib/ai/review-constants"

import { Button } from "@/components/ui/button"
import { SourceCommunicationInline } from "@/components/communications/source-communication-inline"

export interface LeadAISuggestionsProps {
  state: AiSuggestionState
  lang?: string
}

function formatActionType(actionType: string) {
  return actionType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatProcessedCopy(state: AiSuggestionState) {
  if (state.queue.inFlight > 0 || state.queue.pending > 0) {
    return "Processing"
  }

  if (state.queue.failed > 0) {
    return "Needs retry"
  }

  if (state.scrubbedCommunications.length > 0) {
    return "Processed"
  }

  return "Not processed"
}

export function LeadAISuggestions({ state }: LeadAISuggestionsProps) {
  const router = useRouter()
  const [actions, setActions] = useState(state.actions)
  const [isProcessing, setIsProcessing] = useState(false)
  const [scanState, setScanState] = useState<
    | { kind: "idle" }
    | { kind: "scanning" }
    | { kind: "success"; result: BackfillResult }
    | { kind: "rate_limited"; retryAfter: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" })
  const autoTriggeredRef = useRef(false)
  const reviewableActions = useMemo(
    () => actions.filter((action) => !action.isSnoozed && !action.isStale),
    [actions]
  )
  // Include tier="auto" rows: Phase D writes high-confidence buyer-rep
  // proposals with tier="auto" / status="pending" — still gated on approval,
  // but flagged with a "High confidence" pill so Matt can spot them.
  const visibleActions = reviewableActions.filter(
    (action) =>
      action.status === "pending" &&
      (action.tier === "approve" || action.tier === "auto")
  )
  const scrubbedCount = state.scrubbedCommunications.length
  const totalCommunications =
    state.queue.notQueued +
    state.queue.pending +
    state.queue.inFlight +
    state.queue.done +
    state.queue.failed
  const snoozedCount = actions.filter((action) => action.isSnoozed).length
  const staleCount = actions.filter((action) => action.isStale).length
  // Show "Process now" whenever there's anything to scrub for this entity —
  // either communications that haven't been queued yet, OR communications
  // that are queued/in-flight (the endpoint will skip-the-line process them).
  // Previously gated on `notQueued > 0` only, which hid the button as soon
  // as the global queue had absorbed the entity's comms.
  const canProcess =
    (state.entityType === "contact" || state.entityType === "deal") &&
    (state.queue.notQueued > 0 ||
      state.queue.pending > 0 ||
      state.queue.inFlight > 0 ||
      state.queue.failed > 0)

  async function processSuggestions(options: { silent?: boolean } = {}) {
    const { silent = false } = options
    setIsProcessing(true)
    try {
      // First attempt: do not auto-confirm reprocess. If the server says
      // some comms have stale scrub output and need reprocess confirmation,
      // we accept on the user's behalf — they explicitly clicked the
      // button, which IS the confirmation — and retry once.
      let result = await callProcess(false)
      if (result.code === "reprocess_requires_confirmation") {
        result = await callProcess(true)
      }
      if (!result.ok) {
        if (!silent) {
          toast.error(result.error ?? "AI processing failed", {
            description: result.code,
          })
        }
        return
      }
      const enqueued = result.enqueued ?? 0
      const succeeded = result.succeeded ?? 0
      const noun = state.entityType === "deal" ? "deal" : "contact"
      if (!silent) {
        if (enqueued === 0) {
          toast.success("Already up to date", {
            description: `No new emails to process for this ${noun}.`,
          })
        } else {
          toast.success("AI processing started", {
            description: `${enqueued} email${enqueued === 1 ? "" : "s"} queued · ${succeeded} processed so far`,
          })
        }
      }
      router.refresh()
    } catch (err) {
      if (!silent) {
        toast.error("AI processing failed", {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleScanMailbox() {
    if (state.entityType !== "contact") return
    setScanState({ kind: "scanning" })
    try {
      const res = await fetch(
        `/api/contacts/${state.entityId}/email-backfill`,
        { method: "POST" }
      )
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          retryAfter?: number
        }
        setScanState({
          kind: "rate_limited",
          retryAfter: body.retryAfter ?? 0,
        })
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setScanState({
          kind: "error",
          message: body.error ?? `HTTP ${res.status}`,
        })
        return
      }
      const result = (await res.json()) as BackfillResult
      setScanState({ kind: "success", result })
      router.refresh()
    } catch (err) {
      setScanState({
        kind: "error",
        message: err instanceof Error ? err.message : "unknown_error",
      })
    }
  }

  // Auto-run on first mount when there are unprocessed comms for this entity.
  // Guarded by:
  //   • canProcess  — server has marked this lead/contact as eligible
  //   • notQueued > 0 — there's actually new work to do (don't re-fire on
  //     pages that just have stale results sitting around)
  //   • autoTriggeredRef — fires at most once per page load to avoid loops
  // Side effect: a quiet toast-free pass that lets the suggestion list
  // populate itself the moment the user opens a lead, instead of forcing
  // them to find and click the "Process with AI" button.
  useEffect(() => {
    if (autoTriggeredRef.current) return
    if (!canProcess) return
    if (state.queue.notQueued <= 0) return
    autoTriggeredRef.current = true
    void processSuggestions({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function callProcess(confirmReprocess: boolean) {
    const response = await fetch("/api/ai-suggestions/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: state.entityType,
        entityId: state.entityId,
        confirmReprocess,
      }),
    })
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
      code?: string
      enqueued?: number
      succeeded?: number
    }
    return { ok: response.ok, ...body }
  }

  async function handleAction(
    actionId: string,
    intent: "approve" | "reject" | "snooze"
  ) {
    const body =
      intent === "snooze"
        ? {
            snoozedUntil: new Date(
              Date.now() + DEFAULT_AGENT_ACTION_SNOOZE_MS
            ).toISOString(),
          }
        : intent === "reject"
          ? { feedback: "rejected from suggestion panel" }
          : {}
    const response = await fetch(`/api/agent/actions/${actionId}/${intent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = (await response.json()) as {
      error?: string
      code?: string
      status?: string
    }
    if (!response.ok) {
      toast.error(result.error ?? "Suggestion review failed", {
        description: result.code,
      })
      return
    }
    setActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? {
              ...action,
              status:
                result.status === "executed"
                  ? "executed"
                  : result.status === "snoozed"
                    ? action.status
                    : "rejected",
              isSnoozed: result.status === "snoozed" ? true : action.isSnoozed,
            }
          : action
      )
    )
    toast.success("Suggestion updated")
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-amber-500">
            <Sparkles className="size-3.5" />
            AI Suggestions
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalCommunications} related email
            {totalCommunications === 1 ? "" : "s"} checked
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium">
          {formatProcessedCopy(state)}
        </span>
      </div>
      {canProcess ? (
        <Button
          className="mb-3 w-full"
          size="sm"
          type="button"
          onClick={() => processSuggestions()}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Process with AI"}
        </Button>
      ) : null}

      {state.entityType === "contact" ? (
        <div className="mb-3">
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            type="button"
            onClick={handleScanMailbox}
            disabled={scanState.kind === "scanning"}
          >
            {scanState.kind === "scanning" ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" />
                Scanning mailbox…
              </>
            ) : (
              <>
                <Search className="mr-1 size-3.5" />
                Scan mailbox
              </>
            )}
          </Button>
          {scanState.kind === "success" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Found {scanState.result.messagesDiscovered} message
              {scanState.result.messagesDiscovered === 1 ? "" : "s"} —{" "}
              {scanState.result.ingested} imported,{" "}
              {scanState.result.deduped} already on file,{" "}
              {scanState.result.scrubQueued} queued for AI scrub
              {scanState.result.staleRescrubsEnqueued > 0
                ? `. Re-extracting facts from ${scanState.result.staleRescrubsEnqueued} older message${scanState.result.staleRescrubsEnqueued === 1 ? "" : "s"}.`
                : null}
            </p>
          ) : null}
          {scanState.kind === "rate_limited" ? (
            <p className="mt-2 text-xs text-amber-600">
              Recently scanned — retry in{" "}
              {Math.max(1, Math.ceil(scanState.retryAfter / 60))} min
            </p>
          ) : null}
          {scanState.kind === "error" ? (
            <p className="mt-2 text-xs text-red-600">
              Error: {scanState.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {visibleActions.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {scrubbedCount > 0 ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <Clock className="size-4 text-muted-foreground" />
            )}
            {scrubbedCount > 0
              ? "No actions need review"
              : "No suggestions yet"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {scrubbedCount > 0
              ? `${scrubbedCount} email${scrubbedCount === 1 ? "" : "s"} processed — nothing here is waiting on you. New suggestions show up here as they're generated.`
              : canProcess
                ? "Click Process with AI above to scan recent communications and surface action proposals here."
                : "AI suggestions for this contact will appear here once relevant communications are processed."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleActions.slice(0, 3).map((action) => {
            // Narrow "High confidence" pill the same way agent-queue does
            // (B5): Phase D writes tier="auto" only for create-deal LOI
            // proposals. Other future producers of tier="auto" must NOT
            // inherit the pill silently.
            const payload = (action.payload ?? {}) as { signalType?: string }
            const showHighConfidencePill =
              action.tier === "auto" &&
              action.actionType === "create-deal" &&
              payload.signalType === "loi"
            return (
            <div
              key={action.id}
              className="rounded-md border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{action.summary}</div>
                  <div className="mt-1 text-[11px] uppercase text-muted-foreground">
                    {formatActionType(action.actionType)}
                  </div>
                </div>
                {showHighConfidencePill ? (
                  <span
                    className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    data-testid="high-confidence-pill"
                  >
                    High confidence
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">
                    Review
                  </span>
                )}
              </div>
              {action.evidence?.summary ? (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {action.evidence.summary}
                </p>
              ) : null}
              {action.evidence?.attachments?.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Paperclip className="size-3" />
                  {action.evidence.attachments.map((attachment, index) => (
                    <span
                      key={`${action.id}-attachment-${index}`}
                      className="rounded-full border px-2 py-0.5"
                      title={attachment.contentType}
                    >
                      {attachment.name}
                    </span>
                  ))}
                  {action.evidence.attachmentsRemaining ? (
                    <span className="rounded-full border px-2 py-0.5">
                      +{action.evidence.attachmentsRemaining} more
                    </span>
                  ) : null}
                </div>
              ) : null}
              {action.sourceCommunicationId ? (
                <div className="mt-3">
                  <SourceCommunicationInline
                    communicationId={action.sourceCommunicationId}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {action.evidence?.outlookUrl ? (
                  <a
                    href={action.evidence.outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Outlook
                  </a>
                ) : null}
              </div>
              {[
                ...action.linkedContactCandidates,
                ...action.linkedDealCandidates,
              ].length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    ...action.linkedContactCandidates,
                    ...action.linkedDealCandidates,
                  ].map((candidate) => (
                    <span
                      key={`${action.id}-${candidate.kind}-${candidate.id}`}
                      className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {candidate.label} {Math.round(candidate.confidence * 100)}
                      %
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => handleAction(action.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => handleAction(action.id, "snooze")}
                >
                  Snooze
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => handleAction(action.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {snoozedCount > 0 || staleCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {snoozedCount > 0 ? <span>{snoozedCount} snoozed</span> : null}
          {staleCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <AlertTriangle className="size-3" />
              {staleCount} stale
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
