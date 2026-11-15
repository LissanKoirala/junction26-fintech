import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const PUBLIC_HOST = "vara-junction26.swedencentral.cloudapp.azure.com";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src"), "@shared": path.resolve(import.meta.dirname, "shared") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [PUBLIC_HOST, "localhost"],
    hmr: { clientPort: 443, protocol: "wss", host: PUBLIC_HOST },
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
