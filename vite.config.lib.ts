import { defineConfig, type Plugin } from "vite";

const BANNER = `/**
 * Squads Decoder
 * https://github.com/christsim/squads-tx-hashes-util
 * MIT License — USE AT YOUR OWN RISK
 * Zero dependencies. Works in browsers and Node.js 16+.
 */`;

function bannerPlugin(): Plugin {
  return {
    name: "banner",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk") {
          chunk.code = BANNER + "\n" + chunk.code;
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [bannerPlugin()],
  build: {
    lib: {
      entry: "src/lib.ts",
      formats: ["es"],
      fileName: "squads-decoder",
    },
    outDir: "dist",
    minify: false,
    emptyOutDir: false,
  },
});
