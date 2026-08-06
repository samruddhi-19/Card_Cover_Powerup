import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Trello Power-Ups need several independent HTML entry points (the
// connector page + one per popup). Vite's multi-page build handles that
// as long as every .html file is listed here.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        powerup: resolve(__dirname, "powerup.html"),
        auth: resolve(__dirname, "auth.html"),
        settings: resolve(__dirname, "settings.html"),
        cover: resolve(__dirname, "cover.html"),
      },
    },
  },
});
