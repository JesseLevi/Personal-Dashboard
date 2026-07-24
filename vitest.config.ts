import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors tsconfig.json's "@/*" -> "./*" so a tested module (lib/boards/schemas.ts,
  // #94) can use the same absolute-import convention every other lib/boards
  // file already uses (queries.ts -> session.ts, actions.ts -> positioning.ts),
  // instead of a one-off relative import just for testability.
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
