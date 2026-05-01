import type { RouteType } from "@/types"

// Single-broker CRM: every app route is private by default. Only the auth
// flow itself (sign-in / register / forgot-password) is reachable without a
// session, plus the marketing root and the public docs site.
export const routeMap = new Map<string, RouteType>([
  ["/sign-in", { type: "guest" }],
  ["/register", { type: "guest" }],
  ["/forgot-password", { type: "guest" }],
  ["/verify-email", { type: "guest" }],
  ["/new-password", { type: "guest" }],
  ["/", { type: "public" }],
  ["/docs", { type: "public" }],
])
