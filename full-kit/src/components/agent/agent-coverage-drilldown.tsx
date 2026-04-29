"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RotateCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type CoverageFilter =
  | "never_queued"
  | "missed_eligible"
  | "suspicious_noise"
  | "orphaned_context"
  | "failed_scrub"
  | "stale_queue"
  | "pending_mark_done"

type CoverageAction =
  | "mark_true_noise"
  | "mark_false_negative"
  | "enqueue_scrub"
  | "requeue_scrub"
  | "snooze"
  | "defer"

export type CoverageFilterMeta = {
  filter: CoverageFilter
  label: string
  description: string
}

type CoverageReviewItem = {
  id: string
  communicationId: string
  type: CoverageFilter
  status: string
  coarseDate: string
  subject: string | null
  senderDomain: string | null
  senderEmail?: string | null
  classification: string
  queueState: {
    id: string | null
    status: string | null
    attempts: number | null
    enqueuedAt: string | null
    lockedUntil: string | null
  }
  scrubState: string
  contactState: {
    contactId: string | null
    linked: boolean
  }
  actionState: {
    agentActionId: string | null
    actionType: string | null
    status: string | null
    targetEntity: string | null
  }
  riskScore: number
  reasonCodes: string[]
  reasonKey: string
  recommendedAction: string
  policyVersion: string
  evidenceSnippets: string[]
  createdAt: string
}

type ReviewItemsResponse = {
  items: CoverageReviewItem[]
  pageInfo: {
    nextCursor: string | null
    limit: number
    sort: "risk_desc"
  }
}

type LoadState =
  | { status: "idle" }
  | { status: "loading"; append: boolean }
  | { status: "loaded" }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string }

type ActionState = {
  key: string
  status: "loading" | "ok" | "error"
  message: string
}

interface Props {
  open: boolean
  filter: CoverageFilterMeta | null
  onOpenChange: (open: boolean) => void
}

