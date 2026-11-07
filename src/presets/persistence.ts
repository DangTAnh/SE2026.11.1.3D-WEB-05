import type { PresetDocument } from './preset.ts';

export interface SaveRequest { readonly key: string; readonly canonical: string }
export interface SaveReceipt extends SaveRequest { readonly committed: true }
/** Adapter contract: atomically bind key to payload + effect; replay matching receipt. */
export interface PresetPersistencePort { write(request: SaveRequest): Promise<SaveReceipt> }
export class TemporaryPersistenceError extends Error {}
export interface RetryPolicy {
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}
export class PresetPersistenceClient {
  constructor(_port: PresetPersistencePort, _policy: RetryPolicy = {}) {}
  confirmed(_key: string): SaveReceipt | undefined { return undefined; }
  async save(_key: string, _document: PresetDocument): Promise<SaveReceipt> {
    throw new Error('VT120: retry persistence not implemented');
  }
}
