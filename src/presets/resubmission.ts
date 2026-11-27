import { serializePresetDocument, type PresetDocument } from './preset.ts';

export interface PresetSaveRequest {
  readonly requestId: string;
  readonly canonical: string;
}

export interface PresetSaveReceipt extends PresetSaveRequest {
  readonly committed: true;
}

export interface PresetSavePort {
  save(request: PresetSaveRequest): Promise<PresetSaveReceipt>;
}

export class SaveConflictError extends Error {
  constructor(requestId: string) {
    super(`requestId "${requestId}" is already bound to different content`);
    this.name = 'SaveConflictError';
  }
}

export interface PresetSaveOptions {
  readonly retentionMs?: number;
  readonly now?: () => number;
}

interface Entry {
  readonly canonical: string;
  state: 'pending' | 'committed' | 'failed';
  expiresAt: number;
  receipt?: PresetSaveReceipt;
  pending?: Promise<PresetSaveReceipt>;
}

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The caller owns the stable requestId; this guard owns replay and conflict checks. */
export class PresetSaveService {
  readonly #port: PresetSavePort;
  readonly #retention: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(port: PresetSavePort, options: PresetSaveOptions = {}) {
    this.#port = port;
    this.#retention = options.retentionMs ?? DEFAULT_RETENTION_MS;
    this.#now = options.now ?? Date.now;
    if (!Number.isInteger(this.#retention) || this.#retention < 1 || this.#retention > MAX_RETENTION_MS) {
      throw new RangeError('retentionMs must be an integer in 1..604800000');
    }
  }

  async save(requestId: string, document: PresetDocument): Promise<PresetSaveReceipt> {
    assertRequestId(requestId);
    const canonical = serializePresetDocument(document);
    const now = this.#now();
    let entry = this.#entries.get(requestId);

    if (entry && entry.state !== 'pending' && this.#expired(entry, now)) {
      this.#entries.delete(requestId);
      entry = undefined;
    }

    if (entry) {
      if (entry.canonical !== canonical) throw new SaveConflictError(requestId);
      if (entry.receipt) return entry.receipt;
      if (entry.pending) return entry.pending;
    }

    const target: Entry = entry ?? { canonical, state: 'pending', expiresAt: 0 };
    target.state = 'pending';
    this.#entries.set(requestId, target);

    const pending = Promise.resolve()
      .then(() => this.#port.save(Object.freeze({ requestId, canonical })))
      .then(receipt => {
        if (!isConfirmedReceipt(receipt, requestId, canonical)) {
          throw new Error('save receipt does not confirm this request');
        }
        const confirmed = Object.freeze({ requestId, canonical, committed: true as const });
        target.state = 'committed';
        target.receipt = confirmed;
        target.expiresAt = this.#now() + this.#retention;
        return confirmed;
      })
      .catch(error => {
        target.state = 'failed';
        target.expiresAt = this.#now() + this.#retention;
        throw error;
      })
      .finally(() => {
        target.pending = undefined;
      });

    target.pending = pending;
    return pending;
  }

  confirmed(requestId: string): PresetSaveReceipt | undefined {
    const entry = this.#entries.get(requestId);
    if (!entry?.receipt) return undefined;
    if (this.#expired(entry, this.#now())) {
      this.#entries.delete(requestId);
      return undefined;
    }
    return entry.receipt;
  }

  #expired(entry: Entry, now: number): boolean {
    return now > entry.expiresAt;
  }
}

function assertRequestId(requestId: string): void {
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
    throw new TypeError('requestId must match ^[A-Za-z0-9._:-]{1,128}$');
  }
}

function isConfirmedReceipt(
  receipt: PresetSaveReceipt | undefined,
  requestId: string,
  canonical: string,
): receipt is PresetSaveReceipt {
  return receipt?.committed === true
    && receipt.requestId === requestId
    && receipt.canonical === canonical;
}
