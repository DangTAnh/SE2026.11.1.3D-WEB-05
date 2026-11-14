import type { RendererTarget } from '../core/renderer/RendererPort.ts';

/** Measures a stable canvas host, even if the renderer replaces the canvas. */
export function measureRendererTarget(host: Element): RendererTarget {
  const bounds = host.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
}
