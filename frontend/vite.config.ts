import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return;

  if (id.includes("react-dom") || id.includes("react-router") || id.includes("/react/")) {
    return "vendor-react";
  }

  if (id.includes("@tanstack/react-query") || id.includes("axios") || id.includes("zustand")) {
    return "vendor-data";
  }

  if (id.includes("@supabase/supabase-js")) {
    return "vendor-supabase";
  }

  if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("embla-carousel-react") || id.includes("swiper")) {
    return "vendor-ui";
  }

  if (id.includes("react-hook-form") || id.includes("@hookform/resolvers") || id.includes("/zod/")) {
    return "vendor-forms";
  }

  if (id.includes("recharts") || id.includes("date-fns")) {
    return "vendor-analytics";
  }

}


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["unnoised-johnie-coetaneously.ngrok-free.dev"],
    hmr: {
      port: 5173,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // PERFORMANCE: Build optimizations for production
  build: {
    // Generate sourcemaps only in development for debugging
    sourcemap: mode === "development",
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    // Increase chunk size warning limit (default 500KB)
    chunkSizeWarningLimit: 600,
  },
  // ESBuild options for minification (faster than terser)
  esbuild: {
    // Remove console.log in production
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  // Preview server for production builds
  preview: {
    port: 4173,
  },
}));
