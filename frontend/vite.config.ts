import { readFileSync } from 'node:fs';
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

    // The website version, from VERSION at the repository root (see
    // VERSIONING.md), inlined as text: src/config/version.ts validates it.
    // Read here rather than imported, so the dev server never has to serve
    // files outside the frontend. Paths are from the frontend folder, like
    // loadEnv above. Restart the dev server after a bump.
    define: {
      __APP_VERSION__: JSON.stringify(readFileSync('../VERSION', 'utf8')),
    },

    // Forwards same-origin /api calls to the backend in development.
    server: {
      proxy: env.VITE_API_BASE_URL
        ? { '/api': { target: env.VITE_API_BASE_URL, changeOrigin: true } }
        : undefined,
    },

    test: {
      environment: 'jsdom',
      globals: false,
      include: ['tests/**/*.test.{js,jsx}'],
      setupFiles: ['tests/setup/canvas.js', 'tests/setup/pointer.js'],
      css: false,
      // Node 25+ has its own localStorage global, which hides jsdom's.
      poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
    },
  };
});
