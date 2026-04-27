import { describe, expect, it } from "vitest"

import {
  authorizeEmailBackfillRequest,
  loadEmailBackfillRouteConfig,
} from "./email-backfill-auth"

describe("email-backfill-auth", () => {
  it("keeps routes disabled unless EMAIL_BACKFILL_ROUTES_ENABLED is true", () => {
    expect(
      loadEmailBackfillRouteConfig({
        EMAIL_BACKFILL_ROUTES_ENABLED: "false",
        EMAIL_BACKFILL_ADMIN_TOKEN: "a".repeat(32),
      }).enabled
    ).toBe(false)
  })

  it("authorizes the dedicated admin token", () => {
    const config = { enabled: true, adminToken: "a".repeat(32) }

    expect(
      authorizeEmailBackfillRequest(
        new Headers({ "x-admin-token": "a".repeat(32) }),
        config
      )
    ).toEqual({ ok: true, via: "admin" })
    expect(
      authorizeEmailBackfillRequest(
        new Headers({ "x-admin-token": "wrong" }),
        config
      )
    ).toEqual({ ok: false, reason: "unauthorized" })
  })
})
