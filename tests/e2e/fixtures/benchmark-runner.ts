import { ThreeRendererAdapter } from '../../../src/simulations/rendererAdapter.ts';
import {
  BENCHMARK_PROTOCOL,
  buildBenchmarkResult,
  collectBenchmarkSamples,
  webGpuLimitation,
  type WebGpuAdapterIdentity,
  type WebGpuBenchmarkOutcome,
} from '../../../src/perf/benchmark.ts';
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

interface WebGpuProbe {
  readonly apiPresent: boolean;
  readonly adapter: WebGpuAdapterIdentity | null;
  readonly error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Probes WebGPU separately from renderer initialization. Without this, an
 * init/sampling failure is indistinguishable from a machine with no adapter.
 */
async function probeWebGpuAdapter(): Promise<WebGpuProbe> {
  const gpu = (
    navigator as Navigator & {
      gpu?: {
        requestAdapter?: () => Promise<{
          info?: { vendor?: string; architecture?: string };
        } | null>;
      };
    }
  ).gpu;
  if (typeof gpu?.requestAdapter !== 'function') {
    return { apiPresent: false, adapter: null, error: null };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (adapter === null) return { apiPresent: true, adapter: null, error: null };
    const info = adapter.info ?? {};
    return {
      apiPresent: true,
      adapter: { vendor: info.vendor ?? '', architecture: info.architecture ?? '' },
      error: null,
    };
  } catch (error) {
    return { apiPresent: true, adapter: null, error: errorMessage(error) };
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
    throw new Error(`WebGL2 benchmark failed: ${errorMessage(error)}`);
  }

  // 2. Measure WebGPU only when the browser actually exposes an adapter.
  const probe = await probeWebGpuAdapter();
  let webgpuOutcome: WebGpuBenchmarkOutcome;
  let webgpuSamples: PerformanceSnapshot[] = [];

  if (!probe.apiPresent) {
    webgpuOutcome = { status: 'api-unavailable' };
  } else if (probe.error !== null) {
    webgpuOutcome = { status: 'failed', phase: 'adapter probe', error: probe.error, adapter: null };
  } else if (probe.adapter === null) {
    webgpuOutcome = { status: 'adapter-unavailable' };
  } else {
    const adapter = probe.adapter;
    const webgpuCanvas = document.createElement('canvas');
    webgpuCanvas.width = 800;
    webgpuCanvas.height = 600;
    host.replaceChildren(webgpuCanvas);

    const webgpuConfig: LabConfig = { ...DEFAULT_CONFIG, backendPreference: 'webgpu' };
    const webgpuAdapter = new ThreeRendererAdapter(webgpuCanvas, webgpuConfig);
    try {
      const actual = await webgpuAdapter.init({ width: 800, height: 600, pixelRatio: 1 });
      if (actual !== 'webgpu') {
        webgpuOutcome = { status: 'initialized', actual, adapter };
      } else {
        webgpuAdapter.start();
        try {
          webgpuSamples = await collectBenchmarkSamples(webgpuAdapter, () => webgpuConfig, BENCHMARK_PROTOCOL);
          webgpuOutcome = { status: 'initialized', actual, adapter };
        } catch (error) {
          webgpuOutcome = { status: 'failed', phase: 'sampling', error: errorMessage(error), adapter };
        }
      }
    } catch (error) {
      webgpuOutcome = { status: 'failed', phase: 'initialization', error: errorMessage(error), adapter };
    } finally {
      try {
        webgpuAdapter.dispose();
      } catch {}
    }
  }

  const limitation = webGpuLimitation(webgpuOutcome);
  if (limitation !== null) limitations.push(limitation);

  const allSamples = [...webglSamples];
  if (webgpuSamples.length === BENCHMARK_PROTOCOL.sampleCount) {
    allSamples.push(...webgpuSamples);
  }

  const result = await buildBenchmarkResult({
    environment: env,
    config: DEFAULT_CONFIG,
    samples: allSamples,
    blockedBackends: webgpuSamples.length === BENCHMARK_PROTOCOL.sampleCount ? [] : ['webgpu'],
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
