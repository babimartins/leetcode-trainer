import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Components use the automatic JSX runtime (no `import React`), matching Next.js.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
