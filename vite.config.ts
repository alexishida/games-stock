import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/** Identificador textual da build atual injetado pelo CI quando disponível. */
const buildNumber = process.env.BUILD_NUMBER ?? "";

export default defineConfig({
  root: path.resolve(__dirname),
  base: "./",
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber)
  },
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        renderer: path.resolve(__dirname, "src/renderer/index.html"),
        splash: path.resolve(__dirname, "src/splash/index.html")
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
