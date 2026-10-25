import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Hunika",
        short_name: "Hunika",
        description: "Sell maize and beans now, or store them.",
        theme_color: "#14532d",
        background_color: "#f4efe6",
        display: "standalone",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json,geojson,webmanifest}"],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
