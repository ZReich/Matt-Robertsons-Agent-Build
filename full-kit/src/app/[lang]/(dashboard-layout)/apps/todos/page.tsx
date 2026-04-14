import { ListTodo } from "lucide-react"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
} from "@/lib/vault"
import type { Metadata } from "next"

import { listNotes } from "@/lib/vault"
import { resolveAllTodoContexts } from "@/lib/vault/resolve-context"

import { TodoList } from "./_components/todo-list"

export const metadata: Metadata = {
  title: "Todos",
}

interface TodosPageProps {
  params: Promise<{ lang: string }>
}

export default async function TodosPage({ params }: TodosPageProps) {
  const { lang } = await params

  // Fetch todos + context data in parallel
  const [todoNotes, clientNotes, contactNotes, dealNotes, commNotes] =
    await Promise.all([
      listNotes<TodoMeta>("todos"),
      listNotes<ClientMeta>("clients"),
      listNotes<ContactMeta>("contacts"),
      listNotes<DealMeta>("clients"), // deals live under clients/
      listNotes<CommunicationMeta>("communications"),
    ])

  // Resolve context for every todo on the server
  const contexts = resolveAllTodoContexts(
    todoNotes,
    clientNotes,
    contactNotes,
    dealNotes,
    commNotes
  )

  const activeBusiness = todoNotes.filter(
    (n) => n.meta.category === "business" && n.meta.status !== "done"
  ).length
  const activePersonal = todoNotes.filter(
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

      <TodoList notes={todoNotes} contexts={contexts} lang={lang} />
    </section>
  )
}
