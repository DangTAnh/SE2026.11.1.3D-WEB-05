import { defineConfig } from 'vitest/config';

// The load harness is intentionally outside `npm test`: it measures the 40-task
// contention scenario and should not slow or destabilise the normal suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/load/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
