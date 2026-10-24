import './ui/styles/main.css';
import './ui/styles/tokens.css';
import { composeLab } from './composition.ts';
import { createRendererPort } from './composition/createRendererPort.ts';
import { DEFAULT_CONFIG } from './presets/preset.ts';
import type { RendererTarget } from './core/renderer/RendererPort.ts';
import { mountLabUI, prepareLabUI } from './ui/app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Không tìm thấy phần tử #app');

// Prepare the host DOM first so the adapter receives the actual preview canvas.
const canvas = prepareLabUI(root);
const createTarget = (): RendererTarget => {
  const bounds = (canvas.parentElement ?? canvas).getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
};

void composeLab({
  createPort: () => createRendererPort(canvas, DEFAULT_CONFIG),
  createTarget,
  mountUI: (port) => {
    if (port.getStatus().actual !== 'unavailable') port.start();
    return mountLabUI(root, port);
  },
});
