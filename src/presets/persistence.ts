import { serializePresetDocument, type PresetDocument } from './preset.ts';

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
interface Operation {
  readonly canonical: string;
  pending?: Promise<SaveReceipt>;
  receipt?: SaveReceipt;
}
/** In-process coordinator. Durable dedupe belongs to the adapter/service. */
export class PresetPersistenceClient {
  readonly #operations = new Map<string, Operation>();
  readonly #attempts: number;
  readonly #delay: number;
  readonly #wait: (milliseconds: number) => Promise<void>;
  constructor(private readonly port: PresetPersistencePort, policy: RetryPolicy = {}) {
    this.#attempts = policy.maxAttempts ?? 3;
    this.#delay = policy.delayMs ?? 5;
    if (!Number.isInteger(this.#attempts) || this.#attempts < 1 || this.#attempts > 8) {
      throw new RangeError('maxAttempts must be an integer in 1..8');
    }
    if (!Number.isInteger(this.#delay) || this.#delay < 0 || this.#delay > 1000) {
      throw new RangeError('delayMs must be an integer in 0..1000');
    }
    this.#wait = policy.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }
  confirmed(key: string): SaveReceipt | undefined { return this.#operations.get(key)?.receipt; }
  async save(key: string, document: PresetDocument): Promise<SaveReceipt> {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(key)) throw new TypeError('invalid operation key');
    const canonical = serializePresetDocument(document);
    let operation = this.#operations.get(key);
    if (operation && operation.canonical !== canonical) throw new Error('operation key already bound to different content');
    if (!operation) {
      operation = { canonical };
      this.#operations.set(key, operation);
    }
    if (operation.receipt) return operation.receipt;
    if (operation.pending) return operation.pending;
    const entry = operation;
    entry.pending = this.#execute(Object.freeze({key, canonical})).then(receipt => {
      entry.receipt = receipt;
      return receipt;
    }).finally(() => { entry.pending = undefined; });
    return entry.pending;
  }
  async #execute(request: SaveRequest): Promise<SaveReceipt> {
    for (let attempt = 1; ; attempt++) {
      try {
        const receipt = await this.port.write(request);
        if (receipt?.committed !== true || receipt.key !== request.key || receipt.canonical !== request.canonical) {
          throw new Error('persistence receipt does not confirm this operation');
        }
        return Object.freeze({ ...request, committed: true });
      } catch (error) {
        if (!(error instanceof TemporaryPersistenceError) || attempt >= this.#attempts) throw error;
        await this.#wait(this.#delay * attempt);
      }
    }
  }
}
