import { describe, expect, it } from "vitest"

import { PATCH, POST } from "./route"

describe("vault agent action writes", () => {
  it("rejects retired POST writes", async () => {
    const response = await POST(request("POST"))

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      code: "vault_agent_actions_retired",
    })
  })

  it("rejects retired PATCH writes", async () => {
    const response = await PATCH(request("PATCH"))

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      code: "vault_agent_actions_retired",
    })
  })
})

function request(method: "POST" | "PATCH") {
  return new Request("https://example.test/api/vault/agent-actions", {
    method,
    body: JSON.stringify({ action_type: "create-todo", summary: "Nope" }),
    headers: { "content-type": "application/json" },
  })
}
