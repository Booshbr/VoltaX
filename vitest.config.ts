import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    // Some suites run the real backtester over the full demo universe (seconds of
    // deterministic compute); keep a generous timeout so parallel runs don't flake.
    testTimeout: 30_000,
  },
});
