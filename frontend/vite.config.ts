import { defineConfig, loadEnv } from "vite";
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

  if (id.includes("@newrelic/browser-agent") || id.includes("@sentry/react")) {
    return "vendor-observability";
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

function htmlMetadataPlugin(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const metadata = {
    __APP_TITLE__: env.VITE_APP_TITLE || "MeriGauMata - Honoring the Mother, Nurturing Your Life",
    __APP_DESCRIPTION__: env.VITE_APP_DESCRIPTION || "Dedicated to the rescue, rehabilitation, and lifetime care of cows. Join our mission through donations and community engagement.",
    __APP_NAME__: env.VITE_APP_NAME || "Meri Gau Mata",
    __APP_KEYWORDS__: env.VITE_APP_KEYWORDS || "merigaumata, organic, pure, natural, cow rescue, cow welfare, gau seva, donate for cows, sustainable gau shala",
    __APP_CANONICAL_URL__: env.VITE_APP_CANONICAL_URL || env.VITE_FRONTEND_URL || "",
    __DEFAULT_SOCIAL_IMAGE__: env.VITE_DEFAULT_SOCIAL_IMAGE || "",
    __TWITTER_HANDLE__: env.VITE_TWITTER_HANDLE || "",
    __APP_LOGO_URL__: env.VITE_APP_LOGO_URL || "https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/brand-assets/brand-logo.png",
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
  plugins: [react(), htmlMetadataPlugin(mode)].filter(Boolean),
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
    chunkSizeWarningLimit: 650,
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
