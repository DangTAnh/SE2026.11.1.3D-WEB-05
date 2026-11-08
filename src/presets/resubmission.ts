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

/** VT122 baseline: every resubmission reaches the port; the tests specify the missing guard. */
export class PresetSaveService {
  constructor(private readonly port: PresetSavePort, _options: PresetSaveOptions = {}) {}

  save(requestId: string, document: PresetDocument): Promise<PresetSaveReceipt> {
    const canonical = serializePresetDocument(document);
    return this.port.save({ requestId, canonical });
  }

  confirmed(_requestId: string): PresetSaveReceipt | undefined {
    return undefined;
  }
}
