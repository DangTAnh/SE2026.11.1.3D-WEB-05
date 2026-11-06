import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebGPURenderer } from 'three/webgpu';
// @ts-expect-error The pinned @types package does not declare this runtime class.
import WebGPUTimestampQueryPool from 'three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js';
// @ts-expect-error The pinned @types package does not declare this runtime class.
import WebGLTimestampQueryPool from 'three/src/renderers/webgl-fallback/utils/WebGLTimestampQueryPool.js';
import { resolveFreshComputeTime } from '../../src/simulations/backend/gpuTiming.ts';

interface Pool {
  lastValue: number;
  pendingResolve: unknown;
  frames: number[];
  getTimestampFrames(): number[];
  resolveQueriesAsync(): Promise<number>;
}

function rendererFor(pool?: Pool): WebGPURenderer {
  return {
    backend: { timestampQueryPool: { compute: pool } },
    resolveTimestampsAsync: vi.fn(() => pool!.resolveQueriesAsync()),
  } as unknown as WebGPURenderer;
}

function stubPool(): Pool {
  return {
    lastValue: 3.25, pendingResolve: false, frames: [10],
    getTimestampFrames() { return this.frames; },
    async resolveQueriesAsync() { this.frames = [20]; this.lastValue = 3.25; return this.lastValue; },
  };
}

describe('fresh compute timestamps with pinned Three query pools', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects the actual WebGPU error fallback instead of renewing lastValue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool: Pool = Object.assign(Object.create(WebGPUTimestampQueryPool.prototype), {
      trackTimestamp: true, currentQueryIndex: 2, isDisposed: false,
      pendingResolve: null, lastValue: 3.25, frames: [10], queryOffsets: new Map(),
      resultBuffer: { mapState: 'unmapped' },
      device: { createCommandEncoder: () => { throw new Error('timestamp resolve failed'); } },
    });
    expect(await resolveFreshComputeTime(rendererFor(pool), 20)).toBeNull();
    expect(pool.frames).toEqual([10]);
  });

  it.each(['disjoint', 'query-error'] as const)('rejects actual WebGL2 %s fallback even when frames advance', async failure => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool: Pool = Object.assign(Object.create(WebGLTimestampQueryPool.prototype), {
      trackTimestamp: true, isDisposed: false, pendingResolve: false,
      lastValue: 3.25, frames: [10], currentQueryIndex: 2,
      queryOffsets: new Map([['c:1:0:f20', 0]]), queryStates: new Map([[0, 'ended']]),
      queries: [{}], timestamps: new Map(), activeQuery: null,
      ext: { GPU_DISJOINT_EXT: 1 },
      gl: {
        getParameter: () => failure === 'disjoint',
        getQueryParameter: () => { throw new Error('query read failed'); },
      },
    });
    expect(await resolveFreshComputeTime(rendererFor(pool), 20)).toBeNull();
    // WebGL2 assigns fresh frame ids even though resolveQuery reused lastValue.
    expect(pool.frames).toEqual([20]);
  });

  it('accepts new frames even when consecutive valid durations are identical', async () => {
    const pool = stubPool();
    const renderer = rendererFor(pool);
    expect(await resolveFreshComputeTime(renderer, 20)).toBe(3.25);
    pool.resolveQueriesAsync = async () => { pool.frames = [21]; return 3.25; };
    expect(await resolveFreshComputeTime(renderer, 21)).toBe(3.25);
  });

  it('does not attach to or invalidate an older pending readback', async () => {
    const pool = stubPool();
    pool.pendingResolve = Promise.resolve(3.25);
    const renderer = rendererFor(pool);
    expect(await resolveFreshComputeTime(renderer, 20)).toBeNull();
    expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    expect(pool.lastValue).toBe(3.25);
  });

  it('rejects a resolved frame from an earlier submission', async () => {
    const pool = stubPool();
    pool.resolveQueriesAsync = async () => { pool.frames = [19]; return 3.25; };
    expect(await resolveFreshComputeTime(rendererFor(pool), 20)).toBeNull();
  });

  it('fails closed when the query pool is missing or the frame was already read', async () => {
    expect(await resolveFreshComputeTime(rendererFor(), 20)).toBeNull();
    const renderer = rendererFor(stubPool());
    expect(await resolveFreshComputeTime(renderer, 10)).toBeNull();
    expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid duration %s', async duration => {
    const pool = stubPool();
    pool.resolveQueriesAsync = async () => { pool.frames = [20]; return duration; };
    expect(await resolveFreshComputeTime(rendererFor(pool), 20)).toBeNull();
  });
});
