import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    visualizer({
      filename: "stats.html",
      open: false, // Disable auto-open for CI/CD
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: (id) => {
          // Core React ecosystem
          if (id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // UI Components (Radix)
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }
          // Supabase
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // Form handling
          if (id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/zod') ||
            id.includes('node_modules/@hookform/')) {
            return 'vendor-forms';
          }
          // Monitoring (Sentry)
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
}));