import { parsePresetDocument, type PresetDocument } from './preset.ts';

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

/**
 * Validates independent JSON texts; accepted documents are returned in memory,
 * never applied to a renderer or persisted. Envelope/size failures reject the
 * whole call before processing; record failures produce indexed outcomes.
 */
export function importPresetBatch(inputs: readonly unknown[]): BatchImportResult {
  if (!Array.isArray(inputs)) throw new TypeError('Preset batch must be an array');
  if (inputs.length > 100) throw new RangeError('Preset batch exceeds 100 records');

  // Snapshot/densify so even sparse input slots receive exactly one outcome.
  const records: unknown[] = Array.from(inputs);
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const record of records) {
    if (typeof record !== 'string') continue;
    // UTF-16 length is a lower bound on UTF-8 bytes; avoid encoding huge inputs.
    if (record.length > 1_000_000 - bytes) throw new RangeError('Preset batch exceeds 1000000 UTF-8 bytes');
    bytes += encoder.encode(record).byteLength;
    if (bytes > 1_000_000) throw new RangeError('Preset batch exceeds 1000000 UTF-8 bytes');
  }

  let acceptedCount = 0;
  const items: BatchImportItem[] = records.map((record, index) => {
    try {
      if (typeof record !== 'string') throw new TypeError('Preset record must be JSON text');
      const document = parsePresetDocument(record);
      acceptedCount++;
      return { index, status: 'accepted', document };
    } catch (error) {
      return { index, status: 'rejected',
        reason: error instanceof Error ? error.message : 'Invalid preset record' };
    }
  });
  const rejectedCount = items.length - acceptedCount;
  const state: BatchImportState = items.length === 0 ? 'EMPTY'
    : acceptedCount === 0 ? 'ERROR_ONLY'
      : rejectedCount === 0 ? 'VALID_ONLY' : 'MIXED';
  return { state, acceptedCount, rejectedCount, items };
}

