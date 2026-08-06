import { defineConfig } from "vite";

/**
 * Study A build configuration.
 *
 * Study A has no runtime dependencies at all — no renderer, no animation
 * library, no framework. There is consequently nothing to code-split: the
 * entire experience is HTML, CSS and a small enhancement bundle.
 *
 * That is the point of the comparison. Study B needs a manualChunks strategy
 * and a dynamic-import boundary to keep 126 kB of `three` off the critical
 * path. Study A needs neither, and the build config being this short is itself
 * a data point for the §8 maintainability score.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
    reportCompressedSize: true,
  },
  server: {
    port: 5184,
    strictPort: true,
  },
  preview: {
    port: 4184,
    strictPort: true,
  },
});
