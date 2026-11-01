import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Unit tests cover the logic in lib/; the React components are covered by the Playwright suite.
      include: ["lib/**/*.ts"],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
    },
  },
});
