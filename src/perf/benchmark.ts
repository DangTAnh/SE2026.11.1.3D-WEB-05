/**
 * Two-backend benchmark runner (TV5).
 *
 * One protocol constant drives both backends, and a result is refused when it
 * cannot prove its environment or configuration. Samples carry `actual` only;
 * a requested preference never reaches a benchmark row (INV-1).
 */
import { aggregateByBackend } from '../core/measurement/aggregate.ts';
import { configHash } from '../core/measurement/configHash.ts';
import type { BenchmarkBackend, BenchmarkEnvironment, BenchmarkResult } from '../core/measurement/result.ts';
import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { ActualBackend } from '../core/types/backend.ts';
import type { PerformanceSnapshot } from '../core/types/measurement.ts';
import { parsePreset, serializePreset, type LabConfig } from '../presets/preset.ts';
import { PerformanceCollector } from './collector.ts';

/** Fixed by the team in issue #18; identical for WebGPU and WebGL2. */
export const BENCHMARK_PROTOCOL = {
  warmUpMs: 3000,
  cadenceMs: 100,
  sampleCount: 100,
  durationSeconds: 10,
  statistic: 'median',
} as const;

export interface WebGpuAdapterIdentity {
  readonly vendor: string;
  readonly architecture: string;
}

/**
 * What a WebGPU attempt observed. A missing adapter is an environment fact; a
 * failed probe, initialization or sampling is a runner failure. Reporting the
 * second kind as absent hardware would blame the machine for our bug.
 */
export type WebGpuBenchmarkOutcome =
  | { readonly status: 'api-unavailable' }
  | { readonly status: 'adapter-unavailable' }
  | {
      readonly status: 'failed';
      readonly phase: 'adapter probe' | 'initialization' | 'sampling';
      readonly error: string;
      readonly adapter: WebGpuAdapterIdentity | null;
    }
  | {
      readonly status: 'initialized';
      readonly actual: ActualBackend;
      readonly adapter: WebGpuAdapterIdentity;
    };

const REQUIRED_ENVIRONMENT_FIELDS = [
  'browser',
  'browserVersion',
  'os',
  'gpu',
  'driver',
  'commit',
] as const;

function adapterSuffix(adapter: WebGpuAdapterIdentity | null): string {
  if (adapter === null) return '';
  const known = [adapter.vendor, adapter.architecture].filter((part) => part.trim() !== '');
  return known.length === 0
    ? ''
    : ` (adapter vendor "${adapter.vendor}", architecture "${adapter.architecture}")`;
}

/** Limitation line for a WebGPU attempt, or null when WebGPU actually ran. */
export function webGpuLimitation(outcome: WebGpuBenchmarkOutcome): string | null {
  switch (outcome.status) {
    case 'api-unavailable':
      return (
        'WebGPU API is not exposed in this browser context (navigator.gpu is undefined); ' +
        'physical WebGPU execution is BLOCKED.'
      );
    case 'adapter-unavailable':
      return (
        'navigator.gpu.requestAdapter() returned null; no WebGPU adapter was available to this run. ' +
        'Physical WebGPU execution is BLOCKED.'
      );
    case 'failed':
      return (
        `WebGPU ${outcome.phase} failed${adapterSuffix(outcome.adapter)}: ${outcome.error}. ` +
        'No WebGPU row was recorded; a runner failure does not prove the adapter is unavailable.'
      );
    case 'initialized':
      if (outcome.actual === 'webgpu') return null;
      return (
        `WebGPU initialization reported actual="${outcome.actual}"${adapterSuffix(outcome.adapter)} ` +
        'even though requestAdapter() returned an adapter; no WebGPU row was recorded.'
      );
  }
}

export interface BenchmarkInput {
  readonly environment: BenchmarkEnvironment;
  readonly config: Readonly<LabConfig>;
  readonly samples: readonly PerformanceSnapshot[];
  readonly blockedBackends?: readonly BenchmarkBackend[];
  readonly limitations?: readonly string[];
}

