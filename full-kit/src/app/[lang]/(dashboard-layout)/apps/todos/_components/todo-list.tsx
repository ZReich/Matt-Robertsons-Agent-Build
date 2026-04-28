"use client"

import { useMemo, useState } from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { CheckCircle2, Circle, FileText, User } from "lucide-react"

import type { TodoResolvedContext } from "@/lib/vault/resolve-context"
import type { TodoMeta, VaultNote } from "@/lib/vault/shared"

import { normalizeEntityRef } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TodoDetailDrawer } from "@/components/todos/todo-detail-drawer"

type TodoNote = VaultNote<TodoMeta>

interface TodoListProps {
  notes: TodoNote[]
  contexts: Record<string, TodoResolvedContext>
  lang: string
  initialStatusFilter?: TodoStatusFilter
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "border-red-400 text-red-600",
  high: "border-orange-400 text-orange-600",
  medium: "border-yellow-400 text-yellow-600",
  low: "text-muted-foreground",
}

type TodoStatusFilter = "active" | "proposed" | "done" | "all"

function isActiveTodo(note: TodoNote) {
  return (
    note.meta.status == null ||
    note.meta.status === "pending" ||
    note.meta.status === "in_progress" ||
    note.meta.status === "in-progress"
  )
}

function sortTodos(todos: TodoNote[]): TodoNote[] {
  return [...todos].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.meta.priority ?? "medium"] ?? 2
    const pb = PRIORITY_ORDER[b.meta.priority ?? "medium"] ?? 2
    if (pa !== pb) return pa - pb
    const da = a.meta.due_date ? new Date(a.meta.due_date).getTime() : Infinity
    const db = b.meta.due_date ? new Date(b.meta.due_date).getTime() : Infinity
    return da - db
  })
}

function TodoItem({
  note,
  context: _context,
  onSelect,
}: {
  note: TodoNote
  context?: TodoResolvedContext
  onSelect: () => void
}) {
  const [done, setDone] = useState(note.meta.status === "done")
  const [loading, setLoading] = useState(false)
  const today = startOfDay(new Date())
  const isOverdue =
    !done && note.meta.due_date && isBefore(new Date(note.meta.due_date), today)
  const dealName = note.meta.deal ? normalizeEntityRef(note.meta.deal) : null
  const contactName = note.meta.contact
    ? normalizeEntityRef(note.meta.contact)
    : null
  const hasNotes = !!note.content?.trim()

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation() // Prevent opening the drawer
    if (done || loading) return
    setLoading(true)
    setDone(true)
    try {
      await fetch("/api/vault/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: note.path, status: "done" }),
      })
    } catch {
      setDone(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onSelect}
      className={`flex items-start gap-3 p-4 rounded-lg border bg-card transition-all w-full text-left hover:bg-accent/50 ${done ? "opacity-60" : ""}`}
    >
      <div
        onClick={toggle}
        role="checkbox"
        aria-checked={done}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
      >
        {done ? (
          <CheckCircle2 className="size-4 text-green-600" />
        ) : (
          <Circle className="size-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-snug ${done ? "line-through text-muted-foreground" : ""}`}
        >
          {note.meta.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {note.meta.due_date && (
            <span
              className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}
            >
              {isOverdue ? "Overdue · " : "Due "}
              {format(new Date(note.meta.due_date), "MMM d, yyyy")}
            </span>
          )}
          {contactName && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <User className="size-3" />
              {contactName}
            </span>
          )}
          {dealName && (
            <Badge variant="outline" className="text-xs py-0">
              {dealName}
            </Badge>
          )}
          {hasNotes && <FileText className="size-3 text-muted-foreground" />}
        </div>
      </div>

      {note.meta.priority && !done && (
        <Badge
          variant="outline"
          className={`text-xs capitalize shrink-0 ${PRIORITY_STYLE[note.meta.priority] ?? ""}`}
        >
          {note.meta.priority}
        </Badge>
      )}
    </button>
  )
}

export function TodoList({
  notes,
  contexts,
  lang,
  initialStatusFilter = "active",
}: TodoListProps) {
  const [statusFilter, setStatusFilter] =
    useState<TodoStatusFilter>(initialStatusFilter)
  const [selectedTodo, setSelectedTodo] = useState<TodoNote | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const businessNotes = useMemo(
    () => notes.filter((n) => n.meta.category === "business"),
    [notes]
  )
  const personalNotes = useMemo(
    () => notes.filter((n) => n.meta.category === "personal"),
    [notes]
  )

  function applyFilter(list: TodoNote[]) {
    if (statusFilter === "active") return list.filter(isActiveTodo)
    if (statusFilter === "proposed")
      return list.filter((t) => t.meta.status === "proposed")
    if (statusFilter === "done")
      return list.filter((t) => t.meta.status === "done")
    return list
  }

  function handleSelectTodo(note: TodoNote) {
    setSelectedTodo(note)
    setDrawerOpen(true)
  }

  function renderList(list: TodoNote[]) {
    const active = sortTodos(list.filter(isActiveTodo))
    const proposed = sortTodos(list.filter((t) => t.meta.status === "proposed"))
    const done = sortTodos(list.filter((t) => t.meta.status === "done"))

    const toShow =
      statusFilter === "active"
        ? active
        : statusFilter === "proposed"
          ? proposed
          : statusFilter === "done"
            ? done
            : [...active, ...proposed, ...done]

    if (toShow.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {statusFilter === "done"
            ? "No completed todos yet."
            : statusFilter === "proposed"
              ? "No todos need review."
              : "All caught up — no pending todos."}
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {toShow.map((note) => (
          <TodoItem
            key={note.path}
            note={note}
            context={contexts[note.path]}
            onSelect={() => handleSelectTodo(note)}
          />
        ))}
      </div>
    )
  }

  const statusLabel =
    statusFilter === "active"
      ? "Active"
      : statusFilter === "proposed"
        ? "Needs review"
        : statusFilter === "done"
          ? "Completed"
          : "All"

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {statusLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("proposed")}>
                Needs review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("done")}>
                Completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="business">
          <TabsList>
            <TabsTrigger value="business">
              Business ({applyFilter(businessNotes).length})
            </TabsTrigger>
            <TabsTrigger value="personal">
              Personal ({applyFilter(personalNotes).length})
            </TabsTrigger>
            <TabsTrigger value="all">
              All ({applyFilter(notes).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-4">
            {renderList(businessNotes)}
          </TabsContent>
          <TabsContent value="personal" className="mt-4">
            {renderList(personalNotes)}
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            {renderList(notes)}
          </TabsContent>
        </Tabs>
      </div>

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
