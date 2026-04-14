"use client"

import { useState } from "react"
import Link from "next/link"
import { format, isBefore, startOfDay } from "date-fns"
import { ArrowRight, User } from "lucide-react"

import type { TodoResolvedContext } from "@/lib/vault/resolve-context"
import type { TodoMeta, VaultNote } from "@/lib/vault/shared"

import { normalizeEntityRef } from "@/lib/vault/shared"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TodoDetailDrawer } from "@/components/todos/todo-detail-drawer"
import { TodoCheckbox } from "./todo-checkbox"

type TodoNote = VaultNote<TodoMeta>

interface UrgentTodosCardProps {
  todos: TodoNote[]
  contexts: Record<string, TodoResolvedContext>
  lang: string
}

export function UrgentTodosCard({
  todos,
  contexts,
  lang,
}: UrgentTodosCardProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoNote | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const todayStart = startOfDay(new Date())

  function handleSelect(todo: TodoNote) {
    setSelectedTodo(todo)
    setDrawerOpen(true)
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Urgent Todos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {todos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              All clear — no urgent items.
            </p>
          ) : (
            <div className="space-y-2.5">
              {todos.map((t) => {
                const isOverdue =
                  t.meta.due_date &&
                  isBefore(new Date(t.meta.due_date), todayStart)
                const contactName = t.meta.contact
                  ? normalizeEntityRef(t.meta.contact)
                  : null
                return (
                  <button
                    key={t.path}
                    onClick={() => handleSelect(t)}
                    className="flex items-start gap-2 w-full text-left hover:bg-accent/50 rounded-md p-1 -m-1 transition-colors"
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    >
                      <TodoCheckbox path={t.path} done={false} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {t.meta.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {t.meta.due_date && (
                          <p
                            className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                          >
                            {isOverdue ? "Overdue · " : "Due "}
                            {format(new Date(t.meta.due_date), "MMM d")}
                          </p>
                        )}
                        {contactName && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                            <User className="size-2.5" />
                            {contactName}
                          </span>
                        )}
                      </div>
                    </div>
                    {t.meta.priority === "urgent" && (
                      <div className="size-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
        <div className="px-6 pb-4">
          <Link
            href="../apps/todos"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
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
