import './ui/styles/main.css';
import './ui/styles/tokens.css';
import { composeLab } from './composition.ts';
import { createRendererPort } from './composition/createRendererPort.ts';
import { RendererSession } from './composition/rendererSession.ts';
import { DEFAULT_CONFIG } from './presets/preset.ts';
import { measureRendererTarget } from './ui/rendererTarget.ts';
import { mountLabUI, prepareLabUI } from './ui/app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Không tìm thấy phần tử #app');

// Prepare the host DOM first so the adapter receives the actual preview canvas.
let canvas = prepareLabUI(root);
const initialConfig = new URLSearchParams(window.location.search).get('webgl') === '1'
  ? { ...DEFAULT_CONFIG, backendPreference: 'webgl2' as const }
  : DEFAULT_CONFIG;
const createTarget = () => measureRendererTarget(canvas);
const session = new RendererSession(initialConfig, (config) => {
  // A canvas keeps its context type for life. Each backend attempt initiated by
  // the user needs a new surface, even after the old renderer is disposed.
  const nextCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(nextCanvas);
  canvas = nextCanvas;
  return createRendererPort(canvas, config);
});

void composeLab({
  createPort: () => session,
  createTarget,
  mountUI: (port) => {
    port.start();
    return mountLabUI(root, port, {
      initialConfig,
      isInitializing: () => session.initializing,
      reinitializeBackend: async () => { await session.reinitialize(); },
    });
  },
});
