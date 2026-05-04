import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { downloadAttachment } from "./download-attachment"
import { getAccessToken } from "./token-manager"

vi.mock("server-only", () => ({}))

vi.mock("./token-manager", () => ({
  getAccessToken: vi.fn().mockResolvedValue("test-access-token"),
}))

const mockedGetAccessToken = getAccessToken as unknown as ReturnType<
  typeof vi.fn
>

const ORIGINAL_ENV = { ...process.env }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function plainResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  })
}

describe("downloadAttachment", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch")
    process.env.MSGRAPH_TARGET_UPN = "matt@example.com"
    mockedGetAccessToken.mockClear()
    mockedGetAccessToken.mockResolvedValue("test-access-token")
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    process.env = { ...ORIGINAL_ENV }
  })

  it("hits the Graph attachment endpoint with the bearer token and decodes contentBytes", async () => {
    const helloBytes = Buffer.from("hello pdf body").toString("base64")
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        id: "att-123",
        name: "lease.pdf",
        contentType: "application/pdf",
        size: 14,
        contentBytes: helloBytes,
      })
    )

    const blob = await downloadAttachment("msg-abc", "att-123")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!
    expect(calledUrl).toBe(
      "https://graph.microsoft.com/v1.0/users/matt%40example.com" +
        "/messages/msg-abc/attachments/att-123"
    )
    const init = calledInit as RequestInit
    expect(init?.headers).toEqual(
      expect.objectContaining({ authorization: "Bearer test-access-token" })
    )

    expect(blob).toEqual({
      id: "att-123",
      name: "lease.pdf",
      contentType: "application/pdf",
      size: 14,
      contentBytes: Buffer.from("hello pdf body"),
    })
    // Sanity: round-trips back to the same bytes.
    expect(blob.contentBytes.toString("utf8")).toBe("hello pdf body")
  })

  it("URL-encodes message and attachment ids with reserved chars", async () => {
    const bytes = Buffer.from("x").toString("base64")
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        id: "a",
        name: "n",
        contentType: "application/pdf",
        size: 1,
        contentBytes: bytes,
      })
    )

    await downloadAttachment("msg/with/slashes", "att=weird?id")

    const [calledUrl] = fetchSpy.mock.calls[0]!
    // encodeURIComponent must turn `/`, `=`, and `?` into %2F %3D %3F.
    expect(calledUrl).toContain("/messages/msg%2Fwith%2Fslashes")
    expect(calledUrl).toContain("/attachments/att%3Dweird%3Fid")
  })

  it("falls back to defaults when Graph omits id/name/contentType/size", async () => {
    const bytes = Buffer.from("x").toString("base64")
    fetchSpy.mockResolvedValueOnce(jsonResponse({ contentBytes: bytes }))

    const blob = await downloadAttachment("msg-1", "att-1")

    expect(blob.id).toBe("att-1")
    expect(blob.name).toBe("(unnamed)")
    expect(blob.contentType).toBe("application/octet-stream")
    expect(blob.size).toBe(0)
  })

  it("throws when MSGRAPH_TARGET_UPN is not set", async () => {
    delete process.env.MSGRAPH_TARGET_UPN

    await expect(downloadAttachment("m", "a")).rejects.toThrow(
      /MSGRAPH_TARGET_UPN not set/
    )
    // We bail before hitting the network or the token manager.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockedGetAccessToken).not.toHaveBeenCalled()
  })

  it("throws on a 404 with the truncated body included for debugging", async () => {
    fetchSpy.mockResolvedValueOnce(
      plainResponse("ItemNotFound: attachment is gone", 404)
    )
    await expect(downloadAttachment("m", "missing")).rejects.toThrow(
      /download attachment failed \(404\): ItemNotFound/
    )
  })

  it("throws on a 400", async () => {
    fetchSpy.mockResolvedValueOnce(plainResponse("Bad Request", 400))
    await expect(downloadAttachment("m", "a")).rejects.toThrow(
      /download attachment failed \(400\)/
    )
  })

  it("throws on a 500", async () => {
    fetchSpy.mockResolvedValueOnce(plainResponse("Internal Server Error", 500))
    await expect(downloadAttachment("m", "a")).rejects.toThrow(
      /download attachment failed \(500\)/
    )
  })

  it("truncates very long error bodies to 200 chars", async () => {
    const big = "x".repeat(5000)
    fetchSpy.mockResolvedValueOnce(plainResponse(big, 503))
    let captured: unknown
    try {
      await downloadAttachment("m", "a")
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(Error)
    const msg = (captured as Error).message
    // Prefix + 200-char slice, well under a 5000-char body.
    expect(msg.length).toBeLessThan(300)
    expect(msg).toMatch(/^download attachment failed \(503\): x{200}$/)
  })

  it("throws when Graph returns 200 but no contentBytes", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        id: "a",
        name: "ref.url",
        contentType: "text/html",
        size: 0,
      })
    )
    await expect(downloadAttachment("m", "a")).rejects.toThrow(
      /missing contentBytes/
    )
  })
})
