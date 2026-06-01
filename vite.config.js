import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["church-logo.png", "favicon.ico"],
      manifest: {
        name: "Dominion City Dutse — Connect",
        short_name: "DC Connect",
        description: "Church engagement & followup platform",
        theme_color: "#ffffff",
        background_color: "#0b115b",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "church-logo.png", sizes: "192x192", type: "image/png" },
          { src: "church-logo.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Cache everything so the app works fully offline in low-network zones
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 86400 * 365 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  build: { outDir: "dist", sourcemap: false },
});
