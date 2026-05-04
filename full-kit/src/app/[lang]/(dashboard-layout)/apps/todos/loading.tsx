import { Skeleton } from "@/components/ui/skeleton"

export default function TodosLoading() {
  return (
    <section className="container grid gap-4 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </section>
  )
}
