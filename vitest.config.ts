import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "e2e/**"],
    coverage: {
      exclude: [
        // Browser-only Canvas/DOM code — not runnable in Node environment
        "src/lib/image-resize.ts",
        // S3 singleton/infrastructure — no testable logic beyond env wiring
        "src/lib/s3.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
