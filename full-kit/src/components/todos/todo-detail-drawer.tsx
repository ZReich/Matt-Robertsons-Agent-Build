"use client"

import { useState } from "react"
import Link from "next/link"
import { format, isBefore, startOfDay } from "date-fns"
import { toast } from "sonner"
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Smartphone,
  Tag,
  User,
} from "lucide-react"

import type { TodoResolvedContext } from "@/lib/vault/resolve-context"
import type { TodoMeta, VaultNote } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AttachmentSummaryInline } from "@/components/communications/attachment-summary-inline"

type TodoNote = VaultNote<TodoMeta>

interface TodoDetailDrawerProps {
  todo: TodoNote | null
  context: TodoResolvedContext | null
  open: boolean
  onOpenChange: (open: boolean) => void
  lang: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "border-red-400 text-red-600 bg-red-50 dark:bg-red-950/30",
  high: "border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-950/30",
  medium: "border-yellow-400 text-yellow-600",
  low: "text-muted-foreground",
}

const STAGE_COLORS: Record<string, string> = {
  prospecting:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  listing: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  marketing: "bg-indigo-100 text-indigo-700",
  showings: "bg-violet-100 text-violet-700",
  offer: "bg-amber-100 text-amber-700",
  "under-contract": "bg-orange-100 text-orange-700",
  "due-diligence": "bg-yellow-100 text-yellow-700",
  closing: "bg-emerald-100 text-emerald-700",
  closed: "bg-green-100 text-green-700",
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  listing: "Listing",
  marketing: "Marketing",
  showings: "Showings",
  offer: "Offer",
  "under-contract": "Under Contract",
  "due-diligence": "Due Diligence",
  closing: "Closing",
  closed: "Closed",
}

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  text: MessageSquare,
  whatsapp: Smartphone,
  meeting: Calendar,
}

const CHANNEL_LABELS: Record<string, string> = {
  call: "Phone Call",
  email: "Email",
  text: "Text Message",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
}

