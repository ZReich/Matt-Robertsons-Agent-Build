import Link from "next/link"
import { ArrowRight, Bot, ListTodo } from "lucide-react"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
} from "@/lib/vault"
import type { Metadata } from "next"
import type { TodoStatusFilter } from "./_components/todo-list"

import { getPendingTodoSuggestions } from "@/lib/dashboard/queries"
import { listPrismaTodoNotesWithContexts } from "@/lib/todos/prisma-todo-notes"
import { listNotes } from "@/lib/vault"
import { resolveAllTodoContexts } from "@/lib/vault/resolve-context"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TodoList } from "./_components/todo-list"

export const metadata: Metadata = {
  title: "Todos",
}

interface TodosPageProps {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ status?: string }>
}

export default async function TodosPage({
  params,
  searchParams,
}: TodosPageProps) {
  const { lang } = await params
  const status = (await searchParams)?.status
  const initialStatusFilter = toStatusFilter(status)

  // Fetch todos + context data in parallel
  const [
    todoNotes,
    prismaTodoData,
    clientNotes,
    contactNotes,
    dealNotes,
    commNotes,
    pendingTodoSuggestions,
  ] = await Promise.all([
    listNotes<TodoMeta>("todos"),
    listPrismaTodoNotesWithContexts(),
    listNotes<ClientMeta>("clients"),
    listNotes<ContactMeta>("contacts"),
    listNotes<DealMeta>("clients"), // deals live under clients/
    listNotes<CommunicationMeta>("communications"),
    getPendingTodoSuggestions(),
  ])
  const allTodoNotes = [...todoNotes, ...prismaTodoData.notes]

  // Resolve context for every todo on the server
  const vaultContexts = resolveAllTodoContexts(
    todoNotes,
    clientNotes,
    contactNotes,
    dealNotes,
    commNotes
  )
  const contexts = { ...vaultContexts, ...prismaTodoData.contexts }

  const activeBusiness = allTodoNotes.filter(
    (n) => n.meta.category === "business" && n.meta.status !== "done"
  ).length
  const activePersonal = allTodoNotes.filter(
    (n) => n.meta.category === "personal" && n.meta.status !== "done"
  ).length
  const activeTotal = activeBusiness + activePersonal

  return (
    <section className="container max-w-3xl grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <ListTodo className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Todos</h1>
          <p className="text-sm text-muted-foreground">
            {activeTotal} active &middot; {activeBusiness} business,{" "}
            {activePersonal} personal
          </p>
        </div>
      </div>

      {pendingTodoSuggestions.total > 0 && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="font-semibold">
                  {pendingTodoSuggestions.total} AI suggestion
                  {pendingTodoSuggestions.total !== 1 ? "s" : ""} waiting in the
                  Agent Queue
                </p>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {pendingTodoSuggestions.top
                    .slice(0, 3)
                    .map((suggestion) => suggestion.title)
                    .join(" • ")}
                </p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0">
              <Link href={`/${lang}/pages/agent`}>
                Open Agent Queue <ArrowRight className="ms-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <TodoList
        notes={allTodoNotes}
        contexts={contexts}
        lang={lang}
        initialStatusFilter={initialStatusFilter}
      />
    </section>
  )
}

function toStatusFilter(status: string | undefined): TodoStatusFilter {
  if (status === "proposed") return "proposed"
  if (status === "done") return "done"
  if (status === "all") return "all"
  return "active"
}
