import type { Metadata } from "next"
import { ListTodo } from "lucide-react"

import { listNotes } from "@/lib/vault"
import type { TodoMeta } from "@/lib/vault"

import { TodoList } from "./_components/todo-list"

export const metadata: Metadata = {
  title: "Todos",
}

interface TodosPageProps {
  params: Promise<{ lang: string }>
}

export default async function TodosPage({ params }: TodosPageProps) {
  const { lang } = await params
  const notes = await listNotes<TodoMeta>("todos")

  const activeBusiness = notes.filter(
    (n) => n.meta.category === "business" && n.meta.status !== "done"
  ).length
  const activePersonal = notes.filter(
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
            {activeTotal} active &middot; {activeBusiness} business, {activePersonal}{" "}
            personal
          </p>
        </div>
      </div>

      <TodoList notes={notes} lang={lang} />
    </section>
  )
}