export function TodoDetailDrawer({
  todo,
  context,
  open,
  onOpenChange,
  lang,
}: TodoDetailDrawerProps) {
  const [toggling, setToggling] = useState(false)

  if (!todo) return null

  const meta = todo.meta
  const today = startOfDay(new Date())
  const isDone = meta.status === "done"
  const isOverdue =
    !isDone && meta.due_date && isBefore(new Date(meta.due_date), today)

  const person = context?.person
  const deal = context?.deal
  const sourceComm = context?.sourceComm

  async function handleToggleStatus() {
    if (toggling || !todo) return
    setToggling(true)
    try {
      const res = await fetch("/api/vault/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: todo.path,
          status: isDone ? "pending" : "done",
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
          error?: string
        } | null
        if (res.status === 404 && body?.code === "todo_missing") {
          toast.error("This todo no longer exists. Closing.")
          onOpenChange(false)
          return
        }
        toast.error(body?.error ?? "Couldn't update this todo. Try again.")
        return
      }
      onOpenChange(false)
    } catch {
      toast.error("Couldn't update this todo. Try again.")
    } finally {
      setToggling(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] overflow-y-auto"
      >
        <SheetHeader className="text-left pb-1">
          <div className="flex items-start gap-3">
            <button
              onClick={handleToggleStatus}
              disabled={toggling}
              className="mt-1 shrink-0 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
              aria-label={isDone ? "Mark as pending" : "Mark as done"}
            >
              {isDone ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <Circle className="size-5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <SheetTitle
                className={`text-base leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}
              >
                {meta.title}
              </SheetTitle>
              <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-2">
                {meta.priority && (
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${PRIORITY_COLORS[meta.priority] ?? ""}`}
                  >
                    {meta.priority}
                  </Badge>
                )}
                {meta.category && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {meta.category}
                  </Badge>
                )}
                {isDone && (
                  <Badge className="text-xs bg-green-100 text-green-700 border-0">
                    Completed
                  </Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Due Date */}
        {meta.due_date && (
          <div className="px-6 pb-2">
            <div
              className={`flex items-center gap-2 text-sm ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}
            >
              {isOverdue ? (
                <AlertTriangle className="size-4 text-red-500" />
              ) : (
                <Clock className="size-4" />
              )}
              <span>
                {isOverdue ? "Overdue — " : "Due "}
                {format(new Date(meta.due_date), "MMMM d, yyyy")}
              </span>
            </div>
          </div>
        )}

        <Separator className="my-3" />

        <div className="px-6 space-y-4 pb-6">
          {/* Contact / Client Card */}
          {person && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {person.entityType === "clients" ? "Client" : "Contact"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                <Link
                  href={`/${lang}/pages/${person.entityType}/${person.slug}`}
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  {person.name}
                  <ExternalLink className="size-3" />
                </Link>
                {person.company && (
                  <p className="text-xs text-muted-foreground">
                    {person.company}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {person.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {person.phone}
                    </span>
                  )}
                  {person.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {person.email}
                    </span>
                  )}
                </div>
                {person.role && (
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {person.role}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deal Card */}
          {deal && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  Deal
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">{deal.noteTitle}</p>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {deal.propertyAddress}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={`text-xs border-0 ${STAGE_COLORS[deal.stage] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {STAGE_LABELS[deal.stage] ?? deal.stage}
                  </Badge>
                  {deal.propertyType && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {deal.propertyType.replace(/-/g, " ")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {deal.value != null && deal.value > 0 && (
                    <span>${(deal.value / 1_000_000).toFixed(1)}M</span>
                  )}
                  {deal.squareFeet != null && deal.squareFeet > 0 && (
                    <span>{deal.squareFeet.toLocaleString()} sq ft</span>
                  )}
                  {deal.closingDate && (
                    <span>
                      Closing{" "}
                      {format(new Date(deal.closingDate), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                {deal.clientName && (
                  <p className="text-xs text-muted-foreground">
                    Client: {deal.clientName}
                  </p>
                )}
                {deal.keyContacts &&
                  Object.keys(deal.keyContacts).length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                      {Object.entries(deal.keyContacts).map(([role, name]) => (
                        <p key={role}>
                          <span className="capitalize font-medium">
                            {role}:
                          </span>{" "}
                          {name}
                        </p>
                      ))}
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Source Communication Card */}
          {sourceComm && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Created From
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {(() => {
                  const ChannelIcon =
                    CHANNEL_ICONS[sourceComm.channel] ?? MessageSquare
                  return (
                    <div className="flex items-start gap-2">
                      <ChannelIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {CHANNEL_LABELS[sourceComm.channel] ??
                            sourceComm.channel}
                        </p>
                        {sourceComm.subject && (
                          <p className="text-xs text-muted-foreground">
                            {sourceComm.subject}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sourceComm.date), "MMM d, yyyy")}
                          {sourceComm.contact && ` · ${sourceComm.contact}`}
                        </p>
                        <AttachmentSummaryInline
                          summary={sourceComm.attachments}
                        />
                        {sourceComm.outlookUrl && (
                          <div className="mt-2 border-t pt-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Source
                            </p>
                            <a
                              href={sourceComm.outlookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Open in Outlook
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* No context available */}
          {!person && !deal && !sourceComm && !todo.content?.trim() && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No additional context for this todo.
            </p>
          )}

          {/* Notes / Body Content */}
          {todo.content?.trim() && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Notes
                </h4>
                <MarkdownRenderer content={todo.content} size="compact" />
              </div>
            </>
          )}

          {/* Tags */}
          {meta.tags && meta.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <Tag className="size-3 text-muted-foreground" />
              {meta.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Created date */}
          {meta.created && (
            <p className="text-[11px] text-muted-foreground pt-2">
              Created {format(new Date(meta.created), "MMMM d, yyyy")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
