import '../../../src/ui/styles/main.css';
import '../../../src/ui/styles/tokens.css';
import { composeLab } from '../../../src/composition.ts';
import { mountLabUI } from '../../../src/ui/app.ts';
import { FakeRenderer } from '../../support/fakeRenderer.ts';
import type { RendererStatus } from '../../../src/core/renderer/RendererPort.ts';

declare global {
  interface Window {
    initialRendererApplyFailure?: boolean;
    uiTest: {
      port: FakeRenderer; unmount: () => void; finishImport?: () => void;
      setStatus: (status: Partial<RendererStatus>) => void;
      setFailure: (failed: boolean) => void;
    };
  }
}

const TARGET = { width: 800, height: 600, pixelRatio: 1 };

class ControlledRenderer extends FakeRenderer {
  failed = false;

  override getStatus(): RendererStatus {
    if (this.failed) throw new Error('internal test failure');
    return super.getStatus();
  }

  override applyConfig(...args: Parameters<FakeRenderer['applyConfig']>): void {
    if (window.initialRendererApplyFailure) throw new Error('internal apply failure');
    super.applyConfig(...args);
  }
}

const port = new ControlledRenderer({
  actual: 'webgpu', requested: 'auto', running: true, gpuTimingAvailable: false,
});
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing test root');
const unmount = await composeLab({
  createPort: () => port,
  createTarget: () => TARGET,
  mountUI: (injected) => mountLabUI(root, injected),
});
window.uiTest = {
  port, unmount,
  setStatus: (status) => { port.setStatus(status); },
  setFailure: (failed) => { port.failed = failed; },
};
