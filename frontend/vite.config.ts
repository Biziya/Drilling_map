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

    // Only used when VITE_API_BASE_URL is blank and the API is reached same-origin.
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
    },
  };
});
