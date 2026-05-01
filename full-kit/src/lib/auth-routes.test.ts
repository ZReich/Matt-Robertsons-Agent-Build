import { describe, expect, it } from "vitest"

import { isPublicRoute } from "./auth-routes"

describe("auth route visibility", () => {
  it("treats every CRM route as protected by default", () => {
    expect(isPublicRoute("/pages/leads")).toBe(false)
    expect(isPublicRoute("/pages/contact-candidates")).toBe(false)
    expect(isPublicRoute("/pages/contact-candidates?status=pending")).toBe(
      false
    )
    expect(isPublicRoute("/pages/clients")).toBe(false)
    expect(isPublicRoute("/dashboards/home")).toBe(false)
    expect(isPublicRoute("/apps/todos")).toBe(false)
  })

  it("leaves the marketing root and /docs public", () => {
    expect(isPublicRoute("/")).toBe(true)
    expect(isPublicRoute("/docs")).toBe(true)
    expect(isPublicRoute("/docs/getting-started")).toBe(true)
  })
})
