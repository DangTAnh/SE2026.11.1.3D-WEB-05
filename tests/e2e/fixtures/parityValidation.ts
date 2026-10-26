/**
 * Readback validation for the #50 parity harness.
 *
 * A GPU readback that is empty, truncated or contains `NaN` must fail the
 * parity check. It must never be treated as "zero delta" and reported as a
 * pass, which is what an unvalidated `maxDelta` over an empty array used to do.
 *
 * The harness and the unit tests share these functions so the negative cases
 * exercise the same code that runs against the real GPU.
 */

const STORAGE_BUFFER_ALIGNMENT_BYTES = 16;

export type ReadbackChannel = 'position' | 'velocity' | 'age' | 'seed';

export class ParityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParityValidationError';
  }
}

/** Values a channel must contain for `count` particles (without padding). */
export function expectedReadbackLength(channel: ReadbackChannel, count: number): number {
  if (!Number.isInteger(count) || count <= 0) {
    throw new ParityValidationError(`particle count must be a positive integer, received ${count}`);
  }
  return channel === 'position' || channel === 'velocity' ? count * 3 : count;
}

/**
 * Validate one channel and return only the particle values, excluding the
 * storage-buffer padding. Three aligns storage buffers to 16 bytes, so a
 * readback may be a few elements longer than `expectedLength`; anything beyond
 * that alignment is a corrupt readback, not padding.
 */
export function validateReadback<T extends Float32Array | Uint32Array>(
  name: string,
  array: T,
  expectedLength: number,
): T {
  if (!Number.isInteger(expectedLength) || expectedLength <= 0) {
    throw new ParityValidationError(`${name}: expected length must be a positive integer`);
  }
  if (array.length < expectedLength) {
    throw new ParityValidationError(
      `${name}: readback has ${array.length} values, expected at least ${expectedLength} (empty or truncated buffer)`,
    );
  }

  const expectedBytes = expectedLength * array.BYTES_PER_ELEMENT;
  const paddedBytes = Math.ceil(expectedBytes / STORAGE_BUFFER_ALIGNMENT_BYTES)
    * STORAGE_BUFFER_ALIGNMENT_BYTES;
  const maxLength = paddedBytes / array.BYTES_PER_ELEMENT;
  if (array.length > maxLength) {
    throw new ParityValidationError(
      `${name}: readback has ${array.length} values, expected at most ${maxLength} (including 16-byte padding)`,
    );
  }

  if (array instanceof Float32Array) {
    for (let i = 0; i < array.length; i += 1) {
      if (!Number.isFinite(array[i])) {
        throw new ParityValidationError(`${name}: non-finite value at index ${i}`);
      }
    }
  }

  return array.subarray(0, expectedLength) as T;
}

/** Maximum absolute difference between two validated float channels. */
export function maxDelta(name: string, actual: Float32Array, expected: Float32Array): number {
  if (actual.length !== expected.length) {
    throw new ParityValidationError(
      `${name}: length mismatch (actual ${actual.length}, expected ${expected.length})`,
    );
  }
  if (actual.length === 0) {
    throw new ParityValidationError(`${name}: empty channel cannot prove parity`);
  }

  let max = 0;
  for (let i = 0; i < actual.length; i += 1) {
    const a = actual[i]!;
    const b = expected[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new ParityValidationError(`${name}: non-finite value at index ${i}`);
    }
    const delta = Math.abs(a - b);
    if (delta > max) max = delta;
  }
  return max;
}

/** Seeds are immutable for a particle; a change means the layout is corrupt. */
export function assertSeedsUnchanged(initial: Uint32Array, final: Uint32Array): void {
  if (initial.length !== final.length) {
    throw new ParityValidationError(
      `seeds: length changed from ${initial.length} to ${final.length}`,
    );
  }
  for (let i = 0; i < initial.length; i += 1) {
    if (initial[i] !== final[i]) {
      throw new ParityValidationError(`seeds: value changed at index ${i}`);
    }
  }
}
