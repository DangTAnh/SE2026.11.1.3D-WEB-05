import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { LabConfig } from '../presets/preset.ts';
import type { RendererCandidate } from './backendSwitch.ts';

/** Shared production/test wiring: stage a distinct context without replacing the live canvas. */
export function createCanvasRendererFactory(
  initialCanvas: HTMLCanvasElement,
  createPort: (canvas: HTMLCanvasElement, config: Readonly<LabConfig>) => RendererPort,
) {
  let canvas = initialCanvas;
  return {
    get canvas(): HTMLCanvasElement { return canvas; },
    createCandidate(config: Readonly<LabConfig>): RendererCandidate {
      const previous = canvas;
      const host = previous.parentElement;
      if (!host) throw new Error('Renderer canvas has no host.');
      const next = previous.cloneNode(true) as HTMLCanvasElement;
      next.removeAttribute('id');
      const staging = document.createElement('div');
      staging.dataset.rendererStaging = 'true';
      staging.setAttribute('aria-hidden', 'true');
      staging.inert = true;
      const bounds = host.getBoundingClientRect();
      Object.assign(staging.style, {
        position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden', pointerEvents: 'none',
        width: `${Math.max(1, bounds.width)}px`, height: `${Math.max(1, bounds.height)}px`,
      });
      staging.append(next);
      host.append(staging);
      let committed = false;
      let discarded = false;
      try {
        const port = createPort(next, config);
        return {
          port,
          commit(): void {
            if (discarded || committed || canvas !== previous) throw new Error('Obsolete canvas candidate.');
            next.id = previous.id;
            previous.replaceWith(next);
            canvas = next;
            committed = true;
            staging.remove();
          },
          discard(): void {
            if (discarded) return;
            discarded = true;
            staging.remove();
            if (committed) next.remove();
          },
        };
      } catch (error) {
        staging.remove();
        throw error;
      }
    },
  };
}
