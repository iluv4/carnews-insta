import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit-test config. We only resolve the `@/` alias used across src/ — no React
// plugin or jsdom, because the suite covers pure server/lib logic, not
// components. Add `environment: 'jsdom'` here if/when component tests land.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
