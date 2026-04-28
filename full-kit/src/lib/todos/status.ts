import type { TodoMeta } from "@/lib/vault/shared"

/**
 * Pure client-safe predicates for vault todo statuses. Lives outside
 * `lib/dashboard/queries.ts` so that client components can import them
 * without dragging the server-only vault reader (`fs/promises`) into the
 * browser bundle.
 */

export function isTodoPendingLike(status: TodoMeta["status"] | undefined) {
  return status == null || status === "pending"
}

export function isTodoInProgressLike(status: TodoMeta["status"] | undefined) {
  return status === "in_progress" || status === "in-progress"
}

export function isTodoActiveStatus(status: TodoMeta["status"] | undefined) {
  return isTodoPendingLike(status) || isTodoInProgressLike(status)
}

/**
 * "Done"-bucket predicate for the todos UI. Treats user-dismissed AI
 * suggestions as a completed end state alongside `done`, so they don't
 * disappear from every visible filter on the /apps/todos page.
 */
export function isTodoDoneOrDismissed(status: TodoMeta["status"] | undefined) {
  return status === "done" || status === "dismissed"
}
