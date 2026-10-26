/**
 * Negative coverage for the #50 readback validator.
 *
 * The real harness used to report parity when `getArrayBufferAsync` returned an
 * empty buffer, because `maxDelta` looped over the GPU array length and
 * initialized the maximum to zero. These tests pin the rejection rules the
 * fixture now applies before it computes any delta.
 *
 * They also pin the backend layouts: WebGL2 keeps vec3 storage packed
 * (`itemSize` 3) while Three pads vec3 to vec4 per particle on WebGPU
 * (`itemSize` 4), so the readback is interleaved `x, y, z, padding`.
 */
import { expect, test } from 'vitest';
import {
  assertSeedsUnchanged,
  maxDelta,
  validateScalarReadback,
  validateVec3Readback,
} from '../e2e/fixtures/parityValidation.ts';

test('validateVec3Readback: packed WebGL2 vec3 (itemSize 3) is returned unchanged', () => {
  const packed = new Float32Array([1, 2, 3, 4, 5, 6]);
  expect(Array.from(validateVec3Readback('positions', packed, 2, 3))).toEqual([1, 2, 3, 4, 5, 6]);
});

test('validateVec3Readback: stride-4 WebGPU vec3 unpacks xyz per particle and drops the padding', () => {
  // Two particles: [x, y, z, pad] per particle.
  const padded = new Float32Array([1, 2, 3, 0, 4, 5, 6, 0]);
  expect(Array.from(validateVec3Readback('positions', padded, 2, 4))).toEqual([1, 2, 3, 4, 5, 6]);

  // Padding content is deliberately garbage; only xyz is part of parity.
  const dirtyPadding = new Float32Array([1, 2, 3, 999, 4, 5, 6, -999]);
  expect(Array.from(validateVec3Readback('velocities', dirtyPadding, 2, 4))).toEqual([1, 2, 3, 4, 5, 6]);
});

test('validateVec3Readback: malformed strides are rejected', () => {
  const values = new Float32Array(32);
  expect(() => validateVec3Readback('positions', values, 8, 2)).toThrow(/itemSize 2 cannot hold 3 components/);
  expect(() => validateVec3Readback('positions', values, 8, 5)).toThrow(/must be 3 \(packed\) or 4/);
  expect(() => validateVec3Readback('positions', values, 8, 3.5)).toThrow(/cannot hold 3 components/);
});

test('validateVec3Readback: empty and truncated buffers are rejected for both strides', () => {
  expect(() => validateVec3Readback('positions', new Float32Array(0), 8, 3)).toThrow(/empty or truncated/);
  expect(() => validateVec3Readback('positions', new Float32Array(23), 8, 3)).toThrow(/empty or truncated/);
  expect(() => validateVec3Readback('positions', new Float32Array(0), 8, 4)).toThrow(/empty or truncated/);
  // count=8 at stride 4 needs 32 floats; 31 is a truncated readback, not padding.
  expect(() => validateVec3Readback('positions', new Float32Array(31), 8, 4)).toThrow(/empty or truncated/);
});

test('validateVec3Readback: over-long buffers are rejected including 16-byte padding', () => {
  // count=1 at stride 3 is 12 bytes, aligned to 16 bytes (4 values).
  expect(() => validateVec3Readback('positions', new Float32Array(5), 1, 3)).toThrow(/including 16-byte padding/);
  // count=3 at stride 4 is 48 bytes, already 16-byte aligned.
  expect(() => validateVec3Readback('positions', new Float32Array(13), 3, 4)).toThrow(/including 16-byte padding/);
});

test('validateVec3Readback: NaN and Infinity are rejected at the backend stride', () => {
  expect(() => validateVec3Readback('positions', new Float32Array([Number.NaN, 2, 3]), 1, 3)).toThrow(/non-finite/);
  expect(() => validateVec3Readback('positions', new Float32Array([Number.POSITIVE_INFINITY, 2, 3, 0]), 1, 4))
    .toThrow(/non-finite/);
  expect(() => validateVec3Readback('positions', new Float32Array([1, 2, 3, 0, 4, Number.NaN, 6, 0]), 2, 4))
    .toThrow(/non-finite/);
});

test('validateScalarReadback: particle values are returned without tail padding', () => {
  expect(Array.from(validateScalarReadback('ages', new Float32Array([1, 2, 3]), 3))).toEqual([1, 2, 3]);

  // One float is 4 bytes; the storage buffer may be aligned to 16 bytes.
  const padded = new Float32Array([1, 0, 0, 0]);
  const ages = validateScalarReadback('ages', padded, 1);
  expect(ages.length).toBe(1);
  expect(ages[0]).toBe(1);

  const seeds = validateScalarReadback('seeds', new Uint32Array([7, 8]), 2);
  expect(Array.from(seeds)).toEqual([7, 8]);
});

test('validateScalarReadback: empty, truncated and non-finite buffers are rejected', () => {
  expect(() => validateScalarReadback('ages', new Float32Array(0), 3)).toThrow(/empty or truncated/);
  expect(() => validateScalarReadback('ages', new Float32Array(2), 3)).toThrow(/empty or truncated/);
  expect(() => validateScalarReadback('ages', new Float32Array([Number.NaN]), 1)).toThrow(/non-finite/);
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
