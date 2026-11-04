import { createImportUndo } from '../../presets/importUndo.ts';
import { createPresetFileReader } from './presetFile.ts';
import {
  cloneConfig,
  downloadPresetDocument,
  type LabConfig,
  type PresetDocument,
} from '../../presets/preset.ts';
import { byId } from '../dom.ts';
import type { ToastTone } from '../notifications.ts';

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);

interface ControlCallbacks {
  getConfig: () => LabConfig;
  updateConfig: (next: LabConfig, resetSimulation?: boolean) => void;
  getPresetDocument: () => PresetDocument;
  importPresetDocument: (document: PresetDocument) => void;
  restoreDefaults: () => void;
  resetSimulation: () => void;
  toggleSimulation: () => void;
  applyBackend: () => void;
  notify: (message: string, tone?: ToastTone) => void;
}

export function renderLabControls(config: LabConfig): void {
  const strength = config.mode === 'attractor'
    ? config.modes.attractor.attractorStrength : config.modes.vortex.vortexStrength;
  byId<HTMLInputElement>('particle-count').value = String(config.simulation.particleCount);
  byId<HTMLInputElement>('speed').value = String(config.simulation.speed);
  byId<HTMLInputElement>('particle-size').value = String(config.simulation.particleSize);
  byId<HTMLInputElement>('particle-color').value = config.rendering.particleColor;
  byId<HTMLInputElement>('strength').value = String(strength);
  byId<HTMLSelectElement>('backend').value = config.backendPreference;

  byId<HTMLOutputElement>('particle-count-value').textContent = formatNumber(config.simulation.particleCount);
  byId<HTMLOutputElement>('speed-value').textContent = `${formatNumber(config.simulation.speed)}×`;
  byId<HTMLOutputElement>('particle-size-value').textContent = `${formatNumber(config.simulation.particleSize)}`;
  byId<HTMLOutputElement>('particle-color-value').textContent = config.rendering.particleColor.toUpperCase();
  byId<HTMLOutputElement>('strength-value').textContent = formatNumber(strength);
  byId<HTMLElement>('strength-label').textContent =
    config.mode === 'attractor' ? 'Attractor strength' : 'Vortex strength';
  byId<HTMLElement>('mode-description').textContent = config.mode === 'attractor'
    ? 'Particle chuyển động theo quỹ đạo tiếp tuyến quanh tâm.'
    : 'Particle xoáy quanh tâm (minh họa).';
  byId<HTMLElement>('scene-mode').textContent =
    config.mode === 'attractor' ? 'ATTRACTOR FIELD' : 'VORTEX FIELD';

  (['attractor', 'vortex'] as const).forEach((mode) => {
    const button = byId<HTMLButtonElement>(`mode-${mode}`);
    button.classList.toggle('active', config.mode === mode);
    button.setAttribute('aria-pressed', String(config.mode === mode));
  });
}

