import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { LabConfig } from '../presets/preset.ts';
import type { RendererCandidate } from './backendSwitch.ts';

/** Shared production/test wiring: stage a distinct context without replacing the live canvas. */
export function createCanvasRendererFactory(
  initialCanvas: HTMLCanvasElement,
  createPort: (canvas: HTMLCanvasElement, config: Readonly<LabConfig>) => RendererPort,
) {
  let canvas = initialCanvas;
  let activeOwner: symbol | null = null;
  const host = initialCanvas.parentElement;
  const resolveCanvas = (): HTMLCanvasElement => {
    if (host && canvas.parentElement !== host) {
      const activeCanvases = Array.from(host.querySelectorAll('canvas'))
        .filter(candidate => !candidate.closest('[data-renderer-staging]'));
      if (activeCanvases.length === 1) canvas = activeCanvases[0]!;
      else if (activeCanvases.length > 1) throw new Error('Renderer host has multiple active canvases.');
    }
    return canvas;
  };
  return {
    get canvas(): HTMLCanvasElement { return resolveCanvas(); },
    createCandidate(config: Readonly<LabConfig>): RendererCandidate {
      const previous = resolveCanvas();
      const host = previous.parentElement;
      if (!host) throw new Error('Renderer canvas has no host.');
      const owner = Symbol('renderer-candidate');
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
            if (discarded || committed || resolveCanvas() !== previous) throw new Error('Obsolete canvas candidate.');
            const stagedCanvases = staging.querySelectorAll('canvas');
            if (stagedCanvases.length !== 1) throw new Error('Renderer candidate must own exactly one staged canvas.');
            const adopted = stagedCanvases[0]!;
            adopted.id = previous.id;
            previous.replaceWith(adopted);
            canvas = adopted;
            activeOwner = owner;
            committed = true;
            staging.remove();
          },
          discard(): void {
            if (discarded) return;
            discarded = true;
            if (committed) {
              if (activeOwner === owner) {
                resolveCanvas().remove();
                activeOwner = null;
              }
            } else {
              staging.remove();
            }
          },
        };
      } catch (error) {
        staging.remove();
        throw error;
      }
    },
  };
}
