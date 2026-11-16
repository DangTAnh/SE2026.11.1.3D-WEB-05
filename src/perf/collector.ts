import type { PerformanceSnapshot } from '../core/types/measurement.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS, type RendererPort, type RendererStatus } from '../core/renderer/RendererPort.ts';
import { canonicalConfig, configHash } from '../core/measurement/configHash.ts';
import type { LabConfig } from '../presets/preset.ts';

export interface PerformanceCollectorOptions {
  /** Delay before the first sample, allowing the renderer to warm up. */
  readonly warmUpMs: number;
  /** Fixed delay between sample starts after warm-up. */
  readonly cadenceMs: number;
  /** Returns the effective config at the time each sample is taken. */
  readonly getConfig: () => Readonly<LabConfig>;
  readonly onSample: (snapshot: PerformanceSnapshot) => void;
  /** Observes status before paused snapshots are skipped; errors reach onError. */
  readonly onStatus?: (status: Readonly<RendererStatus>) => void;
  /** Receives config/status/callback errors; defaults to `console.error`. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Samples the current renderer status on a fixed cadence after warm-up.
 * The collector does not own or dispose the RendererPort.
 *
 * Each capture reads the effective config and the port status in one
 * synchronous step, so an emitted snapshot always pairs one workload identity
 * with the metrics of that same moment. After the asynchronous hash the port
 * status is read again: a paused port, a lost backend or a replaced backend is
 * reported to `onStatus` and the captured sample is not emitted. If the
 * effective config changed before the hash resolves — including from an
 * `onStatus` callback — the capture is discarded too, and the next cadence
 * samples the new workload (#99).
 */
export class PerformanceCollector {
  #running = false;
  #disposed = false;
  #sampling = false;
  #generation = 0;
  #warmUpTimer: ReturnType<typeof setTimeout> | null = null;
  #cadenceTimer: ReturnType<typeof setInterval> | null = null;
  readonly #onError: (error: unknown) => void;

  constructor(
    private readonly port: RendererPort,
    private readonly options: PerformanceCollectorOptions,
  ) {
    if (!Number.isFinite(options.warmUpMs) || options.warmUpMs < 0) {
      throw new RangeError('PerformanceCollector: warmUpMs must be a finite number >= 0');
    }
    if (!Number.isFinite(options.cadenceMs) || options.cadenceMs <= 0) {
      throw new RangeError('PerformanceCollector: cadenceMs must be a finite number > 0');
    }
    this.#onError = options.onError ?? ((error) => console.error('PerformanceCollector sample failed', error));
  }

  /** Starts sampling once; repeated calls while running have no effect. */
  start(): void {
    if (this.#running || this.#disposed) return;

    this.#running = true;
    const generation = ++this.#generation;
    this.#warmUpTimer = setTimeout(() => {
      this.#warmUpTimer = null;
      if (!this.#isActive(generation)) return;

      void this.#capture(generation);
      this.#cadenceTimer = setInterval(() => {
        void this.#capture(generation);
      }, this.options.cadenceMs);
    }, this.options.warmUpMs);
  }

  /** Stops sampling; repeated calls while stopped have no effect. */
  stop(): void {
    if (!this.#running) return;

    this.#running = false;
    this.#generation += 1;
    if (this.#warmUpTimer !== null) {
      clearTimeout(this.#warmUpTimer);
      this.#warmUpTimer = null;
    }
    if (this.#cadenceTimer !== null) {
      clearInterval(this.#cadenceTimer);
      this.#cadenceTimer = null;
    }
  }

  /** Stops and permanently disables the collector; repeated calls are safe. */
  dispose(): void {
    if (this.#disposed) return;
    this.stop();
    this.#disposed = true;
  }

  #isActive(generation: number): boolean {
    return this.#running && !this.#disposed && generation === this.#generation;
  }

  async #capture(generation: number): Promise<void> {
    if (!this.#isActive(generation) || this.#sampling) return;
    this.#sampling = true;

    try {
      // Capture the effective config and the port status in one synchronous
      // step, so a digest or an observer callback cannot pair workload A's
      // configHash with workload B's metrics.
      const config = this.options.getConfig();
      const identity = canonicalConfig(config);
      const sampled = this.port.getStatus();

      const hash = await configHash(config);
      if (!this.#isActive(generation)) return;

      // The observer keeps its post-digest position so a synchronous stop,
      // dispose or restart still cancels the capture before it can emit.
      this.options.onStatus?.(sampled);
      if (!this.#isActive(generation)) return;
      if (!sampled.running) return;

      // Lifecycle and backend are re-read after the digest. A loss or a
      // replacement during hashing is surfaced to the observer (which is how
      // #82/#83 classify it) and the captured sample is not emitted.
      const current = this.port.getStatus();
      if (!current.running || current.actual !== sampled.actual) {
        this.options.onStatus?.(current);
        return;
      }
      // Policy for a changed workload: discard this capture rather than emit an
      // identity the caller no longer runs; the next cadence samples it.
      if (canonicalConfig(this.options.getConfig()) !== identity) return;

      // Enforce INV-1 even if a RendererPort implementation returns an
      // inconsistent status: unsupported, stale or invalid GPU timing is null.
      // GPU timing age is independent of FPS freshness; preserve a valid FPS.
      const measurementAgeMs = sampled.measurementAgeMs;
      const gpuMeasurementFresh = measurementAgeMs !== null
        && Number.isFinite(measurementAgeMs)
        && measurementAgeMs >= 0
        && measurementAgeMs <= MAX_GPU_MEASUREMENT_AGE_MS;
      const gpuTimingAvailable =
        sampled.gpuTimingAvailable &&
        gpuMeasurementFresh &&
        sampled.gpuTimeMs !== null &&
        Number.isFinite(sampled.gpuTimeMs);
      const snapshot: PerformanceSnapshot = {
        actual: sampled.actual,
        configHash: hash,
        fps: sampled.fps !== null && Number.isFinite(sampled.fps) ? sampled.fps : null,
        gpuTimingAvailable,
        gpuTimeMs: gpuTimingAvailable ? sampled.gpuTimeMs : null,
      };

      this.options.onSample(snapshot);
    } catch (error) {
      this.#onError(error);
    } finally {
      this.#sampling = false;
    }
  }
}
