/**
 * Two-backend benchmark runner (TV5).
 *
 * One protocol constant drives both backends, and a result is refused when it
 * cannot prove its environment or configuration. Samples carry `actual` only;
 * a requested preference never reaches a benchmark row (INV-1).
 */
import { aggregateByBackend } from '../core/measurement/aggregate.ts';
import { configHash } from '../core/measurement/configHash.ts';
import type { BenchmarkEnvironment, BenchmarkResult } from '../core/measurement/result.ts';
import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { PerformanceSnapshot } from '../core/types/measurement.ts';
import type { LabConfig } from '../presets/preset.ts';
import { PerformanceCollector } from './collector.ts';

/** Fixed by the team in issue #18; identical for WebGPU and WebGL2. */
export const BENCHMARK_PROTOCOL = {
  warmUpMs: 3000,
  cadenceMs: 100,
  sampleCount: 100,
  durationSeconds: 10,
  statistic: 'median',
} as const;

const REQUIRED_ENVIRONMENT_FIELDS = [
  'browser',
  'browserVersion',
  'os',
  'gpu',
  'driver',
  'commit',
] as const;

export interface BenchmarkInput {
  readonly environment: BenchmarkEnvironment;
  readonly config: Readonly<LabConfig>;
  readonly samples: readonly PerformanceSnapshot[];
  readonly limitations?: readonly string[];
}

/**
 * Turns a finished run into the artefact `docs/06-benchmark/README.md` requires.
 *
 * Throws instead of rendering blanks when the environment is incomplete, there
 * are no samples, or samples from another configuration were mixed in.
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

  const hash = await configHash(input.config);
  for (const sample of input.samples) {
    if (sample.configHash !== hash) {
      throw new TypeError('buildBenchmarkResult: every sample must belong to the reported configuration');
    }
  }

  return {
    environment: input.environment,
    config: input.config,
    configHash: hash,
    protocol: {
      warmUpSeconds: BENCHMARK_PROTOCOL.warmUpMs / 1000,
      sampleCount: BENCHMARK_PROTOCOL.sampleCount,
      durationSeconds: BENCHMARK_PROTOCOL.durationSeconds,
    },
    groups: aggregateByBackend(input.samples),
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
    const samples: PerformanceSnapshot[] = [];
    const collector = new PerformanceCollector(port, {
      warmUpMs: protocol.warmUpMs,
      cadenceMs: protocol.cadenceMs,
      getConfig,
      onSample: (sample) => {
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
