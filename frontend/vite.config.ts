import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return;

  // Core React & Router - Precise matching to avoid splitting other libraries
  if (
    id.includes("node_modules/react/") || 
    id.includes("node_modules/react-dom/") || 
    id.includes("node_modules/react-router/") ||
    id.includes("node_modules/react-router-dom/") ||
    id.includes("node_modules/scheduler/")
  ) {
    return "vendor-react";
  }

  // Data Persistence & Global State - Grouped to prevent cycles
  if (
    id.includes("@tanstack/react-query") || 
    id.includes("axios") || 
    id.includes("zustand")
  ) {
    return "vendor-data";
  }

  if (id.includes("@supabase/supabase-js")) {
    return "vendor-supabase";
  }

  if (id.includes("lucide-react")) {
    return "vendor-icons";
  }

  if (id.includes("embla-carousel-react") || id.includes("swiper")) {
    return "vendor-carousel";
  }

  if (id.includes("@radix-ui")) {
    return "vendor-ui";
  }

  if (id.includes("react-hook-form") || id.includes("@hookform/resolvers") || id.includes("/zod/")) {
    return "vendor-forms";
  }

  if (id.includes("recharts")) {
    return "vendor-charts";
  }

  if (id.includes("date-fns")) {
    return "vendor-date";
  }

}

function htmlMetadataPlugin(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const metadata = {
    __APP_TITLE__: env.VITE_APP_TITLE,
    __APP_DESCRIPTION__: env.VITE_APP_DESCRIPTION,
    __APP_NAME__: env.VITE_APP_NAME,
    __APP_KEYWORDS__: env.VITE_APP_KEYWORDS,
    __APP_CANONICAL_URL__: env.VITE_APP_CANONICAL_URL,
    __TWITTER_HANDLE__: env.VITE_TWITTER_HANDLE,
    __APP_LOGO_URL__: env.VITE_APP_LOGO_URL,
  };

  return {
    name: "html-metadata-plugin",
    transformIndexHtml(html: string) {
      return Object.entries(metadata).reduce(
        (output, [token, value]) => output.replaceAll(token, value),
        html
      );
    },
  };
}


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = (env.VITE_BACKEND_URL || "http://127.0.0.1:5001").replace(/\/+$/, "");

  return {
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      hmr: {
        port: 5173,
      },
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react(), htmlMetadataPlugin(mode)].filter(Boolean),
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
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
      // Locale bundles are lazy-loaded and intentionally large; keep warnings focused on real regressions.
      chunkSizeWarningLimit: 1000,
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
  };
});
