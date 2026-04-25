import type { ReactNode } from "react"

export function KanbanColumn({
  header,
  children,
}: {
  header: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-h-[24rem] w-[20rem] shrink-0 flex-col rounded-xl border bg-muted/20">
      <div className="border-b p-3">{header}</div>
      <div className="flex-1 p-2">{children}</div>
    </section>
  )
}
