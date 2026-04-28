import { ListTodo } from "lucide-react"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
} from "@/lib/vault"
import type { Metadata } from "next"
import type { TodoStatusFilter } from "./_components/todo-list"

import { listPrismaTodoNotesWithContexts } from "@/lib/todos/prisma-todo-notes"
import { listNotes } from "@/lib/vault"
import { resolveAllTodoContexts } from "@/lib/vault/resolve-context"

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
  ] = await Promise.all([
    listNotes<TodoMeta>("todos"),
    listPrismaTodoNotesWithContexts(),
    listNotes<ClientMeta>("clients"),
    listNotes<ContactMeta>("contacts"),
    listNotes<DealMeta>("clients"), // deals live under clients/
    listNotes<CommunicationMeta>("communications"),
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
