import type { RendererPort, RendererStatus, RendererTarget } from '../core/renderer/RendererPort.ts';
import type { ActualBackend } from '../core/types/backend.ts';
import type { LabConfig } from '../presets/preset.ts';

/** A stable UI-facing port; concrete adapters and canvases belong to one generation. */
export class RendererSession implements RendererPort {
  #port: RendererPort | null = null;
  #config: LabConfig;
  #generation = 0;
  #disposed = false;
  #initializing = false;
  #running = false;
  #target: RendererTarget = { width: 1, height: 1, pixelRatio: 1 };

  constructor(
    config: Readonly<LabConfig>,
    private readonly createPort: (config: Readonly<LabConfig>) => RendererPort,
  ) {
    this.#config = { ...config };
  }

  get initializing(): boolean { return this.#initializing; }

  async init(target: RendererTarget): Promise<ActualBackend> {
    if (this.#disposed) return 'unavailable';
    const generation = ++this.#generation;
    this.#target = target;
    this.#initializing = true;
    const previous = this.#port;
    this.#port = null;
    let candidate: RendererPort | null = null;
    try {
      previous?.dispose();
      candidate = this.createPort({ ...this.#config });
      this.#port = candidate;
      await candidate.init(this.#target);
      if (this.#disposed || generation !== this.#generation) return 'unavailable';
      // Edits made during async initialization apply to this generation too.
      candidate.applyConfig(this.#config);
      candidate.resize?.(this.#target);
      const actual = candidate.getStatus().actual;
      if (actual !== 'unavailable' && this.#running) candidate.start();
      return actual;
    } catch {
      if (generation === this.#generation && !this.#disposed) {
        this.#port = null;
        candidate?.dispose();
      }
      return 'unavailable';
    } finally {
      if (generation === this.#generation) this.#initializing = false;
    }
  }

  reinitialize(): Promise<ActualBackend> { return this.init(this.#target); }

  applyConfig(config: Readonly<LabConfig>): void {
    if (this.#disposed) return;
    if (!this.#initializing) this.#port?.applyConfig(config);
    this.#config = { ...config };
  }

  start(): void {
    if (this.#disposed) return;
    this.#running = true;
    if (!this.#initializing) this.#port?.start();
  }

  pause(): void {
    if (this.#disposed) return;
    this.#running = false;
    if (!this.#initializing) this.#port?.pause();
  }

  reset(): void {
    if (!this.#disposed && !this.#initializing) this.#port?.reset();
  }

  resize(target: RendererTarget): void {
    this.#target = target;
    if (!this.#disposed && !this.#initializing) this.#port?.resize?.(target);
  }

  getStatus(): RendererStatus {
    if (!this.#disposed && !this.#initializing && this.#port) return this.#port.getStatus();
    return { requested: this.#config.backendPreference, actual: 'unavailable', running: false,
      gpuTimingAvailable: false, gpuTimeMs: null, fps: null };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#initializing = false;
    const port = this.#port;
    this.#port = null;
    port?.dispose();
  }
}
