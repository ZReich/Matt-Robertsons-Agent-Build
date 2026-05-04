"use client"

// Segment-level error boundary for the contact detail page.
//
// All 7 Suspense roots inside `page.tsx` stream their data on the server.
// Without an error boundary, a throw in any one of those streamed queries
// would blank the page mid-render. This catches whole-segment failures —
// the user sees a recoverable error card with a retry button instead of a
// blank screen. Per-card boundaries are a future nice-to-have.
export default function ContactDetailError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="container max-w-3xl p-6">
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Couldn&apos;t load this contact section.</p>
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
