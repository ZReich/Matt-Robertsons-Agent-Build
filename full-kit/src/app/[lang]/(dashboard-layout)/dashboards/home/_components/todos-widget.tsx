"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, isBefore, startOfDay } from "date-fns"
import { ArrowRight, Check, User, X } from "lucide-react"

import type { PendingTodoSuggestion } from "@/lib/dashboard/queries"
import type { TodoResolvedContext } from "@/lib/vault/resolve-context"
import type { TodoMeta, VaultNote } from "@/lib/vault/shared"

import { normalizeEntityRef } from "@/lib/vault/shared"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TodoDetailDrawer } from "@/components/todos/todo-detail-drawer"
import { approveProposedTodo, dismissProposedTodo } from "../_actions"
import { runDashboardMutation } from "./revalidate-on-focus"
import { TodoCheckbox } from "./todo-checkbox"

type TodoNote = VaultNote<TodoMeta>

interface TodosWidgetProps {
  proposedTodos: TodoNote[]
  urgentTodos: TodoNote[]
  pendingSuggestions: PendingTodoSuggestion[]
  pendingSuggestionsTotal: number
  contexts: Record<string, TodoResolvedContext>
  lang: string
}

export function TodosWidget({
  proposedTodos,
  urgentTodos,
  pendingSuggestions,
  pendingSuggestionsTotal,
  contexts,
  lang,
}: TodosWidgetProps) {
  const router = useRouter()
  const [selectedTodo, setSelectedTodo] = useState<TodoNote | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const todayStart = startOfDay(new Date())
  const visibleProposedTodos = proposedTodos.slice(0, 3)
  const visiblePendingSuggestions = pendingSuggestions.slice(0, 3)
  const hasProposedTodos = proposedTodos.length > 0
  const hasPendingSuggestions = pendingSuggestionsTotal > 0
  const showReviewSection = hasProposedTodos || hasPendingSuggestions
  const totalNeedsReview = proposedTodos.length + pendingSuggestionsTotal
  const hasUrgentTodos = urgentTodos.length > 0

  function handleSelect(todo: TodoNote) {
    setSelectedTodo(todo)
    setDrawerOpen(true)
  }

  function mutateProposedTodo(
    todo: TodoNote,
    action: (path: string) => Promise<void>
  ) {
    setPendingPath(todo.path)
    startTransition(async () => {
      try {
        await runDashboardMutation(() => action(todo.path))
        router.refresh()
      } finally {
        setPendingPath(null)
      }
    })
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Todos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {showReviewSection && (
            <section
              id="dashboard-todos-review"
              tabIndex={-1}
              className="scroll-mt-24 outline-none"
              aria-label="AI-proposed todos needing review"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs review
                </h3>
                <span className="text-xs text-muted-foreground">
                  {totalNeedsReview} pending
                </span>
              </div>
              <div className="space-y-2.5">
                {visibleProposedTodos.map((todo) => (
                  <div
                    key={todo.path}
                    className="rounded-md border bg-blue-500/5 p-2.5"
                  >
                    <p className="text-sm font-medium leading-tight">
                      {todo.meta.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {getTodoContextLabel(todo, contexts[todo.path])}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-2"
                        disabled={isPending && pendingPath === todo.path}
                        onClick={() =>
                          mutateProposedTodo(todo, approveProposedTodo)
                        }
                      >
                        <Check className="me-1 size-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        disabled={isPending && pendingPath === todo.path}
                        onClick={() =>
                          mutateProposedTodo(todo, dismissProposedTodo)
                        }
                      >
                        <X className="me-1 size-3" /> Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
                {visiblePendingSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-md border bg-blue-500/5 p-2.5"
                  >
                    <p className="text-sm font-medium leading-tight">
                      {suggestion.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {getSuggestionSubtitle(suggestion)}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        asChild
                      >
                        <Link href={`/${lang}/pages/agent`}>
                          <ArrowRight className="me-1 size-3" />
                          Review in Agent Queue
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {(proposedTodos.length > visibleProposedTodos.length ||
                pendingSuggestionsTotal > visiblePendingSuggestions.length) && (
                <Link
                  href={`/${lang}/pages/agent`}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View all {totalNeedsReview} pending
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </section>
          )}

          {showReviewSection && <div className="border-t" />}

          <section aria-label="Urgent todos">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Urgent
            </h3>
            {!hasUrgentTodos ? (
              <p className="py-2 text-sm text-muted-foreground">
                No urgent items right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {urgentTodos.map((todo) => {
                  const isOverdue =
                    todo.meta.due_date &&
                    isBefore(parseTodoDate(todo.meta.due_date), todayStart)
                  const contactName = todo.meta.contact
                    ? normalizeEntityRef(todo.meta.contact)
                    : null
                  return (
                    <div
                      key={todo.path}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(todo)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          handleSelect(todo)
                        }
                      }}
                      className="flex w-full cursor-pointer items-start gap-2 rounded-md p-1 -m-1 text-left transition-colors hover:bg-accent/50"
                    >
                      <div onClick={(event) => event.stopPropagation()}>
                        <TodoCheckbox path={todo.path} done={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {todo.meta.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {todo.meta.due_date && (
                            <p
                              className={`text-xs ${isOverdue ? "font-medium text-red-500" : "text-muted-foreground"}`}
                            >
                              {isOverdue ? "Overdue • " : "Due "}
                              {format(
                                parseTodoDate(todo.meta.due_date),
                                "MMM d"
                              )}
                            </p>
                          )}
                          {contactName && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <User className="size-2.5" />
                              {contactName}
                            </span>
                          )}
                        </div>
                      </div>
                      {todo.meta.priority === "urgent" && (
                        <div className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </CardContent>
        <div className="px-6 pb-4">
          <Link
            href={`/${lang}/apps/todos`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            All Todos <ArrowRight className="size-3" />
          </Link>
        </div>
      </Card>

      <TodoDetailDrawer
        todo={selectedTodo}
        context={selectedTodo ? (contexts[selectedTodo.path] ?? null) : null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lang={lang}
      />
    </>
  )
}

function getTodoContextLabel(
  todo: TodoNote,
  context: TodoResolvedContext | undefined
) {
  if (context?.person) return context.person.name
  if (context?.deal) return context.deal.noteTitle
  if (context?.sourceComm?.subject) return context.sourceComm.subject
  if (todo.meta.contact) return normalizeEntityRef(todo.meta.contact)
  if (todo.meta.deal) return normalizeEntityRef(todo.meta.deal)
  return todo.content.trim().split("\n")[0] || "No additional context"
}

function getSuggestionSubtitle(suggestion: PendingTodoSuggestion) {
  const parts: string[] = []
  if (suggestion.contactName) parts.push(suggestion.contactName)
  if (suggestion.dueHint) parts.push(`due ${suggestion.dueHint}`)
  if (parts.length > 0) return parts.join(" • ")
  return suggestion.summary
}

function parseTodoDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    )
  }

  return new Date(value)
}
