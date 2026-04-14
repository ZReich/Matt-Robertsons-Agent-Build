"use client"

import { useState, useMemo } from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { CheckCircle2, Circle } from "lucide-react"

import type { TodoMeta, VaultNote } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TodoNote = VaultNote<TodoMeta>

interface TodoListProps {
  notes: TodoNote[]
  lang: string
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

function TodoItem({ note }: { note: TodoNote }) {
  const [done, setDone] = useState(note.meta.status === "done")
  const [loading, setLoading] = useState(false)
  const today = startOfDay(new Date())
  const isOverdue =
    !done &&
    note.meta.due_date &&
    isBefore(new Date(note.meta.due_date), today)
  const dealName = note.meta.deal?.replace(/\[\[|\]\]/g, "")

  async function toggle() {
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
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border bg-card transition-opacity ${done ? "opacity-60" : ""}`}
    >
      <button
        onClick={toggle}
        disabled={loading || done}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
        aria-label={done ? "Done" : "Mark as done"}
      >
        {done ? (
          <CheckCircle2 className="size-4 text-green-600" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>

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
          {dealName && (
            <Badge variant="outline" className="text-xs py-0">
              {dealName}
            </Badge>
          )}
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
    </div>
  )
}

export function TodoList({ notes }: TodoListProps) {
  const [statusFilter, setStatusFilter] = useState<"active" | "done" | "all">(
    "active"
  )

  const businessNotes = useMemo(
    () => notes.filter((n) => n.meta.category === "business"),
    [notes]
  )
  const personalNotes = useMemo(
    () => notes.filter((n) => n.meta.category === "personal"),
    [notes]
  )

  function applyFilter(list: TodoNote[]) {
    if (statusFilter === "active")
      return list.filter((t) => t.meta.status !== "done")
    if (statusFilter === "done")
      return list.filter((t) => t.meta.status === "done")
    return list
  }

  function renderList(list: TodoNote[]) {
    const active = sortTodos(list.filter((t) => t.meta.status !== "done"))
    const done = sortTodos(list.filter((t) => t.meta.status === "done"))

    const toShow =
      statusFilter === "active"
        ? active
        : statusFilter === "done"
          ? done
          : [...active, ...done]

    if (toShow.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {statusFilter === "done"
            ? "No completed todos yet."
            : "All caught up — no pending todos."}
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {toShow.map((note) => (
          <TodoItem key={note.path} note={note} />
        ))}
      </div>
    )
  }

  const statusLabel =
    statusFilter === "active"
      ? "Active"
      : statusFilter === "done"
        ? "Completed"
        : "All"

  return (
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
  )
}
