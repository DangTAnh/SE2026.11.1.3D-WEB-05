import '../../../src/ui/styles/main.css';
import '../../../src/ui/styles/tokens.css';
import { composeLab } from '../../../src/composition.ts';
import { RendererSession } from '../../../src/composition/rendererSession.ts';
import { createCanvasRendererFactory } from '../../../src/composition/canvasRendererFactory.ts';
import { mountLabUI, prepareLabUI } from '../../../src/ui/app.ts';
import { DEFAULT_CONFIG } from '../../../src/presets/preset.ts';
import { FakeRenderer } from '../../support/fakeRenderer.ts';

declare global {
  interface Window {
    sessionInitialUnavailable?: boolean;
    sessionTest: {
      ports: FakeRenderer[];
      deferNext: boolean;
      failNext: boolean;
      unavailableNext: boolean;
      fallbackNext: boolean;
      observers: { created: number; disconnected: number };
      finish: Array<() => void>;
      unmount: () => void;
    };
  }
}

const root = document.querySelector<HTMLElement>('#app')!;
const canvas = prepareLabUI(root);
window.sessionTest = { ports: [], deferNext: false, failNext: false, unavailableNext: false, fallbackNext: false,
  observers: { created: 0, disconnected: 0 }, finish: [], unmount: () => {} };
const NativeResizeObserver = window.ResizeObserver;
window.ResizeObserver = class extends NativeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    super(callback);
    window.sessionTest.observers.created += 1;
  }
  override disconnect(): void {
    window.sessionTest.observers.disconnected += 1;
    super.disconnect();
  }
};
const factory = createCanvasRendererFactory(canvas, (_canvas, config) => {
  const fail = window.sessionTest.failNext;
  const defer = window.sessionTest.deferNext;
  const fallback = window.sessionTest.fallbackNext;
  const unavailable = window.sessionTest.unavailableNext
    || (window.sessionTest.ports.length === 0 && window.sessionInitialUnavailable);
  window.sessionTest.failNext = false;
  window.sessionTest.deferNext = false;
  window.sessionTest.unavailableNext = false;
  window.sessionTest.fallbackNext = false;
  const port = new FakeRenderer({ requested: config.backendPreference,
    actual: unavailable ? 'unavailable' : fallback || config.backendPreference === 'webgl2' ? 'webgl2' : 'webgpu',
    gpuTimingAvailable: false });
  const init = port.init.bind(port);
  port.init = async target => {
    if (defer) await new Promise<void>(resolve => window.sessionTest.finish.push(resolve));
    if (fail) throw new Error('private backend error');
    return init(target);
  };
  window.sessionTest.ports.push(port);
  return port;
});
const session = new RendererSession(DEFAULT_CONFIG, factory.createCandidate);
window.sessionTest.unmount = await composeLab({
  createPort: () => session,
  createTarget: () => ({ width: 800, height: 600, pixelRatio: 1 }),
  mountUI: port => {
    if (port.getStatus().actual !== 'unavailable') port.start();
    return mountLabUI(root, port, { isInitializing: () => session.initializing,
      reinitializeBackend: () => session.reinitialize() });
  },
});
