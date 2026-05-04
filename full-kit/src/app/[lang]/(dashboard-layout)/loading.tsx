import { Skeleton } from "@/components/ui/skeleton"

// Generic fallback skeleton for any dashboard route that doesn't ship its
// own loading.tsx. Keeps perceived navigation snappy by rendering immediately
// while the server-side page work runs.
export default function DashboardLoading() {
  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  )
}
