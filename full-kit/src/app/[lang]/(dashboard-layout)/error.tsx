"use client"

// Top-level fallback for any page in the dashboard segment. Catches
// otherwise-uncaught throws from streamed server components so the user
// sees a recoverable error card instead of a blank page or the Next.js
// default error UI.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="container max-w-3xl p-6">
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Something went wrong loading this page.</p>
        <p className="mt-1 text-red-700">{error.message}</p>
        <button
          onClick={reset}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
