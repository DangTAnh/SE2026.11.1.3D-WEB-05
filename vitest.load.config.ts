import { defineConfig } from 'vitest/config';

/**
 * The load harness is kept out of `npm test` so the default suite stays fast
 * and deterministic. Run it with `npm run test:load`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/load/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
