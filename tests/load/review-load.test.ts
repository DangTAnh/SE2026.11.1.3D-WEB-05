/**
 * BT3 / VT-123 load harness: 40 concurrent review tasks, p95 <= 1.5 s.
 *
 * Every task contends for the same preset revision: submit with retry on
 * `stale-version`, then approve the current pending revision with retry. The
 * hasher adds a fixed simulated store round-trip so latency is measurable.
 *
 * Limits (reported with the result): one Node process, in-memory board, no
 * network, database, browser or real accounts. This measures the domain
 * contract under contention, not production capacity.
 */
import { expect, test } from 'vitest';
import { performance } from 'node:perf_hooks';
import { PresetReviewBoard, ReviewError, type ReviewActor } from '../../src/presets/review.ts';
import { DEFAULT_CONFIG, cloneConfig, type PresetDocument } from '../../src/presets/preset.ts';

const WORKERS = 40;
const MAX_ATTEMPTS = 200;
const STORE_LATENCY_MS = 1;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Simulated store round-trip: the async point that opens the race window. */
const storeHash = async (text: string): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, STORE_LATENCY_MS));
  return sha256(text);
};

function documentFor(taskId: number, attempt: number): PresetDocument {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.simulation.particleCount = 1000 + ((taskId + attempt) % 40) * 1000;
  return { schemaVersion: 2, app: '3D-WEB-05', name: `load-${taskId}-${attempt}`, config };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index]!;
}

test('40 concurrent review tasks meet p95 <= 1500 ms', { timeout: 120_000 }, async () => {
  const board = new PresetReviewBoard({ hash: storeHash });
  const editor: ReviewActor = { id: 'load-editor', role: 'editor' };
  const conflicts = new Array<number>(WORKERS).fill(0);
  let operations = 0;

  const runTask = async (taskId: number): Promise<number> => {
    const started = performance.now();
    let submitted = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !submitted; attempt += 1) {
      const baseVersion = board.read()?.version ?? 0;
      try {
        operations += 1;
        await board.submit(editor, documentFor(taskId, attempt), baseVersion);
        submitted = true;
      } catch (error) {
        if (!(error instanceof ReviewError) || error.code !== 'stale-version') throw error;
        conflicts[taskId] = (conflicts[taskId] ?? 0) + 1;
      }
    }
    if (!submitted) throw new Error(`task ${taskId}: submit retries exhausted`);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const current = board.read();
      if (current === null) throw new Error(`task ${taskId}: no revision after submit`);
      if (current.status !== 'pending') break;
      try {
        operations += 1;
        await board.approve({ id: `load-reviewer-${taskId}`, role: 'reviewer' }, current.version, current.contentHash, 'load');
        break;
      } catch (error) {
        if (!(error instanceof ReviewError)) throw error;
        conflicts[taskId] = (conflicts[taskId] ?? 0) + 1;
      }
    }

    return performance.now() - started;
  };

  const latencies = (await Promise.all(
    Array.from({ length: WORKERS }, (_, taskId) => runTask(taskId)),
  )).sort((left, right) => left - right);

  const result = {
    workers: WORKERS,
    operations,
    conflicts: conflicts.reduce((total, count) => total + count, 0),
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.at(-1),
    },
    thresholdMs: 1500,
    storeLatencyMs: STORE_LATENCY_MS,
    finalVersion: board.read()?.version ?? 0,
  };
  process.stdout.write(`VT123_LOAD_RESULT ${JSON.stringify(result)}\n`);

  expect(latencies).toHaveLength(WORKERS);
  expect(result.latencyMs.p95).toBeLessThanOrEqual(1500);
  expect(result.finalVersion).toBeGreaterThanOrEqual(WORKERS);
});
