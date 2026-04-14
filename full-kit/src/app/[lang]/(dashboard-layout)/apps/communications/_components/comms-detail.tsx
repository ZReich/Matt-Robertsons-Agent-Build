"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Lightbulb,
  ListTodo,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  Smartphone,
} from "lucide-react"
import Link from "next/link"

import { useParams } from "next/navigation"

import type { CommunicationMeta, TodoMeta, VaultNote } from "@/lib/vault"
import { normalizeEntityRef, toSlug } from "@/lib/vault"
import { parseSections } from "@/lib/parse-sections"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type CommNote = VaultNote<CommunicationMeta>
type TodoNote = VaultNote<TodoMeta>

interface CommsDetailProps {
  /** The vault path of the selected communication */
  selectedPath: string
  /** All todos (for matching linked todos) */
  allTodos: TodoNote[]
  /** Callback when user wants to go back (mobile) */
  onBack?: () => void
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  call: <Phone className="size-4" />,
  email: <Mail className="size-4" />,
  text: <MessageSquare className="size-4" />,
  whatsapp: <Smartphone className="size-4" />,
  meeting: <Calendar className="size-4" />,
}

const CHANNEL_LABELS: Record<string, string> = {
  call: "Phone Call",
  email: "Email",
  text: "Text Message",
  whatsapp: "WhatsApp",
  meeting: "Meeting Notes",
}

export function CommsDetail({
  selectedPath,
  allTodos,
  onBack,
}: CommsDetailProps) {
  const params = useParams<{ lang: string }>()
  const lang = params?.lang ?? "en"

  const [note, setNote] = useState<CommNote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch full note content on demand (lazy loading)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/vault/communications?path=${encodeURIComponent(selectedPath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load communication")
        return res.json()
      })
      .then((data: CommNote) => {
        if (!cancelled) {
          setNote(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedPath])

  const handleCopy = useCallback(async () => {
    if (!note?.content) return
    await navigator.clipboard.writeText(note.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [note?.content])

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            &larr; Back to list
          </Button>
        )}
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            &larr; Back to list
          </Button>
        )}
        <p className="text-sm text-destructive">
          {error ?? "Communication not found"}
        </p>
      </div>
    )
  }

  const contactName = normalizeEntityRef(note.meta.contact)
  const contactSlug = toSlug(contactName)
  const dealName = note.meta.deal
    ? normalizeEntityRef(note.meta.deal)
    : null
  const isInbound = note.meta.direction !== "outbound"
  const parsed = parseSections(note.content)

  // Find linked todos:
  // 1. Primary: explicit link via source_communication
  const explicitlyLinked = allTodos.filter(
    (t) => t.meta.source_communication === note.path
  )
  // 2. Fallback: matching contact + deal — BUT only if no explicit links exist
  //    This prevents misattribution when explicit links are in use.
  const linkedTodos =
    explicitlyLinked.length > 0
      ? explicitlyLinked
      : allTodos.filter((t) => {
          const todoContact = t.meta.contact
            ? normalizeEntityRef(t.meta.contact)
            : null
          const todoDeal = t.meta.deal
            ? normalizeEntityRef(t.meta.deal)
            : null
          return (
            todoContact === contactName &&
            dealName !== null &&
            todoDeal === dealName
          )
        })

  const completedTodos = linkedTodos.filter((t) => t.meta.status === "done")

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-5">
        {/* Mobile back button */}
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
            &larr; Back to list
          </Button>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                {CHANNEL_ICONS[note.meta.channel] ?? (
                  <MessageSquare className="size-4" />
                )}
              </div>
              <div>
                {note.meta.subject ? (
                  <h2 className="text-lg font-semibold leading-tight">
                    {note.meta.subject}
                  </h2>
                ) : (
                  <h2 className="text-lg font-semibold leading-tight text-muted-foreground">
                    {CHANNEL_LABELS[note.meta.channel] ?? note.meta.channel}
                  </h2>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CHANNEL_LABELS[note.meta.channel] ?? note.meta.channel}
                  {note.meta.direction && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      {isInbound ? (
                        <ArrowDownLeft className="size-3 text-green-600" />
                      ) : (
                        <ArrowUpRight className="size-3 text-blue-600" />
                      )}
                      {isInbound ? "Received" : "Sent"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link
                href={`/${lang}/pages/${note.meta.category === "personal" ? "contacts" : "clients"}/${contactSlug}`}
                className="hover:underline"
              >
                <Badge variant="secondary" className="font-normal cursor-pointer">
                  {contactName}
                  <ExternalLink className="size-3 ml-1" />
                </Badge>
              </Link>
              {dealName && (
                <Badge variant="outline" className="font-normal">
                  {dealName}
                </Badge>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {format(new Date(note.meta.date), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 print:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-8 w-8"
              title="Copy content"
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.print()}
              className="h-8 w-8"
              title="Print"
            >
              <Printer className="size-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Key Takeaways */}
        {parsed.summary && (
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="size-4 text-amber-500" />
                Key Takeaways
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <MarkdownRenderer content={parsed.summary} size="compact" />
            </CardContent>
          </Card>
        )}

        {/* Action Items */}
        {parsed.actionItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ListTodo className="size-4 text-blue-500" />
                  Action Items
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {parsed.actionItems.filter((a) => a.completed).length}/
                  {parsed.actionItems.length} done
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ul className="space-y-2">
                {parsed.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {item.completed ? (
                      <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        item.completed
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Linked Todos */}
        {linkedTodos.length > 0 && (
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-500" />
                  Linked Todos
                </CardTitle>
                <Badge
                  variant={
                    completedTodos.length === linkedTodos.length
                      ? "default"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {completedTodos.length}/{linkedTodos.length} completed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-xs text-muted-foreground mb-2">
                Added to{" "}
                <span className="font-medium text-foreground">
                  {contactName}
                </span>
                {dealName && (
                  <>
                    {" "}
                    &middot;{" "}
                    <span className="font-medium text-foreground">
                      {dealName}
                    </span>
                  </>
                )}
              </p>
              <ul className="space-y-1.5">
                {linkedTodos.map((todo) => (
                  <li key={todo.path} className="flex items-center gap-2">
                    {todo.meta.status === "done" ? (
                      <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        todo.meta.status === "done"
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {todo.meta.title}
                    </span>
                    {todo.meta.priority &&
                      ["urgent", "high"].includes(todo.meta.priority) && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1 py-0"
                        >
                          {todo.meta.priority}
                        </Badge>
                      )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Full Content */}
        {note.content && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Full Content
              </h3>
              <MarkdownRenderer content={note.content} />
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

/** Shown when no communication is selected */
export function CommsDetailEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center p-8">
      <MessageSquare className="size-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">
        Select a communication
      </h3>
      <p className="text-sm text-muted-foreground/70 mt-1 max-w-[280px]">
        Click on a call, email, or text from the list to view the full details,
        key takeaways, and action items.
      </p>
    </div>
  )
}
