import { Skeleton } from "@/components/ui/skeleton"

export default function ContactCandidatesLoading() {
  return (
    <section className="container grid gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      <Skeleton className="h-14 w-full rounded-md" />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-md" />
        ))}
      </div>
    </section>
  )
}
