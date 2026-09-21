import { fileURLToPath } from "node:url";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { handleCatalog } from "./server/catalog.js";

function catalogDevApi(env: Record<string, string>): Plugin {
  return {
    name: "wesaw-catalog-api",
    configureServer(server) {
      server.middlewares.use("/api/catalog", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const result = await handleCatalog({
          query: Object.fromEntries(url.searchParams),
          env: { TMDB_API_KEY: env.TMDB_API_KEY, OMDB_API_KEY: env.OMDB_API_KEY },
          origin: req.headers.origin ?? null,
          referer: req.headers.referer ?? null,
          host: req.headers.host ?? null,
          secFetchSite: req.headers["sec-fetch-site"] ?? null,
        });
        res.statusCode = result.status;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      catalogDevApi(env),
      VitePWA({
        registerType: "autoUpdate",
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
          navigateFallback: "/index.html",
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "tmdb-images-v2",
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /\/api\/catalog/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "catalog-api",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: "127.0.0.1",
      port: 4183,
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
    preview: {
      host: "127.0.0.1",
      port: 4183,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/react/") || id.includes("/react-dom/")) return "react";
            if (
              id.includes("/@supabase/") ||
              id.includes("/@noble/") ||
              id.includes("/cross-fetch/")
            )
              return "supabase";
          },
        },
      },
    },
  };
});
