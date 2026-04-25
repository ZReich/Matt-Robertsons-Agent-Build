import { revalidateTag } from "next/cache"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authenticateUser } from "@/lib/auth"
import { readNote, updateNote } from "@/lib/vault"

import { approveProposedTodo, dismissProposedTodo } from "./_actions"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authenticateUser: vi.fn(),
}))

vi.mock("@/lib/dashboard/queries", () => ({
  DASHBOARD_DATA_TAG: "dashboard-data",
}))

vi.mock("@/lib/vault", () => ({
  readNote: vi.fn(),
  updateNote: vi.fn(),
}))

const mockedAuthenticateUser = vi.mocked(authenticateUser)
const mockedReadNote = vi.mocked(readNote)
const mockedUpdateNote = vi.mocked(updateNote)
const mockedRevalidateTag = vi.mocked(revalidateTag)

describe("dashboard proposed todo actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuthenticateUser.mockResolvedValue({ id: "user-1" } as never)
    mockedUpdateNote.mockResolvedValue({} as never)
  })

  it("approves a proposed todo and revalidates dashboard data", async () => {
    mockedReadNote.mockResolvedValue({
      path: "todos/business/follow-up.md",
      content: "",
      meta: {
        type: "todo",
        category: "business",
        title: "Follow up",
        status: "proposed",
      },
    } as never)

    await approveProposedTodo("todos/business/follow-up.md")

    expect(mockedAuthenticateUser).toHaveBeenCalledTimes(1)
    expect(mockedUpdateNote).toHaveBeenCalledWith(
      "todos/business/follow-up.md",
      expect.objectContaining({ status: "pending" })
    )
    expect(mockedRevalidateTag).toHaveBeenCalledWith("dashboard-data")
  })

  it("dismisses a proposed todo and revalidates dashboard data", async () => {
    mockedReadNote.mockResolvedValue({
      path: "todos/business/follow-up.md",
      content: "",
      meta: {
        type: "todo",
        category: "business",
        title: "Follow up",
        status: "proposed",
      },
    } as never)

    await dismissProposedTodo("todos/business/follow-up.md")

    expect(mockedUpdateNote).toHaveBeenCalledWith(
      "todos/business/follow-up.md",
      expect.objectContaining({ status: "dismissed" })
    )
    expect(mockedRevalidateTag).toHaveBeenCalledWith("dashboard-data")
  })

  it("no-ops when the todo is no longer proposed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    mockedReadNote.mockResolvedValue({
      path: "todos/business/follow-up.md",
      content: "",
      meta: {
        type: "todo",
        category: "business",
        title: "Follow up",
        status: "pending",
      },
    } as never)

    await approveProposedTodo("todos/business/follow-up.md")

    expect(mockedUpdateNote).not.toHaveBeenCalled()
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("approveProposedTodo ignored")
    )

    warn.mockRestore()
  })

  it("rejects invalid todo paths before reading or writing", async () => {
    await expect(approveProposedTodo("../secrets.md")).rejects.toThrow(
      "Invalid todo path"
    )

    expect(mockedReadNote).not.toHaveBeenCalled()
    expect(mockedUpdateNote).not.toHaveBeenCalled()
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
  })
})
