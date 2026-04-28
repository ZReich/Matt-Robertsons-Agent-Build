import { beforeEach, describe, expect, it, vi } from "vitest"

import { authenticateUser } from "@/lib/auth"
import {
  archivePrismaTodoFromVaultPath,
  updatePrismaTodoFromVaultPath,
} from "@/lib/todos/prisma-todo-notes"
import { createNote, deleteNote, updateNote } from "@/lib/vault"

import { DELETE, PATCH, POST } from "./route"

vi.mock("@/lib/auth", () => ({
  authenticateUser: vi.fn(),
}))

vi.mock("@/lib/todos/prisma-todo-notes", () => ({
  archivePrismaTodoFromVaultPath: vi.fn(),
  getPrismaTodoId: (path: string) =>
    path.startsWith("prisma-todos/")
      ? path.slice("prisma-todos/".length)
      : null,
  isPrismaTodoPath: (path: string) => path.startsWith("prisma-todos/"),
  listPrismaTodoNotes: vi.fn(),
  updatePrismaTodoFromVaultPath: vi.fn(),
}))

vi.mock("@/lib/vault", () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
}))

describe("vault todos API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated Prisma todo updates", async () => {
    vi.mocked(authenticateUser).mockRejectedValue(new Error("Unauthorized"))

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "prisma-todos/todo-1", status: "done" }),
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "unauthorized" })
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("rejects cross-origin authenticated Prisma todo updates", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ path: "prisma-todos/todo-1", status: "done" }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "invalid origin" })
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("returns 404 todo_missing when PATCH targets a Prisma todo that no longer exists", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(updatePrismaTodoFromVaultPath).mockResolvedValue(null)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          path: "prisma-todos/missing-id",
          status: "done",
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: "todo not found",
      code: "todo_missing",
    })
  })

  it("rejects PATCH bodies with invalid priority values", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          path: "prisma-todos/todo-1",
          priority: "extreme",
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/priority/i),
    })
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("rejects PATCH bodies with invalid status values that would silently coerce to pending", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          path: "prisma-todos/todo-1",
          status: "dismissed",
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/status/i),
    })
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("returns 404 todo_missing when DELETE targets a Prisma todo that no longer exists", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(archivePrismaTodoFromVaultPath).mockResolvedValue(null)

    const response = await DELETE(
      new Request("http://localhost/api/vault/todos", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ path: "prisma-todos/missing-id" }),
      })
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: "todo not found",
      code: "todo_missing",
    })
  })

  it("rejects unauthenticated POSTs", async () => {
    vi.mocked(authenticateUser).mockRejectedValue(new Error("Unauthorized"))

    const response = await POST(
      new Request("http://localhost/api/vault/todos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ title: "x" }),
      })
    )

    expect(response.status).toBe(401)
    expect(createNote).not.toHaveBeenCalled()
  })

  it("rejects cross-origin POSTs", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await POST(
      new Request("http://localhost/api/vault/todos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ title: "x" }),
      })
    )

    expect(response.status).toBe(403)
    expect(createNote).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated DELETEs", async () => {
    vi.mocked(authenticateUser).mockRejectedValue(new Error("Unauthorized"))

    const response = await DELETE(
      new Request("http://localhost/api/vault/todos", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ path: "prisma-todos/todo-1" }),
      })
    )

    expect(response.status).toBe(401)
    expect(archivePrismaTodoFromVaultPath).not.toHaveBeenCalled()
    expect(deleteNote).not.toHaveBeenCalled()
  })

  it("rejects cross-origin DELETEs", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await DELETE(
      new Request("http://localhost/api/vault/todos", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ path: "prisma-todos/todo-1" }),
      })
    )

    expect(response.status).toBe(403)
    expect(archivePrismaTodoFromVaultPath).not.toHaveBeenCalled()
    expect(deleteNote).not.toHaveBeenCalled()
  })

  it("rejects PATCHes with a non-JSON content type with 415", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: { "content-type": "text/plain", origin: "http://localhost" },
        body: "path=prisma-todos/todo-1",
      })
    )

    expect(response.status).toBe(415)
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("rejects empty Prisma ids in PATCH paths", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ path: "prisma-todos/", status: "done" }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/path/i),
    })
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
  })

  it("rejects path-traversal attempts under the prisma-todos prefix", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          path: "prisma-todos/../todos/foo.md",
          status: "done",
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(updatePrismaTodoFromVaultPath).not.toHaveBeenCalled()
    expect(updateNote).not.toHaveBeenCalled()
  })

  it("returns the updated note from a same-origin authenticated Prisma PATCH", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(updatePrismaTodoFromVaultPath).mockResolvedValue({
      path: "prisma-todos/todo-1",
      meta: {
        type: "todo",
        category: "business",
        title: "Follow up",
        status: "done",
      },
      content: "",
    })

    const response = await PATCH(
      new Request("http://localhost/api/vault/todos", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          path: "prisma-todos/todo-1",
          status: "done",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(updatePrismaTodoFromVaultPath).toHaveBeenCalledWith(
      "prisma-todos/todo-1",
      { status: "done" }
    )
    expect(await response.json()).toMatchObject({
      path: "prisma-todos/todo-1",
      meta: { status: "done" },
    })
  })
})
