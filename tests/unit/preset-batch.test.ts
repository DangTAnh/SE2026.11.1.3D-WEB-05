import { expect, test } from 'vitest';
import { importPresetBatch } from '../../src/presets/batchImport.ts';
import { DEFAULT_CONFIG, cloneConfig } from '../../src/presets/preset.ts';
import { vt124Document } from '../support/vt124-presets.ts';

const valid = JSON.stringify(vt124Document());
const invalid = '{broken';

test('VT124-T01 accepts a complete v2 document', () => {
  const result = importPresetBatch([valid]);
  expect(result).toEqual({ state: 'VALID_ONLY', acceptedCount: 1, rejectedCount: 0,
    items: [{ index: 0, status: 'accepted', document: vt124Document() }] });
});

test('VT124-T02/T03 valid-error-valid preserves both documents and the rejected position', () => {
  const after = vt124Document('after error', 'vortex');
  const result = importPresetBatch([valid, invalid, JSON.stringify(after)]);
  expect(result.state).toBe('MIXED');
  expect(result.acceptedCount).toBe(2);
  expect(result.rejectedCount).toBe(1);
  expect(result.items).toEqual([
    { index: 0, status: 'accepted', document: vt124Document() },
    { index: 1, status: 'rejected', reason: expect.any(String) },
    { index: 2, status: 'accepted', document: after },
  ]);
  const failure = result.items[1];
  expect(failure?.status === 'rejected' && failure.reason.length > 0).toBe(true);
});

test.each([
  { id: 'T04', records: [invalid, valid], states: ['ERROR_ONLY', 'MIXED'], outcomes: ['rejected', 'accepted'] },
  { id: 'T05', records: [valid, invalid], states: ['VALID_ONLY', 'MIXED'], outcomes: ['accepted', 'rejected'] },
  { id: 'T06', records: [invalid, invalid, valid], states: ['ERROR_ONLY', 'ERROR_ONLY', 'MIXED'], outcomes: ['rejected', 'rejected', 'accepted'] },
  { id: 'T07', records: [invalid, invalid], states: ['ERROR_ONLY', 'ERROR_ONLY'], outcomes: ['rejected', 'rejected'] },
  { id: 'T19', records: [valid, valid, invalid, valid, invalid], states: ['VALID_ONLY', 'VALID_ONLY', 'MIXED', 'MIXED', 'MIXED'], outcomes: ['accepted', 'accepted', 'rejected', 'accepted', 'rejected'] },
])('VT124-$id report follows valid/error state transitions', ({ records, states, outcomes }) => {
  for (let length = 1; length <= records.length; length++) {
    const result = importPresetBatch(records.slice(0, length));
    expect(result.state).toBe(states[length - 1]);
    expect(result.items.map(item => item.status)).toEqual(outcomes.slice(0, length));
    expect(result.items.map(item => item.index)).toEqual(Array.from({ length }, (_, index) => index));
    expect(result.acceptedCount + result.rejectedCount).toBe(length);
  }
});

test('VT124-T08 empty/new calls do not inherit a previous report', () => {
  importPresetBatch([valid, invalid]);
  expect(importPresetBatch([])).toEqual({ state: 'EMPTY', acceptedCount: 0, rejectedCount: 0, items: [] });
  expect(importPresetBatch([valid]).state).toBe('VALID_ONLY');
});

test('VT124-T12 non-string runtime records fail independently', () => {
  const records: unknown[] = [null, undefined, 4, {}, ['text'], true, valid];
  const result = importPresetBatch(records);
  expect(result.items.map(item => item.status)).toEqual([
    'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'accepted',
  ]);
  expect(result.acceptedCount).toBe(1);
  expect(result.rejectedCount).toBe(6);
});

test('VT124-T20 sparse array slots still receive indexed outcomes', () => {
  const records = new Array<unknown>(3);
  records[1] = valid;
  const result = importPresetBatch(records);
  expect(result.items.map(item => [item.index, item.status])).toEqual([
    [0, 'rejected'], [1, 'accepted'], [2, 'rejected'],
  ]);
  expect(result.acceptedCount).toBe(1);
  expect(result.rejectedCount).toBe(2);
});

test('VT124-T13 results and repeated accepted documents are isolated', () => {
  const defaultsBefore = cloneConfig(DEFAULT_CONFIG);
  const inputs = Object.freeze([valid, valid]);
  const first = importPresetBatch(inputs);
  const second = importPresetBatch(inputs);
  const item = first.items[0];
  if (item?.status !== 'accepted') throw new Error('expected first accepted document');
  item.document.config.camera.distance = 400;
  item.document.name = 'changed result';
  expect(first.items[1]).toEqual({ index: 1, status: 'accepted', document: vt124Document() });
  expect(second.items[0]).toEqual({ index: 0, status: 'accepted', document: vt124Document() });
  expect(inputs).toEqual([valid, valid]);
  expect(DEFAULT_CONFIG).toEqual(defaultsBefore);
});

test('VT124-T14 duplicate documents are retained in order', () => {
  const result = importPresetBatch([valid, valid]);
  expect(result.acceptedCount).toBe(2);
  expect(result.rejectedCount).toBe(0);
  expect(result.items.map(item => item.index)).toEqual([0, 1]);
});

test('VT124-T15 record-count boundary is inclusive', () => {
  expect(importPresetBatch(Array(100).fill(valid)).acceptedCount).toBe(100);
  expect(() => importPresetBatch(Array(101).fill(valid))).toThrow(RangeError);
});

test('VT124-T15 UTF-8 byte boundary is inclusive and checked before parsing', () => {
  const size = new TextEncoder().encode(valid).byteLength;
  const padded = valid + ' '.repeat(1_000_000 - size);
  expect(importPresetBatch([padded]).acceptedCount).toBe(1);
  expect(() => importPresetBatch([padded + ' '])).toThrow(RangeError);
  // Below one million JS characters, but above the UTF-8 byte limit.
  expect(() => importPresetBatch(['é'.repeat(500_001)])).toThrow(RangeError);
});

test.each([null, undefined, {}, '[]'])('VT124-T21 non-array envelope rejects (%s)', input => {
  expect(() => importPresetBatch(input as never)).toThrow(TypeError);
});

