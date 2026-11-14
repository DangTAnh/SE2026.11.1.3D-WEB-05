import { ThreeRendererAdapter } from '../simulations/rendererAdapter.ts';
import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { LabConfig } from '../presets/preset.ts';

/** Keeps concrete simulation imports behind the composition boundary. */
export function createRendererPort(
  canvas: HTMLCanvasElement,
  initialConfig: Readonly<LabConfig>,
): RendererPort {
  return new ThreeRendererAdapter(canvas, initialConfig);
}
