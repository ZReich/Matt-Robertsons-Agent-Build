import { describe, expect, it, vi } from "vitest"

import { resolveDeterministicContactMatch } from "./contact-link"

function makeClient(
  matches: Array<{ id: string; archivedAt?: Date | null }> = []
) {
  return {
    contact: {
      findMany: vi.fn().mockResolvedValue(matches),
    },
  }
}

describe("resolveDeterministicContactMatch", () => {
  it("returns unique when exactly one active contact matches the normalized email", async () => {
    const client = makeClient([{ id: "contact-1", archivedAt: null }])
    const result = await resolveDeterministicContactMatch(
      { email: "  Tenant@Example.COM " },
      client as never
    )
    expect(result).toEqual({ kind: "unique", contactId: "contact-1" })
    expect(client.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: "tenant@example.com", mode: "insensitive" },
          archivedAt: null,
        }),
        take: 2,
      })
    )
  })

  it("blocks when more than one active contact matches", async () => {
    const client = makeClient([
      { id: "contact-1", archivedAt: null },
      { id: "contact-2", archivedAt: null },
    ])
    const result = await resolveDeterministicContactMatch(
      { email: "tenant@example.com" },
      client as never
    )
    expect(result).toEqual({ kind: "multiple" })
    expect(client.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 })
    )
  })

  it("returns none when there is no active contact match", async () => {
    const client = makeClient([])
    const result = await resolveDeterministicContactMatch(
      { email: "noone@example.com" },
      client as never
    )
    expect(result).toEqual({ kind: "none" })
  })

  it("blocks empty or malformed email values without querying the database", async () => {
    for (const value of ["", "   ", "not-an-email", null, undefined, "@a.com"]) {
      const client = makeClient([])
      const result = await resolveDeterministicContactMatch(
        { email: value as string | null | undefined },
        client as never
      )
      expect(result).toEqual({ kind: "blocked", reason: "invalid_email" })
      expect(client.contact.findMany).not.toHaveBeenCalled()
    }
  })

  it("blocks internal senders without querying the database", async () => {
    const client = makeClient([])
    const result = await resolveDeterministicContactMatch(
      { email: "matt@robertson.com", isInternal: true },
      client as never
    )
    expect(result).toEqual({ kind: "blocked", reason: "internal_sender" })
    expect(client.contact.findMany).not.toHaveBeenCalled()
  })

  it.each([
    ["noreply@example.com", "automation_or_platform_address"],
    ["no-reply@example.com", "automation_or_platform_address"],
    ["do-not-reply@example.com", "automation_or_platform_address"],
    ["notifications@example.com", "automation_or_platform_address"],
    ["mailer@example.com", "automation_or_platform_address"],
    ["postmaster@example.com", "automation_or_platform_address"],
    ["leads@buildout.com", "automation_or_platform_address"],
    ["alerts@notifications.crexi.com", "automation_or_platform_address"],
    ["info@vendor.com", "role_account"],
    ["support@vendor.com", "role_account"],
    ["sales@vendor.com", "role_account"],
    ["leasing@vendor.com", "role_account"],
  ])("blocks %s with reason %s", async (email, expectedReason) => {
    const client = makeClient([{ id: "should-not-be-returned" }])
    const result = await resolveDeterministicContactMatch(
      { email },
      client as never
    )
    expect(result).toEqual({ kind: "blocked", reason: expectedReason })
    expect(client.contact.findMany).not.toHaveBeenCalled()
  })

  it("excludes archived contacts via archivedAt: null filter", async () => {
    const client = makeClient([])
    await resolveDeterministicContactMatch(
      { email: "tenant@example.com" },
      client as never
    )
    const args = client.contact.findMany.mock.calls[0][0]
    expect(args.where.archivedAt).toBe(null)
  })

  it("uses case-insensitive matching so casing differences collapse to one match", async () => {
    const client = makeClient([{ id: "contact-1", archivedAt: null }])
    const result = await resolveDeterministicContactMatch(
      { email: "TENANT@example.com" },
      client as never
    )
    expect(result).toEqual({ kind: "unique", contactId: "contact-1" })
    const args = client.contact.findMany.mock.calls[0][0]
    expect(args.where.email).toEqual({
      equals: "tenant@example.com",
      mode: "insensitive",
    })
  })
})
