import { writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { importPresetBatch } from '../../src/presets/batchImport.ts';
import { vt124Document } from '../support/vt124-presets.ts';

test('VT124-T18 120 simultaneous batch tasks preserve data with p95 <=3500ms', async () => {
  const errorsAt = [3, 7, 11, 15, 19];
  const inputs = Array.from({ length: 120 }, (_, task) =>
    Array.from({ length: 20 }, (_, record) => errorsAt.includes(record) ? '{bad'
      : JSON.stringify(vt124Document(`task-${task}-record-${record}`, record % 2 ? 'vortex' : 'attractor'))));
  let release!: () => void;
  let submittedAt = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const tasks = inputs.map(async (batch, task) => {
    await barrier;
    // Include the initial queue, not a private clock started when this task runs.
    try {
      const result = importPresetBatch(batch);
      expect(result.state).toBe('MIXED');
      expect(result.acceptedCount).toBe(15);
      expect(result.rejectedCount).toBe(5);
      expect(result.items).toHaveLength(20);
      result.items.forEach((item, record) => {
        expect(item.index).toBe(record);
        expect(item.status).toBe(errorsAt.includes(record) ? 'rejected' : 'accepted');
        if (item.status === 'accepted') {
          expect(item.document.name).toBe(`task-${task}-record-${record}`);
          expect(item.document.config.mode).toBe(record % 2 ? 'vortex' : 'attractor');
        }
      });
      return { task, latencyMs: performance.now() - submittedAt, ok: true, error: null };
    } catch (error) {
      // Preserve every failed task and its latency before asserting the campaign.
      return { task, latencyMs: performance.now() - submittedAt, ok: false, error: String(error) };
    }
  });
  submittedAt = performance.now();
  release();
  const raw = await Promise.all(tasks);
  const sorted = raw.map(row => row.latencyMs).sort((a, b) => a - b);
  const result = {
    tasks: 120, recordsPerTask: 20, validPerTask: 15, invalidPerTask: 5,
    errors: raw.filter(row => !row.ok).length,
    p95Ms: sorted[113], maxMs: sorted.at(-1), targetMs: 3500,
    scope: 'one Node process,120 promises,20 independent JSON texts each; common-release queue + parsing + verification; no HTTP/DB/GPU or real-user capacity claim',
    inputPreparationIncluded: false, node: process.version, utc: new Date().toISOString(), raw,
  };
  if (process.env.VT124_LOAD_RESULT) {
    writeFileSync(process.env.VT124_LOAD_RESULT, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify({ ...result, raw: undefined }));
  expect(raw).toHaveLength(120);
  expect(result.errors).toBe(0);
  expect(result.p95Ms).toBeLessThanOrEqual(3500);
});
