import type { RendererPort, RendererTarget } from './core/renderer/RendererPort.ts';

export interface LabComposition {
  readonly createPort: () => RendererPort;
  readonly createTarget: () => RendererTarget;
  readonly mountUI: (port: RendererPort) => () => void;
}

/**
 * Initialize the renderer before mounting a UI that reads its status.
 * The unload listener is installed before init so a pending initialization is
 * disposed if the page is closed.
 */
export async function composeLab({
  createPort,
  createTarget,
  mountUI,
}: LabComposition): Promise<() => void> {
  const port = createPort();
  let uiDispose: (() => void) | null = null;
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', dispose);
    try {
      uiDispose?.();
    } finally {
      port.dispose();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', dispose, { once: true });
  }

  try {
    await port.init(createTarget());
  } catch {
    // Availability is read back from getStatus(); never surface init errors in the page.
  }

  if (disposed) return dispose;
  try {
    uiDispose = mountUI(port);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
