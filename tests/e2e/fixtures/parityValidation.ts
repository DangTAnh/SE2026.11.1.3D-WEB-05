/**
 * Readback validation for the #50 parity harness.
 *
 * A GPU readback that is empty, truncated or contains `NaN` must fail the
 * parity check. It must never be treated as "zero delta" and reported as a
 * pass, which is what an unvalidated `maxDelta` over an empty array used to do.
 *
 * The harness and the unit tests share these functions so the negative cases
 * exercise the same code that runs against the real GPU.
 *
 * WebGL2 storage buffers keep vec3 packed (itemSize 3). WebGPU/WGSL does not
 * support packed vec3 in storage buffers: Three pads each particle to vec4 and
 * updates `itemSize` to 4, so a valid WebGPU readback is interleaved
 * `x, y, z, padding`. The validator takes the actual attribute stride and
 * unpacks xyz before comparing with the CPU reference.
 */

const STORAGE_BUFFER_ALIGNMENT_BYTES = 16;

export class ParityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParityValidationError';
  }
}

function validateLayout(
  name: string,
  array: Float32Array | Uint32Array,
  count: number,
  itemSize: number,
  components: number,
): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new ParityValidationError(`${name}: particle count must be a positive integer`);
  }
  if (!Number.isInteger(itemSize) || itemSize < components) {
    throw new ParityValidationError(
      `${name}: itemSize ${itemSize} cannot hold ${components} components`,
    );
  }
  if (components === 3 && itemSize !== 3 && itemSize !== 4) {
    throw new ParityValidationError(`${name}: vec3 itemSize must be 3 (packed) or 4 (stride-4), received ${itemSize}`);
  }
  if (components === 1 && itemSize !== 1) {
    throw new ParityValidationError(`${name}: scalar itemSize must be 1, received ${itemSize}`);
  }

  const expectedLength = count * itemSize;
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
}

function assertFinite(name: string, value: number, index: number): void {
  if (!Number.isFinite(value)) {
    throw new ParityValidationError(`${name}: non-finite value at index ${index}`);
  }
}

/**
 * Validate a vec3 channel and unpack `x, y, z` from the backend stride.
 * `itemSize` is 3 for packed WebGL2 and 4 for WebGPU's vec4 padding.
 */
export function validateVec3Readback(
  name: string,
  array: Float32Array,
  count: number,
  itemSize: number,
): Float32Array {
  validateLayout(name, array, count, itemSize, 3);

  const packed = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const source = i * itemSize;
    const target = i * 3;
    for (let component = 0; component < 3; component += 1) {
      const value = array[source + component]!;
      assertFinite(name, value, source + component);
      packed[target + component] = value;
    }
  }
  return packed;
}

/** Validate a scalar channel (age or seed) and return only the particle values. */
export function validateScalarReadback<T extends Float32Array | Uint32Array>(
  name: string,
  array: T,
  count: number,
): T {
  validateLayout(name, array, count, 1, 1);

  if (array instanceof Float32Array) {
    for (let i = 0; i < count; i += 1) {
      assertFinite(name, array[i]!, i);
    }
  }
  return array.subarray(0, count) as T;
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
