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
    sessionInitialFallback?: boolean;
    sessionTest: {
      ports: FakeRenderer[];
      deferNext: boolean;
      failNext: boolean;
      unavailableNext: boolean;
      fallbackNext: boolean;
      replaceDuringInitNext: boolean;
      observers: { created: number; disconnected: number };
      finish: Array<() => void>;
      rendererCanvases: HTMLCanvasElement[];
      unmount: () => void;
      simulateRuntimeCanvasReplacement: () => void;
      factoryCanvasIsCurrent: () => boolean;
      factoryCanvasIsLatestRendererCanvas: () => boolean;
      latestRendererCanvasIsConnected: () => boolean;
    };
  }
}

const root = document.querySelector<HTMLElement>('#app')!;
const canvas = prepareLabUI(root);
window.sessionTest = { ports: [], deferNext: false, failNext: false, unavailableNext: false, fallbackNext: false,
  replaceDuringInitNext: false, observers: { created: 0, disconnected: 0 }, finish: [], rendererCanvases: [], unmount: () => {},
  simulateRuntimeCanvasReplacement: () => { throw new Error('Canvas factory is not ready.'); },
  factoryCanvasIsCurrent: () => false, factoryCanvasIsLatestRendererCanvas: () => false,
  latestRendererCanvasIsConnected: () => false };
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
const factory = createCanvasRendererFactory(canvas, (candidateCanvas, config) => {
  const fail = window.sessionTest.failNext;
  const defer = window.sessionTest.deferNext;
  const fallback = window.sessionTest.fallbackNext
    || (window.sessionTest.ports.length === 0 && window.sessionInitialFallback);
  const unavailable = window.sessionTest.unavailableNext
    || (window.sessionTest.ports.length === 0 && window.sessionInitialUnavailable);
  const replaceDuringInit = window.sessionTest.replaceDuringInitNext
    || (window.sessionTest.ports.length === 0 && window.sessionInitialFallback);
  window.sessionTest.failNext = false;
  window.sessionTest.deferNext = false;
  window.sessionTest.unavailableNext = false;
  window.sessionTest.fallbackNext = false;
  window.sessionTest.replaceDuringInitNext = false;
  const rendererCanvasIndex = window.sessionTest.rendererCanvases.push(candidateCanvas) - 1;
  const port = new FakeRenderer({ requested: config.backendPreference,
    actual: unavailable ? 'unavailable' : fallback || config.backendPreference === 'webgl2' ? 'webgl2' : 'webgpu',
    gpuTimingAvailable: false });
  const init = port.init.bind(port);
  port.init = async target => {
    if (defer) await new Promise<void>(resolve => window.sessionTest.finish.push(resolve));
    if (fail) throw new Error('private backend error');
    if (replaceDuringInit) {
      const stagedCanvas = window.sessionTest.rendererCanvases[rendererCanvasIndex]!;
      const replacement = stagedCanvas.cloneNode(true) as HTMLCanvasElement;
      stagedCanvas.replaceWith(replacement);
      window.sessionTest.rendererCanvases[rendererCanvasIndex] = replacement;
    }
    return init(target);
  };
  window.sessionTest.ports.push(port);
  return port;
});
window.sessionTest.simulateRuntimeCanvasReplacement = () => {
  const previous = factory.canvas;
  const replacement = previous.cloneNode(true) as HTMLCanvasElement;
  previous.replaceWith(replacement);
  window.sessionTest.rendererCanvases[window.sessionTest.rendererCanvases.length - 1] = replacement;
};
window.sessionTest.factoryCanvasIsCurrent = () =>
  factory.canvas === document.querySelector<HTMLCanvasElement>('#preview-canvas');
window.sessionTest.factoryCanvasIsLatestRendererCanvas = () =>
  factory.canvas === window.sessionTest.rendererCanvases.at(-1);
window.sessionTest.latestRendererCanvasIsConnected = () =>
  window.sessionTest.rendererCanvases.at(-1)?.isConnected ?? false;
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
