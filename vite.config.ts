import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["buffer"],
      globals: {
        Buffer: true,
        global: true,
      },
    }),
    viteSingleFile(),
  ],
  build: {
    target: "es2020",
    outDir: "dist",
    assetsInlineLimit: Infinity,
  },
});
