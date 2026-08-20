import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/chat": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
      "/auth": "http://127.0.0.1:8000",
      "/journeys": "http://127.0.0.1:8000",
      "/memory": "http://127.0.0.1:8000",
      "/documents": "http://127.0.0.1:8000",
      "/connectors": "http://127.0.0.1:8000",
      "/lawyer": "http://127.0.0.1:8000",
      "/lawyers": "http://127.0.0.1:8000",
      "/admin": "http://127.0.0.1:8000",
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});
