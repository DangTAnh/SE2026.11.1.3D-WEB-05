import type { PresetDocument } from './preset.ts';

export type BatchImportState = 'EMPTY' | 'VALID_ONLY' | 'ERROR_ONLY' | 'MIXED';
export type BatchImportItem =
  | { readonly index: number; readonly status: 'accepted'; readonly document: PresetDocument }
  | { readonly index: number; readonly status: 'rejected'; readonly reason: string };
export interface BatchImportResult {
  readonly state: BatchImportState;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly items: readonly BatchImportItem[];
}

/** RED contract stub only; no bulk behavior exists at this checkpoint. */
export function importPresetBatch(_inputs: readonly unknown[]): BatchImportResult {
  throw new Error('VT124 bulk import not implemented');
}