export function AgentCoverageDrilldown({ open, filter, onOpenChange }: Props) {
  const [items, setItems] = useState<CoverageReviewItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" })
  const [actionState, setActionState] = useState<ActionState | null>(null)

  const filterName = filter?.label ?? "Coverage drilldown"

  const loadItems = async (append: boolean, cursor: string | null) => {
    if (!filter) return
    setLoadState({ status: "loading", append })
    setActionState(null)
    try {
      const params = new URLSearchParams({
        filter: filter.filter,
        limit: "25",
        sort: "risk_desc",
      })
      if (cursor) params.set("cursor", cursor)
      const response = await fetch(
        `/api/agent/coverage/review-items?${params.toString()}`,
        { credentials: "same-origin" }
      )
      if (response.status === 401 || response.status === 403) {
        const message = await readErrorMessage(response)
        setItems([])
        setNextCursor(null)
        setLoadState({
          status: "unauthorized",
          message:
            message ||
            "Restricted coverage drilldown. Agent reviewer access is required.",
        })
        return
      }
      if (!response.ok) {
        const message = await readErrorMessage(response)
        throw new Error(message || `Coverage API failed: ${response.status}`)
      }
      const data = (await response.json()) as ReviewItemsResponse
      setItems((prev) => (append ? [...prev, ...data.items] : data.items))
      setNextCursor(data.pageInfo.nextCursor)
      setLoadState({ status: "loaded" })
    } catch (error) {
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Coverage drilldown could not be loaded.",
      })
    }
  }

  useEffect(() => {
    if (!open || !filter) return
    setItems([])
    setNextCursor(null)
    void loadItems(false, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filter?.filter])

  const retry = () => {
    void loadItems(false, null)
  }

  const loadMore = () => {
    if (!nextCursor) return
    void loadItems(true, nextCursor)
  }

  const runDryRunAction = async (
    item: CoverageReviewItem,
    action: CoverageAction
  ) => {
    const key = `${item.id}:${action}`
    setActionState({
      key,
      status: "loading",
      message: `Checking ${formatAction(action)} dry run`,
    })
    try {
      const response = await fetch(
        `/api/agent/coverage/review-items/${encodeURIComponent(item.id)}/actions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            dryRun: true,
            reason: `UI dry run for ${filterName}`,
          }),
        }
      )
      if (response.status === 401 || response.status === 403) {
        const message = await readErrorMessage(response)
        setActionState({
          key,
          status: "error",
          message:
            message ||
            "Restricted action check. Agent reviewer access is required.",
        })
        return
      }
      if (!response.ok) {
        const message = await readErrorMessage(response)
        throw new Error(message || `Dry run failed: ${response.status}`)
      }
      const result = (await response.json()) as {
        status?: string
        unsupportedReason?: string
      }
      setActionState({
        key,
        status: result.status === "unsupported" ? "error" : "ok",
        message:
          result.unsupportedReason ??
          `${formatAction(action)} dry run returned ${result.status ?? "ok"}.`,
      })
    } catch (error) {
      setActionState({
        key,
        status: "error",
        message:
          error instanceof Error ? error.message : "Dry run action failed.",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(96vw,1120px)] max-w-none flex-col overflow-hidden p-0 sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>{filterName}</SheetTitle>
              <SheetDescription>
                {filter?.description ??
                  "Coverage review rows use minimized mailbox fields."}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retry}
              disabled={!filter || loadState.status === "loading"}
            >
              <RotateCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 py-4">
          <DrilldownState
            filterName={filterName}
            state={loadState}
            hasRows={items.length > 0}
            onRetry={retry}
          />

          {actionState && (
            <div
              className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              aria-live="polite"
            >
              {actionState.status === "loading" ? (
                <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
              ) : actionState.status === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              )}
              <span>{actionState.message}</span>
            </div>
          )}

          {items.length > 0 && (
            <CoverageItemsTable
              items={items}
              actionState={actionState}
              onDryRunAction={runDryRunAction}
            />
          )}

          {items.length > 0 && (
            <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
              <span>
                Showing {items.length} {items.length === 1 ? "row" : "rows"}.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={!nextCursor || loadState.status === "loading"}
              >
                {loadState.status === "loading" && loadState.append ? (
                  <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrilldownState({
  filterName,
  state,
  hasRows,
  onRetry,
}: {
  filterName: string
  state: LoadState
  hasRows: boolean
  onRetry: () => void
}) {
  if (state.status === "loading" && !state.append && !hasRows) {
    return (
      <div aria-label={`${filterName} loading`} className="grid gap-2">
        <p className="text-sm font-medium">Loading {filterName} rows...</p>
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    )
  }

  if (state.status === "unauthorized") {
    return (
      <StateMessage
        title="Restricted coverage drilldown"
        message={state.message}
        onRetry={onRetry}
      />
    )
  }

  if (state.status === "error") {
    return (
      <StateMessage
        title="Coverage drilldown error"
        message={state.message}
        onRetry={onRetry}
      />
    )
  }

  if (state.status === "loaded" && !hasRows) {
    return (
      <div className="rounded-md border border-dashed px-4 py-6 text-sm">
        <p className="font-medium">No {filterName} rows</p>
        <p className="mt-1 text-muted-foreground">
          This filter returned zero review items.
        </p>
      </div>
    )
  }

  return null
}

function StateMessage({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-md border border-dashed px-4 py-5 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  )
}

function CoverageItemsTable({
  items,
  actionState,
  onDryRunAction,
}: {
  items: CoverageReviewItem[]
  actionState: ActionState | null
  onDryRunAction: (item: CoverageReviewItem, action: CoverageAction) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[92px]">Date</TableHead>
          <TableHead className="min-w-[220px]">Message</TableHead>
          <TableHead>Reasons</TableHead>
          <TableHead>Queue</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Action</TableHead>
          <TableHead className="text-right">Checks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-nowrap align-top">
              <div className="font-medium">{item.coarseDate}</div>
              <div className="text-xs text-muted-foreground">
                Risk {item.riskScore}
              </div>
            </TableCell>
            <TableCell className="max-w-[280px] align-top">
              <div className="truncate font-medium">
                {item.subject || "No subject"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                <span>{item.senderDomain || "unknown sender"}</span>
                <span>·</span>
                <span>{item.classification}</span>
              </div>
            </TableCell>
            <TableCell className="max-w-[260px] align-top">
              <ReasonCodes codes={item.reasonCodes} />
            </TableCell>
            <TableCell className="align-top">
              <StateStack
                primary={item.queueState.status ?? "no queue"}
                secondary={
                  item.queueState.attempts === null
                    ? item.scrubState
                    : `${item.scrubState}; ${item.queueState.attempts} attempts`
                }
              />
            </TableCell>
            <TableCell className="align-top">
              <StateStack
                primary={item.contactState.linked ? "linked" : "orphaned"}
                secondary={item.contactState.contactId ?? "no contact id"}
              />
            </TableCell>
            <TableCell className="align-top">
              <StateStack
                primary={item.actionState.status ?? "no pending action"}
                secondary={
                  item.actionState.actionType ??
                  item.recommendedAction ??
                  "review"
                }
              />
            </TableCell>
            <TableCell className="align-top">
              <DryRunActions
                item={item}
                actionState={actionState}
                onDryRunAction={onDryRunAction}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ReasonCodes({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return <span className="text-sm text-muted-foreground">No reason code</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <Badge key={code} variant="secondary" className="max-w-full truncate">
          {code}
        </Badge>
      ))}
    </div>
  )
}

function StateStack({
  primary,
  secondary,
}: {
  primary: string
  secondary: string
}) {
  return (
    <div className="max-w-[170px]">
      <div className="truncate text-sm font-medium">{primary}</div>
      <div className="truncate text-xs text-muted-foreground">{secondary}</div>
    </div>
  )
}

function DryRunActions({
  item,
  actionState,
  onDryRunAction,
}: {
  item: CoverageReviewItem
  actionState: ActionState | null
  onDryRunAction: (item: CoverageReviewItem, action: CoverageAction) => void
}) {
  const hasReviewRow = item.id !== item.communicationId
  const actions = useMemo(() => actionsForFilter(item.type), [item.type])
  if (!hasReviewRow || actions.length === 0) {
    return (
      <div className="text-right text-xs text-muted-foreground">Read-only</div>
    )
  }
  return (
    <div className="flex justify-end gap-1">
      {actions.map((action) => {
        const key = `${item.id}:${action}`
        const loading =
          actionState?.key === key && actionState.status === "loading"
        return (
          <Button
            key={action}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={loading}
            onClick={() => onDryRunAction(item, action)}
          >
            {loading ? (
              <LoaderCircle className="mr-1.5 h-3 w-3 animate-spin" />
            ) : null}
            {shortAction(action)}
          </Button>
        )
      })}
    </div>
  )
}

function actionsForFilter(filter: CoverageFilter): CoverageAction[] {
  switch (filter) {
    case "never_queued":
    case "missed_eligible":
      return ["enqueue_scrub", "defer"]
    case "failed_scrub":
    case "stale_queue":
      return ["requeue_scrub", "defer"]
    case "suspicious_noise":
      return ["mark_true_noise", "mark_false_negative", "defer"]
    case "orphaned_context":
    case "pending_mark_done":
      return ["defer"]
  }
}

function shortAction(action: CoverageAction): string {
  switch (action) {
    case "mark_true_noise":
      return "True noise"
    case "mark_false_negative":
      return "False neg"
    case "enqueue_scrub":
      return "Enqueue"
    case "requeue_scrub":
      return "Requeue"
    case "snooze":
      return "Snooze"
    case "defer":
      return "Defer"
  }
}

function formatAction(action: CoverageAction): string {
  return shortAction(action).toLowerCase()
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === "string" ? body.error : null
  } catch {
    return null
  }
}
