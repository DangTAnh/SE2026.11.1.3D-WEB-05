import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/load/vt124-load.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
