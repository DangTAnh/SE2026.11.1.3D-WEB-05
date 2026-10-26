import type { RendererPort } from '../core/renderer/RendererPort.ts';
import type { ActualBackend, BackendPreference } from '../core/types/backend.ts';

/** Application callback result; does not extend RendererPort/RendererStatus. */
export interface BackendSwitchResult {
  outcome: 'applied' | 'failed' | 'superseded';
  requested: BackendPreference;
  actual: ActualBackend;
  retainedPrevious: boolean;
}

/** A candidate owns its staged surface until commit, or discard on failure. */
export interface RendererCandidate {
  readonly port: RendererPort;
  commit(): void;
  discard(): void;
}
