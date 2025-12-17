import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    setupFiles: [path.resolve(__dirname, "src/test/setupTests.ts")],
  },
});
