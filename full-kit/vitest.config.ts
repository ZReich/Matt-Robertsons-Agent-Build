import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Next.js App Router file conventions (route.ts, etc.) don't collide with .test.ts,
    // but we exclude node_modules explicitly to be safe with monorepo hoisting.
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