/**
 * Turns a finished run into the artefact `docs/06-benchmark/README.md` requires.
 *
 * Throws instead of rendering blanks when the environment is incomplete, there
 * are no samples, samples from another configuration were mixed in, or a
 * backend group does not contain the fixed sample count. The last rule keeps a
 * partial run from being labelled with the 100-sample protocol.
 */
export async function buildBenchmarkResult(input: BenchmarkInput): Promise<BenchmarkResult> {
  for (const field of REQUIRED_ENVIRONMENT_FIELDS) {
    const value = input.environment[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`buildBenchmarkResult: environment.${field} is required`);
    }
  }
  if (input.samples.length === 0) {
    throw new TypeError('buildBenchmarkResult: at least one sample is required');
  }

  const config = parsePreset(serializePreset(input.config));
  const hash = await configHash(config);
  for (const sample of input.samples) {
    if (sample.configHash !== hash) {
      throw new TypeError('buildBenchmarkResult: every sample must belong to the reported configuration');
    }
  }

  const groups = aggregateByBackend(input.samples);
  const partial = groups.filter((group) => group.count !== BENCHMARK_PROTOCOL.sampleCount);
  if (partial.length > 0) {
    const detail = partial.map((group) => `${group.actual}=${group.count}`).join(', ');
    throw new TypeError(
      `buildBenchmarkResult: every backend group needs exactly ${BENCHMARK_PROTOCOL.sampleCount} samples (${detail})`,
    );
  }

  const blockedBackends = input.blockedBackends ?? [];
  for (const backend of blockedBackends) {
    if (groups.some((group) => group.actual === backend)) {
      throw new TypeError(`buildBenchmarkResult: backend "${backend}" cannot be both measured and blocked`);
    }
  }
  if (blockedBackends.length > 0 && (input.limitations ?? []).length === 0) {
    throw new TypeError('buildBenchmarkResult: a blocked backend needs a stated limitation');
  }

  return {
    environment: input.environment,
    config,
    configHash: hash,
    protocol: {
      warmUpSeconds: BENCHMARK_PROTOCOL.warmUpMs / 1000,
      sampleCount: BENCHMARK_PROTOCOL.sampleCount,
      durationSeconds: BENCHMARK_PROTOCOL.durationSeconds,
    },
    groups,
    blockedBackends,
    limitations: input.limitations ?? [],
  };
}

export interface BenchmarkRunProtocol {
  readonly warmUpMs: number;
  readonly cadenceMs: number;
  readonly sampleCount: number;
}

/**
 * Samples one backend with the fixed protocol and resolves once the run has
 * exactly `sampleCount` samples. The port stays owned by the caller and is not
 * disposed here. Tests pass a smaller protocol; production uses the default.
 */
export function collectBenchmarkSamples(
  port: RendererPort,
  getConfig: () => Readonly<LabConfig>,
  protocol: BenchmarkRunProtocol = BENCHMARK_PROTOCOL,
): Promise<PerformanceSnapshot[]> {
  return new Promise((resolve, reject) => {
    // Stable serialization validates and pins all fields, including hash exclusions.
    const pinnedPreset = serializePreset(getConfig());
    const checkedConfig = (): Readonly<LabConfig> => {
      const config = getConfig();
      if (serializePreset(config) !== pinnedPreset) {
        throw new TypeError('collectBenchmarkSamples: full preset changed during the run');
      }
      return parsePreset(pinnedPreset);
    };
    const samples: PerformanceSnapshot[] = [];
    const collector = new PerformanceCollector(port, {
      warmUpMs: protocol.warmUpMs,
      cadenceMs: protocol.cadenceMs,
      getConfig: checkedConfig,
      onSample: (sample) => {
        checkedConfig(); // Also check after the asynchronous hash/status capture.
        samples.push(sample);
        if (samples.length >= protocol.sampleCount) {
          collector.dispose();
          resolve(samples);
        }
      },
      onError: (error) => {
        collector.dispose();
        reject(error);
      },
    });
    collector.start();
  });
}
