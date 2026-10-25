import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // YAML is parsed once at build time, so configuration costs nothing at runtime.
    plugins: [react(), tailwindcss(), yaml()],

    // Two backends: the map pages read the drilling API, the Weekly Geos
    // pages the reporting API, and they do not share a port. Each gets its
    // own prefix so a same-origin setup can reach both without CORS.
    server: {
      proxy: {
        // Only used when VITE_API_BASE_URL is blank and the API is reached same-origin.
        ...(env.VITE_API_BASE_URL
          ? { '/api': { target: env.VITE_API_BASE_URL, changeOrigin: true } }
          : {}),

        // The reporting API serves these under /api; the prefix is only
        // how the browser tells the two backends apart, so it is rewritten
        // away before the request leaves the dev server.
        '/weekly-api': {
          target: env.VITE_WEEKLY_PROXY_TARGET || 'http://localhost:5156',
          changeOrigin: true,
          // The https profile's certificate is self-signed.
          secure: false,
          rewrite: (path) => path.replace(/^\/weekly-api/, '/api'),
        },
      },
    },

    test: {
      environment: 'jsdom',
      globals: false,
      include: ['tests/**/*.test.{js,jsx}'],
      setupFiles: ['tests/setup/canvas.js', 'tests/setup/pointer.js'],
      css: false,
    },
  };
});
