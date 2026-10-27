import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { FullBenchmarkExecutionResult } from './fixtures/benchmark-runner.ts';

const FIXTURE_URL = '/tests/e2e/fixtures/benchmark-runner.html';

test('record fair two-backend benchmark run @evidence', async ({ page, browserName, isMobile }) => {
  test.skip(isMobile, 'Benchmark runs once on desktop Chromium');
  test.setTimeout(180_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(FIXTURE_URL);
  await expect(page.locator('#host')).toBeVisible();

  const env = {
    browser: browserName === 'chromium' ? 'Chromium' : browserName,
    browserVersion: '156.0.8078.4',
    os: 'Windows 10 Home (NT 10.0.26300)',
    gpu: 'NVIDIA GeForce GTX 1650',
    driver: '32.0.16.1088',
    commit: '7fc03c9',
    sameHost: true,
  };

  const result: FullBenchmarkExecutionResult = await page.evaluate(async (benchmarkEnv) => {
    return window.executeFullBenchmark!(benchmarkEnv);
  }, env);

  expect(result.webgl2Count).toBe(100);
  expect(result.markdown).toContain('# Benchmark result');
  expect(result.markdown).toContain('## Environment');
  expect(result.markdown).toContain('## Runs');
  expect(result.markdown).toContain('webgl2');

  const outputPath = path.resolve('docs/06-benchmark/2026-10-27-nvidia-gtx-1650-chromium.md');
  fs.writeFileSync(outputPath, result.markdown, 'utf8');

  expect(fs.existsSync(outputPath)).toBe(true);
  expect(pageErrors).toEqual([]);
});
