import './ui/styles/main.css';
import './ui/styles/tokens.css';
import { composeLab } from './composition.ts';
import { createRendererPort } from './composition/createRendererPort.ts';
import { RendererSession } from './composition/rendererSession.ts';
import { createCanvasRendererFactory } from './composition/canvasRendererFactory.ts';
import { DEFAULT_CONFIG } from './presets/preset.ts';
import { measureRendererTarget } from './ui/rendererTarget.ts';
import { mountLabUI, prepareLabUI } from './ui/app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Không tìm thấy phần tử #app');

// Prepare the host DOM first so the adapter receives the actual preview canvas.
const canvas = prepareLabUI(root);
const initialConfig = new URLSearchParams(window.location.search).get('webgl') === '1'
  ? { ...DEFAULT_CONFIG, backendPreference: 'webgl2' as const }
  : DEFAULT_CONFIG;
const factory = createCanvasRendererFactory(canvas, createRendererPort);
const createTarget = () => measureRendererTarget(factory.canvas);
const session = new RendererSession(initialConfig, factory.createCandidate);

void composeLab({
  createPort: () => session,
  createTarget,
  mountUI: (port) => {
    if (port.getStatus().actual !== 'unavailable') port.start();
    return mountLabUI(root, port, {
      initialConfig,
      isInitializing: () => session.initializing,
      reinitializeBackend: () => session.reinitialize(),
    });
  },
});
