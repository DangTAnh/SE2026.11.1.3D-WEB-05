import { DEFAULT_CONFIG } from '../presets/preset.ts';
import type { LabConfig } from '../presets/preset.ts';
import type { RendererPort } from '../core/renderer/RendererPort.ts';
import { bindLabControls, renderLabControls } from './controls/controlBindings.ts';
import { byId } from './dom.ts';
import { createToastController } from './notifications.ts';
import { renderRuntimeStatus } from './overlays/statusOverlay.ts';
import { createRendererRuntimeState } from './state/runtimeState.ts';
import { createLabMarkup } from './template.ts';
import { measureRendererTarget } from './rendererTarget.ts';

/** The composition root owns init/canvas binding; UI only consumes the injected port. */
export function prepareLabUI(root: HTMLElement): HTMLCanvasElement {
  root.innerHTML = createLabMarkup();
  const canvas = root.querySelector<HTMLCanvasElement>('#preview-canvas');
  if (!canvas) throw new Error('Không tìm thấy canvas xem trước');
  return canvas;
}
export function mountLabUI(
  root: HTMLElement,
  port?: RendererPort,
): () => void {
  let config: LabConfig = { ...DEFAULT_CONFIG };
  let disposed = false;
  let configApplied = !port;

  if (!root.querySelector('#preview-canvas')) prepareLabUI(root);

  const canvas = root.querySelector<HTMLCanvasElement>('#preview-canvas');
  if (!canvas) throw new Error('Không tìm thấy canvas xem trước');
  const rendererPort = port;
  const getRendererTarget = () => measureRendererTarget(canvas);
  const resizeObserver = rendererPort?.resize
    ? new ResizeObserver(() => rendererPort.resize?.(getRendererTarget()))
    : null;
  if (resizeObserver && canvas.parentElement) resizeObserver.observe(canvas.parentElement);

  const toast = createToastController();

  const refreshStatus = (): void => {
    if (disposed) return;
    if (!configApplied) {
      renderRuntimeStatus(createRendererRuntimeState(undefined, true));
      return;
    }
    try {
      const status = rendererPort?.getStatus();
      renderRuntimeStatus(createRendererRuntimeState(status));
      const running = status?.running ?? false;
      const toggle = byId<HTMLButtonElement>('toggle-preview');
      toggle.textContent = running ? 'Ⅱ' : '▶';
      toggle.setAttribute('aria-label', running ? 'Tạm dừng xem trước' : 'Tiếp tục xem trước');
    } catch {
      renderRuntimeStatus(createRendererRuntimeState(undefined, true));
    }
  };

  const resetSimulation = (): void => {
    try { rendererPort?.reset(); }
    catch { throw new Error('Không thể khởi tạo lại mô phỏng. Vui lòng thử lại.'); }
  };

  const updateConfig = (next: LabConfig, shouldReset = false): void => {
    if (disposed) return;
    const countChanged = next.particleCount !== config.particleCount;
    try {
      rendererPort?.applyConfig(next);
    } catch {
      renderLabControls(config);
      throw new Error('Không thể áp dụng cấu hình. Cấu hình trước vẫn được giữ trong UI.');
    }
    configApplied = true;
    config = next;
    renderLabControls(config);
    if (shouldReset && !countChanged) {
      try { resetSimulation(); }
      catch {
        refreshStatus();
        throw new Error('Cấu hình đã được áp dụng. Không thể khởi tạo lại mô phỏng; vui lòng thử Reset.');
      }
    }
    refreshStatus();
  };

  const disposeControls = bindLabControls({
    getConfig: () => config,
    updateConfig,
    resetSimulation: () => { resetSimulation(); refreshStatus(); },
    toggleSimulation: () => {
      if (!rendererPort) return;
      if (rendererPort.getStatus().running) rendererPort.pause();
      else rendererPort.start();
      refreshStatus();
    },
    notify: toast.notify,
  });

  renderLabControls(config);
  try {
    rendererPort?.applyConfig(config);
    if (port) configApplied = true;
    refreshStatus();
  } catch {
    renderRuntimeStatus(createRendererRuntimeState(undefined, true));
  }

  const statusTimer = window.setInterval(refreshStatus, 500);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(statusTimer);
    disposeControls();
    toast.dispose();
    resizeObserver?.disconnect();
  };
  return dispose;
}
