/**
 * BT3 / VT-123 — 40-task load harness (T15 / NFR1).
 *
 * The harness runs 40 review workflows against one board. Each task submits a
 * document with compare-and-swap retry, then approves the current pending
 * revision; a conflict means "read again and retry", never a silent overwrite.
 * A 1 ms delay inside the hasher simulates the store round-trip.
 *
 * p95 rule (stated once in spec.md §4 NFR1): nearest-rank over the 40 sorted
 * latencies, ceil(0.95 × 40) = 38th value, index 37 (zero-based).
 */
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import {
  PresetReviewBoard,
  ReviewError,
  type ContentHasher,
  type ReviewActor,
} from '../../src/presets/review.ts';
import {
  DEFAULT_CONFIG,
  cloneConfig,
  serializePresetDocument,
  type PresetDocument,
} from '../../src/presets/preset.ts';

const TASKS = 40;
const MAX_ATTEMPTS = 200;
const STORE_DELAY_MS = 1;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const slowSha256: ContentHasher = async (canonical) => {
  await sleep(STORE_DELAY_MS);
  return createHash('sha256').update(canonical).digest('hex');
};

function documentFor(task: number, attempt: number): PresetDocument {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.simulation.particleCount = 1000 + ((task * 7919 + attempt * 104729) % 499000);
  return { schemaVersion: 2, app: '3D-WEB-05', name: `load-${task}-${attempt}`, config };
}

function isConflict(error: unknown): boolean {
  if (!(error instanceof ReviewError)) return false;
  return error.code === 'stale-version'
    || error.code === 'content-changed'
    || error.code === 'not-reviewable';
}

/** One workflow task. Returns its end-to-end latency in milliseconds. */
async function runTask(
  board: PresetReviewBoard,
  task: number,
  committedVersions: number[],
): Promise<number> {
  const started = performance.now();
  const editor: ReviewActor = { id: `editor-${task}`, role: 'editor' };
  const reviewer: ReviewActor = { id: `reviewer-${task}`, role: 'reviewer' };

  let submitted = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !submitted; attempt += 1) {
    const baseVersion = board.read()?.version ?? 0;
    try {
      const revision = await board.submit(editor, documentFor(task, attempt), baseVersion);
      committedVersions.push(revision.version);
      submitted = true;
    } catch (error) {
      if (!isConflict(error)) throw error;
      await sleep(STORE_DELAY_MS);
    }
  }
  if (!submitted) throw new Error(`task ${task}: submission attempts exhausted`);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = board.read();
    if (current !== null && current.status === 'pending') {
      try {
        await board.approve(reviewer, current.version, current.contentHash, `note-${task}`);
        return performance.now() - started;
      } catch (error) {
        if (!isConflict(error)) throw error;
        await sleep(STORE_DELAY_MS);
        continue;
      }
    }
    // The board is already approved; submit again so there is something to review.
    try {
      const revision = await board.submit(
        editor,
        documentFor(task, 1000 + attempt),
        current?.version ?? 0,
      );
      committedVersions.push(revision.version);
    } catch (error) {
      if (!isConflict(error)) throw error;
      await sleep(STORE_DELAY_MS);
    }
  }
  throw new Error(`task ${task}: approval attempts exhausted`);
}

/** Nearest-rank percentile; index 0 for an empty sample is a programming error. */
function nearestRank(samples: readonly number[], percentile: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1]!;
}

test('[T15] 40 concurrent review tasks meet the p95 budget with no lost updates', async () => {
  const board = new PresetReviewBoard({ hash: slowSha256 });
  const committedVersions: number[] = [];
  const wallStarted = performance.now();

  const latencies = await Promise.all(
    Array.from({ length: TASKS }, (_, task) => runTask(board, task, committedVersions)),
  );

  const wallMs = performance.now() - wallStarted;
  const p50 = nearestRank(latencies, 0.5);
  const p95 = nearestRank(latencies, 0.95);
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);
  const final = board.read()!;
  const finalVersion = final.version;
  const canonical = serializePresetDocument(final.document as PresetDocument);
  const expectedHash = createHash('sha256').update(canonical).digest('hex');

  const result = {
    tasks: latencies.length,
    p50Ms: Number(p50.toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    maxMs: Number(max.toFixed(3)),
    minMs: Number(min.toFixed(3)),
    wallMs: Number(wallMs.toFixed(3)),
    finalVersion,
    committedSubmissions: committedVersions.length,
  };
  // The assignment asks for the measured number in the evidence log.
  console.log(`VT123_LOAD_RESULT ${JSON.stringify(result)}`);

  expect(latencies).toHaveLength(TASKS);
  expect(finalVersion).toBeGreaterThanOrEqual(TASKS);

  // No revision was skipped or overwritten: successful submissions form 1..N.
  const versions = [...committedVersions].sort((left, right) => left - right);
  expect(versions).toEqual(Array.from({ length: finalVersion }, (_, index) => index + 1));

  // The last committed revision is internally consistent.
  expect(['pending', 'approved', 'rejected']).toContain(final.status);
  expect(final.contentHash).toBe(expectedHash);
  if (final.status === 'pending') {
    expect(final.reviewedBy).toBeNull();
  } else {
    expect(final.reviewedBy).not.toBeNull();
  }

  expect(p95).toBeLessThanOrEqual(1500);
});
