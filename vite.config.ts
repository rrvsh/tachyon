import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    VitePWA({
      injectRegister: "auto",
      registerType: "prompt",
      manifest: {
        name: "Tachyon",
        short_name: "Tachyon",
        description: "Local-first OpenRouter chat client",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,woff2,png,svg,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  server: {
    watch: {
      ignored: ["**/.direnv/**"],
    },
  },
});
