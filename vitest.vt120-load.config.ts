import { defineConfig } from 'vitest/config';
export default defineConfig({test: {environment: 'node', include: ['tests/load/vt120-load.test.ts'], testTimeout: 30000}});
