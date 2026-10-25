import type { RendererTarget } from '../core/renderer/RendererPort.ts';

/** Measures the same canvas host dimensions for initialization and resize. */
export function measureRendererTarget(canvas: HTMLCanvasElement): RendererTarget {
  const bounds = (canvas.parentElement ?? canvas).getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
}
