import { TemporaryPersistenceError, type PresetPersistencePort, type SaveReceipt, type SaveRequest } from '../../src/presets/persistence.ts';

export type Fault = 'before' | 'after' | 'permanent' | 'ok' | 'bad-receipt';
/** Test-only service model. Ledger+effect commit synchronously after injected I/O. */
export class Vt120Service implements PresetPersistencePort {
  readonly ledger = new Map<string, SaveReceipt>();
  readonly effects = new Map<string, number>();
  readonly calls: SaveRequest[] = [];
  readonly attempts = new Map<string, number>();
  constructor(
    private readonly faults: (key: string) => readonly Fault[] = () => [],
    private readonly io: () => Promise<void> = async () => {},
  ) {}
  async write(request: SaveRequest): Promise<SaveReceipt> {
    this.calls.push({ ...request });
    const attempt = this.attempts.get(request.key) ?? 0;
    this.attempts.set(request.key, attempt + 1);
    await this.io();
    const fault = this.faults(request.key)[attempt] ?? 'ok';
    if (fault === 'before') throw new TemporaryPersistenceError('temporary before commit');
    if (fault === 'permanent') throw new Error('permanent rejection');
    const previous = this.ledger.get(request.key);
    if (previous && previous.canonical !== request.canonical) throw new Error('service key conflict');
    const receipt = previous ?? Object.freeze({ ...request, committed: true as const });
    if (!previous) {
      this.ledger.set(request.key, receipt);
      this.effects.set(request.key, (this.effects.get(request.key) ?? 0) + 1);
    }
    if (fault === 'after') throw new TemporaryPersistenceError('committed but response lost');
    if (fault === 'bad-receipt') return { ...receipt, key: 'wrong-operation' };
    return receipt;
  }
}
