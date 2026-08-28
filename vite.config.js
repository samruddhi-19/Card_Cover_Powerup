import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

function proxyImageDevPlugin() {
  return {
    name: "proxy-image-dev-plugin",
    configureServer(server) {
      server.middlewares.use("/api/proxy-image", async (req, res) => {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get("url");
        const token = urlObj.searchParams.get("token");
        const key = urlObj.searchParams.get("key");

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Missing url parameter" }));
          return;
        }

        try {
          const headers = {};
          if (
            token &&
            key &&
            (targetUrl.includes("trello.com") || targetUrl.includes("api.trello.com"))
          ) {
            headers["Authorization"] = `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`;
          }

          const response = await fetch(targetUrl, { headers, redirect: "follow" });
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: "Failed to fetch image" }));
            return;
          }

          const contentType = response.headers.get("content-type") || "image/png";
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          res.setHeader("Content-Type", contentType);
          res.statusCode = 200;
          res.end(buffer);
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// Trello Power-Ups need several independent HTML entry points (the
// connector page + one per popup). Vite's multi-page build handles that
// as long as every .html file is listed here.
export default defineConfig({
  plugins: [react(), proxyImageDevPlugin()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        powerup: resolve(__dirname, "powerup.html"),
        auth: resolve(__dirname, "auth.html"),
        settings: resolve(__dirname, "settings.html"),
        cover: resolve(__dirname, "cover.html"),
        cardback: resolve(__dirname, "cardback.html"),
        editor: resolve(__dirname, "editor.html"),
      },
    },
  },
});

