import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


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
        manualChunks: {
          // Core vendor bundle (react ecosystem)
          vendor: ["react", "react-dom", "react-router-dom"],
          // Data fetching and state management
          query: ["@tanstack/react-query", "axios", "zustand"],
          // UI components (Radix primitives)
          "ui-primitives": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          // Form handling
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          // Supabase
          supabase: ["@supabase/supabase-js"],
        },
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
