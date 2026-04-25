import { describe, expect, it, vi } from "vitest"

import type { TodoMeta, VaultNote } from "@/lib/vault"

import {
  isTodoActiveStatus,
  selectMissedFollowupsFromContacts,
  selectProposedTodos,
  selectTodayTodos,
  selectUrgentTodos,
} from "./queries"

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/lib/prisma", () => ({
  db: {},
}))

function todo(
  path: string,
  meta: Partial<TodoMeta> & Pick<TodoMeta, "title">
): VaultNote<TodoMeta> {
  return {
    path,
    content: "",
    meta: {
      type: "todo",
      category: "business",
      ...meta,
    },
  }
}

describe("dashboard todo selectors", () => {
  const now = new Date("2026-04-25T12:00:00Z")

  it("accepts pending, in_progress, and legacy in-progress as active", () => {
    expect(isTodoActiveStatus(undefined)).toBe(true)
    expect(isTodoActiveStatus("pending")).toBe(true)
    expect(isTodoActiveStatus("in_progress")).toBe(true)
    expect(isTodoActiveStatus("in-progress")).toBe(true)
    expect(isTodoActiveStatus("proposed")).toBe(false)
    expect(isTodoActiveStatus("dismissed")).toBe(false)
    expect(isTodoActiveStatus("done")).toBe(false)
  })

  it("separates proposed todos and sorts newest first", () => {
    const selected = selectProposedTodos([
      todo("todos/a.md", {
        title: "old",
        status: "proposed",
        created: "2026-04-20",
      }),
      todo("todos/b.md", {
        title: "done",
        status: "done",
        created: "2026-04-24",
      }),
      todo("todos/c.md", {
        title: "new",
        status: "proposed",
        created: "2026-04-24",
      }),
    ])

    expect(selected.map((item) => item.meta.title)).toEqual(["new", "old"])
  })

  it("excludes proposed and dismissed todos from today's agenda", () => {
    const selected = selectTodayTodos(
      [
        todo("todos/a.md", {
          title: "manual",
          status: "pending",
          due_date: "2026-04-25",
        }),
        todo("todos/b.md", {
          title: "ai",
          status: "proposed",
          due_date: "2026-04-25",
        }),
        todo("todos/c.md", {
          title: "dismissed",
          status: "dismissed",
          due_date: "2026-04-25",
        }),
      ],
      now
    )

    expect(selected.map((item) => item.meta.title)).toEqual(["manual"])
  })

  it("selects urgent active todos by priority and due date", () => {
    const selected = selectUrgentTodos(
      [
        todo("todos/medium.md", {
          title: "overdue medium",
          status: "pending",
          priority: "medium",
          due_date: "2026-04-20",
        }),
        todo("todos/high.md", {
          title: "high",
          status: "in_progress",
          priority: "high",
          due_date: "2026-04-28",
        }),
        todo("todos/legacy.md", {
          title: "legacy urgent",
          status: "in-progress",
          priority: "urgent",
        }),
        todo("todos/proposed.md", {
          title: "proposed urgent",
          status: "proposed",
          priority: "urgent",
        }),
      ],
      now
    )

    expect(selected.map((item) => item.meta.title)).toEqual([
      "legacy urgent",
      "high",
      "overdue medium",
    ])
  })
})

describe("dashboard missed follow-up selector", () => {
  const cutoff = new Date("2026-04-23T12:00:00Z")

  it("uses the oldest inbound without a later outbound reply per contact", () => {
    const selected = selectMissedFollowupsFromContacts(
      [
        {
          id: "contact-a",
          name: "Alpha",
          company: null,
          communications: [
            {
              id: "old",
              subject: "Old",
              body: null,
              direction: "inbound",
              date: new Date("2026-04-20T12:00:00Z"),
            },
            {
              id: "newer",
              subject: "Newer",
              body: null,
              direction: "inbound",
              date: new Date("2026-04-22T12:00:00Z"),
            },
          ],
        },
        {
          id: "contact-b",
          name: "Beta",
          company: null,
          communications: [
            {
              id: "in",
              subject: "Answered",
              body: null,
              direction: "inbound",
              date: new Date("2026-04-20T12:00:00Z"),
            },
            {
              id: "out",
              subject: "Reply",
              body: null,
              direction: "outbound",
              date: new Date("2026-04-21T12:00:00Z"),
            },
          ],
        },
        {
          id: "contact-c",
          name: "Gamma",
          company: null,
          communications: [
            {
              id: "unknown",
              subject: "Unknown",
              body: null,
              direction: null,
              date: new Date("2026-04-20T12:00:00Z"),
            },
          ],
        },
      ],
      cutoff
    )

    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({
      contactId: "contact-a",
      referenceCommunicationId: "old",
    })
  })
})
