import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { FullBenchmarkExecutionResult } from './fixtures/benchmark-runner.ts';

const FIXTURE_URL = '/tests/e2e/fixtures/benchmark-runner.html';

test('record same-host benchmark run for the backends this host supports @evidence', async ({ page, browser, browserName, isMobile }) => {
  test.skip(isMobile, 'Benchmark runs once on desktop Chromium');
  test.setTimeout(180_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(FIXTURE_URL);
  await expect(page.locator('#host')).toBeVisible();

  // Dynamic environment probing
  const probed = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { supported: false, renderer: '', vendor: '', webgpuAdapter: null };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : '';
    const vendor = ext ? (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) : '';
    const gpu = (
      navigator as Navigator & {
        gpu?: {
          requestAdapter?: () => Promise<{
            info?: { vendor?: string; architecture?: string };
          } | null>;
        };
      }
    ).gpu;
    let webgpuAdapter: { vendor: string; architecture: string } | null = null;
    if (typeof gpu?.requestAdapter === 'function') {
      try {
        const adapter = await gpu.requestAdapter();
        if (adapter !== null) {
          const info = adapter.info ?? {};
          webgpuAdapter = { vendor: info.vendor ?? '', architecture: info.architecture ?? '' };
        }
      } catch {
        webgpuAdapter = null;
      }
    }
    return { supported: true, renderer, vendor, webgpuAdapter };
  });

  expect(probed.supported).toBe(true);
  if (!probed.renderer || probed.renderer.trim() === '') {
    throw new Error('benchmark: WEBGL_debug_renderer_info did not return a renderer string; refusing unmeasured environment.');
  }

  const browserVersion = browser.version();
  if (!browserVersion || browserVersion.trim() === '') {
    throw new Error('benchmark: browser.version() is required; refusing unmeasured environment.');
  }

  const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  if (!commit || commit.trim() === '') {
    throw new Error('benchmark: git commit hash is required; refusing unmeasured environment.');
  }

  const osString = `${os.type()} ${os.release()}`;
  const isSoftwareRenderer = probed.renderer.includes('SwiftShader') || probed.renderer.includes('Subzero');
  const adapterLabel = probed.webgpuAdapter
    ? [probed.webgpuAdapter.vendor, probed.webgpuAdapter.architecture].filter((part) => part !== '').join(' ')
    : '';
  const gpuName = isSoftwareRenderer
    ? `${probed.renderer} [Software Renderer]`
    : adapterLabel
      ? `${probed.renderer} [WebGPU adapter: ${adapterLabel}]`
      : probed.renderer;
  const driverName = isSoftwareRenderer
    ? 'SwiftShader'
    : probed.vendor
      ? `${probed.vendor}; exact driver version not exposed by the browser`
      : 'Unknown Driver';

  const env = {
    browser: browserName === 'chromium' ? 'Chromium' : browserName,
    browserVersion,
    os: osString,
    gpu: gpuName,
    driver: driverName,
    commit,
    sameHost: true,
  };

  const result: FullBenchmarkExecutionResult = await page.evaluate(async (benchmarkEnv) => {
    return window.executeFullBenchmark!(benchmarkEnv);
  }, env);

  expect(result.webgl2Count).toBe(100);
  expect(result.markdown).toContain('# Benchmark result');
  expect(result.markdown).toContain('## Environment');
  expect(result.markdown).toContain('## Configuration');
  expect(result.markdown).toContain('Mode / particleCount');
  expect(result.markdown).toContain('## Runs');
  expect(result.markdown).toContain('| webgl2 | 100 |');

  const webgpuRow = result.markdown.split('\n').find((line) => line.startsWith('| webgpu '));
  if (webgpuRow === undefined) {
    throw new Error('benchmark: the result has no WebGPU row');
  }
  if (probed.webgpuAdapter !== null) {
    expect(result.webgpuCount).toBe(100);
    expect(webgpuRow).toMatch(/^\| webgpu \| 100 \|/);
  } else {
    expect(result.webgpuCount).toBe(0);
    expect(webgpuRow).toBe('| webgpu | n/a | n/a | n/a |');
  }

  // Write to test-results/ (or explicit env var), never overwrite committed documents
  const outputPath = process.env.BENCHMARK_OUTPUT_PATH
    ? path.resolve(process.env.BENCHMARK_OUTPUT_PATH)
    : path.resolve('test-results/benchmark-result.md');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.markdown, 'utf8');

  expect(fs.existsSync(outputPath)).toBe(true);
  expect(pageErrors).toEqual([]);
});
