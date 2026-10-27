import { ThreeRendererAdapter } from '../../../src/simulations/rendererAdapter.ts';
import { BENCHMARK_PROTOCOL, collectBenchmarkSamples, buildBenchmarkResult } from '../../../src/perf/benchmark.ts';
import { DEFAULT_CONFIG, type LabConfig } from '../../../src/presets/preset.ts';
import { toMarkdown, type BenchmarkEnvironment } from '../../../src/core/measurement/result.ts';
import type { PerformanceSnapshot } from '../../../src/core/types/measurement.ts';

export interface FullBenchmarkExecutionResult {
  readonly webgl2Count: number;
  readonly webgpuCount: number;
  readonly markdown: string;
  readonly limitations: readonly string[];
}

declare global {
  interface Window {
    executeFullBenchmark?: (env: BenchmarkEnvironment) => Promise<FullBenchmarkExecutionResult>;
  }
}

window.executeFullBenchmark = async (env: BenchmarkEnvironment): Promise<FullBenchmarkExecutionResult> => {
  const host = document.querySelector<HTMLElement>('#host')!;
  const limitations: string[] = [
    'Compute on WebGL2 runs through transform feedback, not a native compute shader.',
  ];

  // 1. Measure WebGL2
  const webglCanvas = document.createElement('canvas');
  webglCanvas.width = 800;
  webglCanvas.height = 600;
  host.replaceChildren(webglCanvas);

  const webglConfig: LabConfig = { ...DEFAULT_CONFIG, backendPreference: 'webgl2' };
  const webglAdapter = new ThreeRendererAdapter(webglCanvas, webglConfig);

  let webglSamples: PerformanceSnapshot[] = [];
  try {
    const actual = await webglAdapter.init({ width: 800, height: 600, pixelRatio: 1 });
    if (actual !== 'webgl2') {
      throw new Error(`Expected WebGL2 backend to initialize, got: ${actual}`);
    }
    webglAdapter.start();
    webglSamples = await collectBenchmarkSamples(webglAdapter, () => webglConfig, BENCHMARK_PROTOCOL);
    webglAdapter.dispose();
  } catch (error) {
    try {
      webglAdapter.dispose();
    } catch {}
    throw new Error(`WebGL2 benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Measure WebGPU if available
  const webgpuCanvas = document.createElement('canvas');
  webgpuCanvas.width = 800;
  webgpuCanvas.height = 600;
  host.replaceChildren(webgpuCanvas);

  const webgpuConfig: LabConfig = { ...DEFAULT_CONFIG, backendPreference: 'webgpu' };
  const webgpuAdapter = new ThreeRendererAdapter(webgpuCanvas, webgpuConfig);

  let webgpuSamples: PerformanceSnapshot[] = [];
  try {
    const actual = await webgpuAdapter.init({ width: 800, height: 600, pixelRatio: 1 });
    if (actual === 'webgpu') {
      webgpuAdapter.start();
      webgpuSamples = await collectBenchmarkSamples(webgpuAdapter, () => webgpuConfig, BENCHMARK_PROTOCOL);
    } else {
      limitations.push(
        'WebGPU is unavailable in this Chromium environment (navigator.gpu.requestAdapter() returned null). Physical WebGPU execution is BLOCKED; the requested webgpu run fell back to webgl2 and was not substituted.',
      );
    }
    webgpuAdapter.dispose();
  } catch {
    try {
      webgpuAdapter.dispose();
    } catch {}
    limitations.push(
      'WebGPU is unavailable in this Chromium environment (navigator.gpu.requestAdapter() returned null). Physical WebGPU execution is BLOCKED.',
    );
  }

  const allSamples = [...webglSamples];
  if (webgpuSamples.length === BENCHMARK_PROTOCOL.sampleCount) {
    allSamples.push(...webgpuSamples);
  }

  const result = await buildBenchmarkResult({
    environment: env,
    config: DEFAULT_CONFIG,
    samples: allSamples,
    limitations,
  });

  const markdown = toMarkdown(result);

  return {
    webgl2Count: webglSamples.length,
    webgpuCount: webgpuSamples.length,
    markdown,
    limitations,
  };
};
