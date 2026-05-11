import path from "node:path";

import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@voltan/shared": path.resolve("../../packages/shared/src/index.ts"),
    },
  },
});
