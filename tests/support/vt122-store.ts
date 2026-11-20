import type {
  PresetSavePort,
  PresetSaveReceipt,
  PresetSaveRequest,
} from '../../src/presets/resubmission.ts';

export type StoreFault =
  | 'throw-before-commit'
  | 'throw-after-commit'
  | 'wrong-requestId'
  | 'wrong-canonical'
  | 'uncommitted';

/**
 * Test-only service model. The ledger is intentionally durable for the whole
 * test: the client retention window is a cache policy, not permission to
 * create a second effect. A real adapter must provide the same atomic bind.
 */
export class Vt122Store implements PresetSavePort {
  readonly ledger = new Map<string, PresetSaveReceipt>();
  readonly effects = new Map<string, number>();
  readonly calls: PresetSaveRequest[] = [];

  readonly #faults: readonly StoreFault[];
  readonly #io: () => Promise<void>;

  constructor(faults: readonly StoreFault[] = [], io: () => Promise<void> = async () => {}) {
    this.#faults = faults;
    this.#io = io;
  }

  async save(request: PresetSaveRequest): Promise<PresetSaveReceipt> {
    this.calls.push({ ...request });
    await this.#io();
    const fault = this.#faults[this.calls.length - 1];
    if (fault === 'throw-before-commit') throw new Error('temporary failure before commit');

    const previous = this.ledger.get(request.requestId);
    if (previous && previous.canonical !== request.canonical) {
      throw new Error('store key conflict');
    }

    const receipt = previous ?? Object.freeze({
      requestId: request.requestId,
      canonical: request.canonical,
      committed: true as const,
    });
    if (!previous) {
      this.ledger.set(request.requestId, receipt);
      this.effects.set(request.requestId, (this.effects.get(request.requestId) ?? 0) + 1);
    }

    if (fault === 'throw-after-commit') throw new Error('committed but response lost');
    if (fault === 'wrong-requestId') return Object.freeze({ ...receipt, requestId: 'wrong-request' });
    if (fault === 'wrong-canonical') return Object.freeze({ ...receipt, canonical: 'wrong-canonical' });
    if (fault === 'uncommitted') {
      return Object.freeze({ ...receipt, committed: false as unknown as true });
    }
    return Object.freeze({ ...receipt });
  }

  seed(requestId: string, canonical: string): PresetSaveReceipt {
    const receipt = Object.freeze({ requestId, canonical, committed: true as const });
    this.ledger.set(requestId, receipt);
    this.effects.set(requestId, 1);
    return receipt;
  }

  effectCount(requestId: string): number {
    return this.effects.get(requestId) ?? 0;
  }
}