export function bindLabControls(callbacks: ControlCallbacks): () => void {
  const owner = Symbol('preset session');
  const session = createImportUndo(owner, callbacks.getPresetDocument, callbacks.importPresetDocument);
  const undoButton = byId<HTMLButtonElement>('undo-import');
  const syncUndo = (): void => { undoButton.disabled = !session.canUndo(owner); };
  const reader = createPresetFileReader(text => {
    try { session.importText(owner, text); } finally { syncUndo(); }
  }, callbacks.notify);
  const invalidate = (): void => {
    reader.invalidate();
    session.invalidate(owner);
    syncUndo();
  };
  const updateConfig: ControlCallbacks['updateConfig'] = (next, resetSimulation) => {
    invalidate();
    callbacks.updateConfig(next, resetSimulation);
  };
  syncUndo();
  const disposers: Array<() => void> = [];
  let disposed = false;
  const listen = (
    element: HTMLElement,
    event: string,
    handler: EventListener,
  ): void => {
    const guarded: EventListener = (event) => {
      try { handler(event); }
      catch { callbacks.notify('Không thể cập nhật renderer. Vui lòng thử lại.', 'error'); }
    };
    element.addEventListener(event, guarded);
    disposers.push(() => element.removeEventListener(event, guarded));
  };

  const numericFields = {
    speed: 'speed',
    'particle-size': 'particleSize',
  } as const;

  (Object.keys(numericFields) as Array<keyof typeof numericFields>).forEach((id) => {
    listen(byId<HTMLInputElement>(id), 'input', (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      const next = cloneConfig(callbacks.getConfig());
      next.simulation[numericFields[id]] = value;
      updateConfig(next);
    });
  });

  listen(byId<HTMLInputElement>('strength'), 'input', (event) => {
    const next = cloneConfig(callbacks.getConfig());
    const value = Number((event.target as HTMLInputElement).value);
    if (next.mode === 'attractor') next.modes.attractor.attractorStrength = value;
    else next.modes.vortex.vortexStrength = value;
    updateConfig(next);
  });

  listen(byId<HTMLInputElement>('particle-count'), 'input', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    invalidate();
    byId<HTMLOutputElement>('particle-count-value').textContent = formatNumber(value);
  });
  listen(byId<HTMLInputElement>('particle-count'), 'change', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    const next = cloneConfig(callbacks.getConfig());
    next.simulation.particleCount = value;
    updateConfig(next, true);
  });
  listen(byId<HTMLInputElement>('particle-color'), 'input', (event) => {
    const next = cloneConfig(callbacks.getConfig());
    next.rendering.particleColor = (event.target as HTMLInputElement).value;
    updateConfig(next);
  });

  listen(byId<HTMLSelectElement>('backend'), 'change', (event) => {
    updateConfig({
      ...callbacks.getConfig(),
      backendPreference: (event.target as HTMLSelectElement).value as LabConfig['backendPreference'],
    });
    callbacks.notify('Lựa chọn backend sẽ có hiệu lực ở lần khởi tạo renderer tiếp theo. Nhấn Áp dụng backend để khởi tạo ngay.', 'info');
  });

  listen(byId<HTMLButtonElement>('apply-backend'), 'click', () => {
    invalidate();
    callbacks.applyBackend();
  });

  (['attractor', 'vortex'] as const).forEach((mode) => {
    listen(byId<HTMLButtonElement>(`mode-${mode}`), 'click', () => {
      updateConfig({ ...callbacks.getConfig(), mode }, true);
    });
  });

  listen(byId<HTMLButtonElement>('toggle-preview'), 'click', () => {
    callbacks.toggleSimulation();
  });

  listen(byId<HTMLButtonElement>('reset-preview'), 'click', () => {
    callbacks.resetSimulation();
    callbacks.notify('Đã khởi tạo lại mô phỏng.');
  });

  listen(byId<HTMLButtonElement>('export-preset'), 'click', () => {
    try {
      downloadPresetDocument(callbacks.getPresetDocument());
      callbacks.notify('Đã xuất preset JSON.');
    } catch (error) {
      callbacks.notify(error instanceof Error ? error.message : 'Không thể xuất preset.', 'error');
    }
  });

  listen(byId<HTMLButtonElement>('import-preset'), 'click', () => {
    byId<HTMLInputElement>('preset-file').click();
  });

  listen(undoButton, 'click', () => {
    reader.invalidate();
    try {
      if (session.undo(owner)) callbacks.notify('Đã hoàn tác import preset.');
    } catch (error) {
      callbacks.notify(error instanceof Error ? error.message : 'Không thể hoàn tác preset.', 'error');
    } finally { syncUndo(); }
  });

  listen(byId<HTMLInputElement>('preset-file'), 'change', async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Keep the File before clearing: cancelled reads must allow same-file retry.
    // Never clear after awaiting, when a newer selection may already exist.
    input.value = '';
    await reader.read(file);
  });

  listen(byId<HTMLButtonElement>('restore-defaults'), 'click', () => {
    invalidate();
    callbacks.restoreDefaults();
    callbacks.notify('Đã khôi phục cấu hình mặc định.');
  });

  return () => {
    if (disposed) return;
    disposed = true;
    reader.invalidate();
    disposers.forEach((dispose) => dispose());
  };
}
