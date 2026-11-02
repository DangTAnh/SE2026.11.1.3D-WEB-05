import { parsePresetDocument, type PresetDocument } from './preset.ts';

/** Config committed, but a subsequent simulation reset failed. Not apply rejection. */
export class CommittedPresetError extends Error {}

/** Client-module ownership capability only: no server/accounts authorization. */
export function createImportUndo(owner: symbol, getDocument: () => PresetDocument, apply: (document: PresetDocument) => void) {
  let previous: PresetDocument | undefined;
  const assertAuthorized = (actor: symbol): void => {
    if (actor !== owner) throw new Error('Unauthorized preset session.');
  };
  const applyRecoverably = (next: PresetDocument, before: PresetDocument): void => {
    try { apply(structuredClone(next)); }
    catch (error) {
      if (error instanceof CommittedPresetError) throw error;
      try { apply(structuredClone(before)); }
      catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Không thể áp dụng hoặc khôi phục preset; cấu hình renderer có thể không nhất quán.');
      }
      throw error;
    }
  };
  return {
    importText(actor: symbol, text: string): void {
      assertAuthorized(actor);
      const next = parsePresetDocument(text);
      // Validate the snapshot too: Undo must never restore malformed state.
      const snapshot = parsePresetDocument(JSON.stringify(getDocument()));
      try { applyRecoverably(next, snapshot); }
      catch (error) {
        if (error instanceof CommittedPresetError) previous = snapshot;
        throw error;
      }
      previous = snapshot;
    },
    undo(actor: symbol): boolean {
      assertAuthorized(actor);
      if (!previous) return false;
      const before = parsePresetDocument(JSON.stringify(getDocument()));
      try { applyRecoverably(previous, before); }
      catch (error) {
        if (error instanceof CommittedPresetError) previous = undefined;
        throw error;
      }
      previous = undefined;
      return true;
    },
    canUndo(actor: symbol): boolean { assertAuthorized(actor); return previous !== undefined; },
    invalidate(actor: symbol): void { assertAuthorized(actor); previous = undefined; },
  };
}
