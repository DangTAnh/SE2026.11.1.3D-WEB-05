/**
 * Test-first scaffold for BT3 / VT-123.
 *
 * This file exists only so the new tests can import a real module and fail on
 * behaviour instead of on a missing import. It deliberately omits the
 * authorization checks, the version/content-hash compare-and-swap, the
 * independent frozen copy and the post-await re-check. The next commit
 * replaces the method bodies with the actual contract.
 */
import { serializePresetDocument, type PresetDocument } from './preset.ts';

export type ReviewRole = 'editor' | 'reviewer';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewErrorCode =
  | 'forbidden-role'
  | 'not-reviewable'
  | 'stale-version'
  | 'content-changed';

/** Supplied by the caller; a server must derive this from authentication. */
export interface ReviewActor {
  readonly id: string;
  readonly role: ReviewRole;
}

/** Immutable revision. `document` is deeply frozen by the real implementation. */
export interface PresetRevision {
  readonly version: number;
  readonly document: Readonly<PresetDocument>;
  readonly contentHash: string;
  readonly status: ReviewStatus;
  readonly submittedBy: string;
  readonly reviewedBy: string | null;
  readonly reviewNote: string | null;
}

export class ReviewError extends Error {
  readonly code: ReviewErrorCode;

  constructor(code: ReviewErrorCode, message: string) {
    super(message);
    this.name = 'ReviewError';
    this.code = code;
  }
}

/** Canonical document string → content digest. Injectable for tests. */
export type ContentHasher = (canonical: string) => Promise<string>;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface PresetReviewBoardOptions {
  /** Defaults to SHA-256. Tests inject a deterministic or gated hasher. */
  readonly hash?: ContentHasher;
}

export class PresetReviewBoard {
  #revision: PresetRevision | null = null;
  readonly #hash: ContentHasher;

  constructor(options: PresetReviewBoardOptions = {}) {
    this.#hash = options.hash ?? sha256;
  }

  read(): Readonly<PresetRevision> | null {
    return this.#revision;
  }

  async submit(
    actor: ReviewActor,
    document: PresetDocument,
    baseVersion: number,
  ): Promise<Readonly<PresetRevision>> {
    const contentHash = await this.#hash(serializePresetDocument(document));
    const next: PresetRevision = {
      version: baseVersion + 1,
      document,
      contentHash,
      status: 'pending',
      submittedBy: actor.id,
      reviewedBy: null,
      reviewNote: null,
    };
    this.#revision = next;
    return next;
  }

  approve(
    actor: ReviewActor,
    version: number,
    contentHash: string,
    note: string | null = null,
  ): Promise<Readonly<PresetRevision>> {
    return this.#review(actor, version, contentHash, 'approved', note);
  }

  reject(
    actor: ReviewActor,
    version: number,
    contentHash: string,
    note: string | null = null,
  ): Promise<Readonly<PresetRevision>> {
    return this.#review(actor, version, contentHash, 'rejected', note);
  }

  async #review(
    actor: ReviewActor,
    _version: number,
    _contentHash: string,
    status: ReviewStatus,
    note: string | null,
  ): Promise<Readonly<PresetRevision>> {
    const target = this.#revision;
    if (target === null) {
      throw new ReviewError('not-reviewable', 'there is no revision to review');
    }
    const next: PresetRevision = {
      ...target,
      status,
      reviewedBy: actor.id,
      reviewNote: note,
    };
    this.#revision = next;
    return next;
  }
}
