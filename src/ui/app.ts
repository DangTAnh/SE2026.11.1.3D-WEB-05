import { DEFAULT_CONFIG } from '../presets/preset.ts';
import type { LabConfig } from '../presets/preset.ts';
import { bindLabControls, renderLabControls } from './controls/controlBindings.ts';
import { byId } from './dom.ts';
import { createParticlePreview } from './mock/particlePreview.ts';
import { createToastController } from './notifications.ts';
import { renderRuntimeStatus } from './overlays/statusOverlay.ts';
import {
  createRuntimeState,
  resolveRuntimeFixture,
  withPreviewFps,
} from './state/runtimeState.ts';
import { createLabMarkup } from './template.ts';

export function mountLabUI(root: HTMLElement): void {
  let config: LabConfig = { ...DEFAULT_CONFIG };
  let runtimeState = createRuntimeState(resolveRuntimeFixture(window.location.search));

  root.innerHTML = createLabMarkup();

  const preview = createParticlePreview(byId<HTMLCanvasElement>('preview-canvas'), () => config);
  const toast = createToastController();

  const updateConfig = (next: LabConfig, resetPreview = false): void => {
    config = next;
    renderLabControls(config);
    if (resetPreview) preview.reset();
  };

  const disposeControls = bindLabControls({
    getConfig: () => config,
    updateConfig,
    resetPreview: preview.reset,
    togglePreview: preview.toggle,
    notify: toast.notify,
  });

  renderLabControls(config);
  renderRuntimeStatus(runtimeState);

  const fpsTimer = window.setInterval(() => {
    runtimeState = withPreviewFps(runtimeState, preview.getFps());
    renderRuntimeStatus(runtimeState);
  }, 500);

  window.addEventListener(
    'beforeunload',
    () => {
      window.clearInterval(fpsTimer);
      disposeControls();
      toast.dispose();
      preview.dispose();
    },
    { once: true },
  );
}
