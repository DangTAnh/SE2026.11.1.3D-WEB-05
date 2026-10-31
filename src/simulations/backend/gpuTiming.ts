import type { WebGPURenderer } from 'three/webgpu';

/** Runtime surface in pinned Three 0.186.1, absent from its Backend typings. */
interface ComputeTimestampPool {
  lastValue: number;
  readonly pendingResolve: unknown;
  getTimestampFrames(): readonly number[];
}

/**
 * Three resolves failed/empty/disjoint queries with lastValue, not a rejection.
 * Invalidate that internal cache before resolving so a fallback stays invalid,
 * including WebGL2's per-query fallback which can still advance the frame list.
 * The NaN sentinel never leaves this boundary as a measurement.
 */
export async function resolveFreshComputeTime(
  renderer: WebGPURenderer,
  submittedFrame: number,
): Promise<number | null> {
  const backend = renderer.backend as typeof renderer.backend & {
    timestampQueryPool?: { compute?: ComputeTimestampPool };
  };
  const pool = backend.timestampQueryPool?.compute;
  if (!pool || pool.pendingResolve || !Number.isSafeInteger(submittedFrame) || submittedFrame < 0) return null;
  const previousFrame = pool.getTimestampFrames().at(-1);
  if (previousFrame !== undefined && previousFrame >= submittedFrame) return null;

  pool.lastValue = Number.NaN;
  const duration = await renderer.resolveTimestampsAsync('compute');
  // A query started before pause/reset must not be dated as the new submission.
  const resolvedFrame = pool.getTimestampFrames().at(-1);
  return resolvedFrame === submittedFrame && typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? duration : null;
}
