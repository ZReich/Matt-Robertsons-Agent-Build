"use server"

import { revalidateTag } from "next/cache"

import type { TodoMeta } from "@/lib/vault"

import { authenticateUser } from "@/lib/auth"
import { DASHBOARD_DATA_TAG } from "@/lib/dashboard/queries"
import { readNote, updateNote } from "@/lib/vault"

function assertValidTodoPath(notePath: string): void {
  if (
    !notePath ||
    !notePath.startsWith("todos/") ||
    notePath.includes("..") ||
    /[\\]/.test(notePath)
  ) {
    throw new Error("Invalid todo path")
  }
}

async function updateProposedTodo(
  notePath: string,
  nextStatus: Extract<TodoMeta["status"], "pending" | "dismissed">,
  actionName: string
): Promise<void> {
  await authenticateUser()
  assertValidTodoPath(notePath)

  const note = await readNote<TodoMeta>(notePath)
  if (note.meta.status !== "proposed") {
    console.warn(
      `[dashboard] ${actionName} ignored for non-proposed todo: ${notePath}`
    )
    return
  }

  await updateNote<TodoMeta>(notePath, {
    status: nextStatus,
    updated: new Date().toISOString().slice(0, 10),
  })
  revalidateTag(DASHBOARD_DATA_TAG)
}

export async function approveProposedTodo(notePath: string): Promise<void> {
  await updateProposedTodo(notePath, "pending", "approveProposedTodo")
}

export async function dismissProposedTodo(notePath: string): Promise<void> {
  await updateProposedTodo(notePath, "dismissed", "dismissProposedTodo")
}
