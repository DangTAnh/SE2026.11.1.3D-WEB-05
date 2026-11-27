import type { RendererPort, RendererStatus, RendererTarget } from '../core/renderer/RendererPort.ts';
import type { ActualBackend, BackendPreference } from '../core/types/backend.ts';
import { cloneConfig, type LabConfig } from '../presets/preset.ts';
import type { BackendSwitchResult, RendererCandidate } from './backendSwitch.ts';

/** Stable UI-facing port; backend replacement commits only after candidate readiness. */
export class RendererSession implements RendererPort {
  #active: RendererCandidate | null = null;
  #pending: { candidate: RendererCandidate | null; requested: BackendPreference } | null = null;
  #released = new WeakSet<RendererCandidate>();
  #config: LabConfig;
  #requested: BackendPreference;
  #generation = 0;
  #disposed = false;
  #runIntent = false;
  #target: RendererTarget = { width: 1, height: 1, pixelRatio: 1 };

  constructor(
    config: Readonly<LabConfig>,
    private readonly createCandidate: (config: Readonly<LabConfig>) => RendererCandidate,
  ) {
    this.#config = cloneConfig(config);
    this.#requested = config.backendPreference;
  }

  get initializing(): boolean { return this.#pending !== null; }

  async init(target: RendererTarget): Promise<ActualBackend> {
    this.#target = target;
    return (await this.reinitialize()).actual;
  }

  async reinitialize(): Promise<BackendSwitchResult> {
    const requested = this.#config.backendPreference;
    const result = (outcome: BackendSwitchResult['outcome']): BackendSwitchResult => {
      const actual = this.#active?.port.getStatus().actual ?? 'unavailable';
      return { outcome, requested, actual,
        retainedPrevious: outcome === 'failed' && actual !== 'unavailable' };
    };
    if (this.#disposed) return result('superseded');
    const generation = ++this.#generation;
    this.#release(this.#pending?.candidate ?? null);
    const pending = { candidate: null as RendererCandidate | null, requested };
    this.#pending = pending;
    this.#requested = requested;
    const isCurrent = () => !this.#disposed && generation === this.#generation;
    let previousPaused = false;
    let committed = false;
    try {
      const candidate = this.createCandidate(cloneConfig(this.#config));
      pending.candidate = candidate;
      const actual = await candidate.port.init(this.#target);
      if (!isCurrent()) return result('superseded');
      candidate.port.pause();
      candidate.port.applyConfig({ ...cloneConfig(this.#config), backendPreference: requested });
      candidate.port.resize?.(this.#target);
      if (actual === 'unavailable' || candidate.port.getStatus().actual !== actual) return result('failed');
      // Candidate initialization is paused. Stop the old simulation before starting
      // the replacement; the old visible surface is retained until commit succeeds.
      this.#active?.port.pause();
      previousPaused = true;
      if (this.#runIntent) candidate.port.start();
      candidate.commit();
      const previous = this.#active;
      this.#active = candidate;
      pending.candidate = null;
      committed = true;
      this.#release(previous);
      return result('applied');
    } catch {
      if (!isCurrent()) return result('superseded');
      return result('failed');
    } finally {
      this.#release(pending.candidate);
      if (isCurrent()) {
        this.#pending = null;
        if (!committed && previousPaused && this.#runIntent && this.#active) this.#active.port.start();
      }
    }
  }

  #release(candidate: RendererCandidate | null): void {
    if (!candidate || this.#released.has(candidate)) return;
    this.#released.add(candidate);
    try { candidate.port.dispose(); } catch { /* Continue surface cleanup. */ }
    try { candidate.discard(); } catch { /* Disposal is best effort. */ }
  }

  applyConfig(config: Readonly<LabConfig>): void {
    if (this.#disposed) return;
    this.#active?.port.applyConfig(config);
    this.#config = cloneConfig(config);
  }

  start(): void {
    if (this.#disposed || !this.#active) return;
    this.#active.port.start();
    this.#runIntent = true;
  }

  pause(): void {
    if (this.#disposed) return;
    this.#runIntent = false;
    this.#active?.port.pause();
  }

  reset(): void { if (!this.#disposed) this.#active?.port.reset(); }

  resize(target: RendererTarget): void {
    this.#target = target;
    if (!this.#disposed) this.#active?.port.resize?.(target);
  }

  getStatus(): RendererStatus {
    if (!this.#disposed && this.#active && !this.#pending) return this.#active.port.getStatus();
    const active = this.#disposed ? null : this.#active?.port.getStatus();
    return { requested: this.#pending?.requested ?? this.#requested,
      actual: active?.actual ?? 'unavailable', running: active?.running ?? false,
      gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null, fps: null };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#release(this.#pending?.candidate ?? null);
    this.#pending = null;
    this.#release(this.#active);
    this.#active = null;
  }
}
