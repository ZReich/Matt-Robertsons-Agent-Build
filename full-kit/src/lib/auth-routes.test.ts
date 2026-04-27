import { describe, expect, it } from "vitest"

import { isPublicRoute } from "./auth-routes"

describe("auth route visibility", () => {
  it("keeps the contact candidate review queue out of public /pages routes", () => {
    expect(isPublicRoute("/pages/leads")).toBe(true)
    expect(isPublicRoute("/pages/contact-candidates")).toBe(false)
    expect(isPublicRoute("/pages/contact-candidates?status=pending")).toBe(
      false
    )
  })
})
