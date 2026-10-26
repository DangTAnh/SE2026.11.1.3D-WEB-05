import '../../../src/ui/styles/main.css';
import '../../../src/ui/styles/tokens.css';
import { composeLab } from '../../../src/composition.ts';
import { RendererSession } from '../../../src/composition/rendererSession.ts';
import { mountLabUI, prepareLabUI } from '../../../src/ui/app.ts';
import { DEFAULT_CONFIG } from '../../../src/presets/preset.ts';
import { FakeRenderer } from '../../support/fakeRenderer.ts';

declare global {
  interface Window {
    sessionTest: {
      ports: FakeRenderer[];
      deferNext: boolean;
      failNext: boolean;
      finish: Array<() => void>;
      unmount: () => void;
    };
  }
}

const root = document.querySelector<HTMLElement>('#app')!;
let canvas = prepareLabUI(root);
window.sessionTest = { ports: [], deferNext: false, failNext: false, finish: [], unmount: () => {} };
const session = new RendererSession(DEFAULT_CONFIG, config => {
  const next = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(next);
  canvas = next;
  const fail = window.sessionTest.failNext;
  const defer = window.sessionTest.deferNext;
  window.sessionTest.failNext = false;
  window.sessionTest.deferNext = false;
  const port = new FakeRenderer({ requested: config.backendPreference,
    actual: config.backendPreference === 'webgl2' ? 'webgl2' : 'webgpu', gpuTimingAvailable: false });
  const init = port.init.bind(port);
  port.init = async target => {
    if (defer) await new Promise<void>(resolve => window.sessionTest.finish.push(resolve));
    if (fail) throw new Error('private backend error');
    return init(target);
  };
  window.sessionTest.ports.push(port);
  return port;
});
window.sessionTest.unmount = await composeLab({
  createPort: () => session,
  createTarget: () => ({ width: 800, height: 600, pixelRatio: 1 }),
  mountUI: port => {
    port.start();
    return mountLabUI(root, port, { isInitializing: () => session.initializing,
      reinitializeBackend: async () => { await session.reinitialize(); } });
  },
});
