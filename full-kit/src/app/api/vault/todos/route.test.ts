import { beforeEach, describe, expect, it, vi } from "vitest"

import { authenticateUser } from "@/lib/auth"
import {
  archivePrismaTodoFromVaultPath,
  updatePrismaTodoFromVaultPath,
} from "@/lib/todos/prisma-todo-notes"

import { DELETE, PATCH } from "./route"

vi.mock("@/lib/auth", () => ({
  authenticateUser: vi.fn(),
}))

vi.mock("@/lib/todos/prisma-todo-notes", () => ({
  archivePrismaTodoFromVaultPath: vi.fn(),
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
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" })

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
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" })
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
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" })

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
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" })

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
    vi.mocked(authenticateUser).mockResolvedValue({ id: "user-1" })
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
})
