/**
 * Negative coverage for the #50 readback validator.
 *
 * The real harness used to report parity when `getArrayBufferAsync` returned an
 * empty buffer, because `maxDelta` looped over the GPU array length and
 * initialized the maximum to zero. These tests pin the rejection rules the
 * fixture now applies before it computes any delta.
 */
import { expect, test } from 'vitest';
import {
  assertSeedsUnchanged,
  expectedReadbackLength,
  maxDelta,
  ParityValidationError,
  validateReadback,
} from '../e2e/fixtures/parityValidation.ts';

test('expectedReadbackLength: vec3 channels are three values per particle', () => {
  expect(expectedReadbackLength('position', 8)).toBe(24);
  expect(expectedReadbackLength('velocity', 8)).toBe(24);
  expect(expectedReadbackLength('age', 8)).toBe(8);
  expect(expectedReadbackLength('seed', 8)).toBe(8);
  expect(() => expectedReadbackLength('age', 0)).toThrow(ParityValidationError);
  expect(() => expectedReadbackLength('age', -1)).toThrow(ParityValidationError);
  expect(() => expectedReadbackLength('age', 1.5)).toThrow(ParityValidationError);
});

test('validateReadback: exact and 16-byte-padded buffers are accepted without padding values', () => {
  const exact = new Float32Array([1, 2, 3]);
  expect(Array.from(validateReadback('positions', exact, 3))).toEqual([1, 2, 3]);

  // One float is 4 bytes; Three aligns the storage buffer to 16 bytes.
  const padded = new Float32Array([1, 0, 0, 0]);
  const values = validateReadback('ages', padded, 1);
  expect(values.length).toBe(1);
  expect(values[0]).toBe(1);
});

test('validateReadback: empty, truncated and over-long buffers are rejected', () => {
  expect(() => validateReadback('positions', new Float32Array(0), 3)).toThrow(/empty or truncated/);
  expect(() => validateReadback('positions', new Float32Array(2), 3)).toThrow(/empty or truncated/);

  // 3 floats are 12 bytes, padded to 16 bytes (4 values). A fifth value is
  // corruption, not padding.
  expect(() => validateReadback('positions', new Float32Array(5), 3)).toThrow(/including 16-byte padding/);
});

test('validateReadback: NaN and Infinity are rejected', () => {
  expect(() => validateReadback('positions', new Float32Array([Number.NaN]), 1)).toThrow(/non-finite/);
  expect(() => validateReadback('positions', new Float32Array([Number.POSITIVE_INFINITY]), 1)).toThrow(/non-finite/);
});

test('maxDelta: reports the largest absolute difference', () => {
  expect(maxDelta('positions', new Float32Array([1, 2, 3]), new Float32Array([1, 2.5, 2.6]))).toBe(0.5);
  expect(maxDelta('positions', new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]))).toBe(0);
});

test('maxDelta: empty, mismatched and non-finite channels are rejected', () => {
  expect(() => maxDelta('positions', new Float32Array(0), new Float32Array(0))).toThrow(/empty/);
  expect(() => maxDelta('positions', new Float32Array(3), new Float32Array(2))).toThrow(/length mismatch/);
  expect(() => maxDelta('positions', new Float32Array([Number.NaN]), new Float32Array([0]))).toThrow(/non-finite/);
});

test('assertSeedsUnchanged: detects a mutated seed and a changed length', () => {
  const seeds = new Uint32Array([1, 2, 3]);
  expect(() => assertSeedsUnchanged(seeds, new Uint32Array([1, 2, 3]))).not.toThrow();
  expect(() => assertSeedsUnchanged(seeds, new Uint32Array([1, 2, 4]))).toThrow(/changed at index 2/);
  expect(() => assertSeedsUnchanged(seeds, new Uint32Array([1, 2]))).toThrow(/length changed/);
});
