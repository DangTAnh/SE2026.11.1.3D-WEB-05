import { expect, test } from 'vitest';
import matrix from '../fixtures/vt122-pairwise.json' with { type: 'json' };
import {
  cloneConfig,
  DEFAULT_CONFIG,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { PresetSaveService } from '../../src/presets/resubmission.ts';
import { Vt122Store, type StoreFault } from '../support/vt122-store.ts';

type Prior = 'none' | 'committed-same' | 'committed-different' | 'failed';
type Clock = 'before' | 'exact' | 'after';
type Input = 'valid' | 'invalid-key' | 'invalid-doc';
type Receipt = 'valid' | 'wrong-requestId' | 'wrong-canonical' | 'uncommitted' | 'throw-after-commit';

interface Row {
  readonly id: string;
  readonly prior: Prior;
  readonly clock: Clock;
  readonly input: Input;
  readonly receipt: Receipt;
}

const rows = (matrix as { rows: readonly Row[] }).rows;
const KEY = 'pairwise-key';
const BASE = 1000;
const RETENTION = 1000;

function documentFor(name: string): PresetDocument {
  return {
    schemaVersion: 2,
    app: '3D-WEB-05',
    name,
    config: cloneConfig(DEFAULT_CONFIG),
  };
}

function invalidDocument(): PresetDocument {
  return {
    schemaVersion: 2,
    app: '3D-WEB-05',
    config: { ...cloneConfig(DEFAULT_CONFIG), unknown: true },
  } as unknown as PresetDocument;
}

function makeClock(start = BASE): { now: () => number; set: (value: number) => void } {
  let value = start;
  return { now: () => value, set: next => { value = next; } };
}

function expected(row: Row): {
  reject: boolean;
  calls: number;
  effect: number;
  confirmed: boolean;
} {
  if (row.input === 'invalid-key') return { reject: true, calls: 0, effect: 0, confirmed: false };
  if (row.input === 'invalid-doc') {
    return {
      reject: true,
      calls: 0,
      effect: row.prior === 'none' || row.prior === 'failed' ? 0 : 1,
      confirmed: row.prior === 'committed-same' || row.prior === 'committed-different',
    };
  }
  if (row.prior === 'none') {
    return row.receipt === 'valid'
      ? { reject: false, calls: 1, effect: 1, confirmed: true }
      : { reject: true, calls: 1, effect: 1, confirmed: false };
  }
  if (row.prior === 'failed') {
    return row.receipt === 'valid'
      ? { reject: false, calls: 1, effect: 1, confirmed: true }
      : { reject: true, calls: 1, effect: 1, confirmed: false };
  }
  if (row.prior === 'committed-same') {
    return row.clock === 'before' || row.clock === 'exact'
      ? { reject: false, calls: 0, effect: 1, confirmed: true }
      : { reject: false, calls: 1, effect: 1, confirmed: true };
  }
  return row.clock === 'before' || row.clock === 'exact'
    ? { reject: true, calls: 0, effect: 1, confirmed: true }
    : { reject: true, calls: 1, effect: 1, confirmed: false };
}

for (const row of rows) {
  test(`VT122-T15 pairwise ${row.id} ${row.prior}/${row.clock}/${row.input}/${row.receipt}`, async () => {
    const clock = makeClock();
    const faults: StoreFault[] = [];
    if (row.prior === 'failed') faults.push('throw-before-commit');
    if (row.receipt !== 'valid') faults.push(row.receipt);
    const store = new Vt122Store(faults);
    const saver = new PresetSaveService(store, { retentionMs: RETENTION, now: clock.now });
    const same = documentFor('same');
    const other = documentFor('other');

    if (row.prior === 'committed-same') {
      await saver.save(KEY, same);
    } else if (row.prior === 'committed-different') {
      await saver.save(KEY, other);
    } else if (row.prior === 'failed') {
      await expect(saver.save(KEY, same)).rejects.toThrow('temporary failure');
    }

    if (row.prior !== 'none') {
      const expiresAt = BASE + RETENTION;
      clock.set(row.clock === 'before' ? expiresAt - 1 : row.clock === 'exact' ? expiresAt : expiresAt + 1);
    }

    const before = store.calls.length;
    const input = row.input === 'invalid-doc' ? invalidDocument() : same;
    const requestId = row.input === 'invalid-key' ? '' : KEY;
    let rejected = false;
    try {
      await saver.save(requestId, input);
    } catch {
      rejected = true;
    }

    const want = expected(row);
    expect(rejected).toBe(want.reject);
    expect(store.calls.length - before).toBe(want.calls);
    expect(store.effectCount(KEY)).toBe(want.effect);
    expect(saver.confirmed(KEY) !== undefined).toBe(want.confirmed);
  });
}
