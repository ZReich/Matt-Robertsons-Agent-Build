import { describe, expect, it } from "vitest"

import { authorizeScrubRequest, loadScrubRouteConfig } from "./scrub-auth"

describe("scrub-auth", () => {
  it("keeps routes disabled unless SCRUB_ROUTES_ENABLED is true", () => {
    const env = {
      SCRUB_ROUTES_ENABLED: "false",
      SCRUB_ADMIN_TOKEN: "a".repeat(32),
      SCRUB_CRON_SECRET: "b".repeat(32),
    }

    expect(loadScrubRouteConfig(env).enabled).toBe(false)
  })

  it("authorizes admin and cron tokens independently", () => {
    const config = {
      enabled: true,
      adminToken: "a".repeat(32),
      cronSecret: "b".repeat(32),
    }

    expect(
      authorizeScrubRequest(
        new Headers({ "x-admin-token": "a".repeat(32) }),
        config,
        { allowCron: false }
      )
    ).toEqual({ ok: true, via: "admin" })
    expect(
      authorizeScrubRequest(
        new Headers({ authorization: `Bearer ${"b".repeat(32)}` }),
        config,
        { allowCron: true }
      )
    ).toEqual({ ok: true, via: "cron" })
    expect(
      authorizeScrubRequest(
        new Headers({ authorization: `Bearer ${"b".repeat(32)}` }),
        config,
        { allowCron: false }
      )
    ).toEqual({ ok: false, reason: "unauthorized" })
  })
})
