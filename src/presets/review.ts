/**
 * Preset review workflow for BT3 / VT-123.
 *
 * A revision is immutable. A review changes only the status and review
 * metadata; the document, its digest and the version stay identical. Writes
 * use optimistic concurrency control: the caller states the exact revision it
 * read, and the board re-checks that identity after the asynchronous digest
 * completes. A concurrent writer therefore produces `stale-version` or
 * `content-changed`, never a silent overwrite.
 *
 * The board is in-process. A real deployment must persist the conditional
 * write and derive `ReviewActor` from authentication; see spec.md §7.
 */
import {
  parsePresetDocument,
  serializePresetDocument,
  type PresetDocument,
} from './preset.ts';

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

/** Immutable revision. The document and the wrapper are deeply frozen. */
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

/** The document is plain JSON data, so a recursive freeze is sufficient. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
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
    if (actor.role !== 'editor') {
      throw new ReviewError('forbidden-role', 'only an editor may submit a revision');
    }

    // Validates and captures the bytes before the await; a later mutation of
    // the caller's object cannot change what is written.
    const canonical = serializePresetDocument(document);
    const copy = deepFreeze(parsePresetDocument(canonical));
    const contentHash = await this.#hash(canonical);

    // Post-await re-check: another submission may have committed meanwhile.
    const currentVersion = this.#revision?.version ?? 0;
    if (currentVersion !== baseVersion) {
      throw new ReviewError(
        'stale-version',
        `expected base version ${baseVersion}, found ${currentVersion}`,
      );
    }

    const next = Object.freeze<PresetRevision>({
      version: baseVersion + 1,
      document: copy,
      contentHash,
      status: 'pending',
      submittedBy: actor.id,
      reviewedBy: null,
      reviewNote: null,
    });
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
    version: number,
    contentHash: string,
    status: ReviewStatus,
    note: string | null,
  ): Promise<Readonly<PresetRevision>> {
    if (actor.role !== 'reviewer') {
      throw new ReviewError('forbidden-role', 'only a reviewer may review a revision');
    }

    const target = this.#revision;
    if (target === null) {
      throw new ReviewError('not-reviewable', 'there is no revision to review');
    }
    if (target.version !== version) {
      throw new ReviewError('stale-version', `revision ${version} is not current`);
    }
    if (target.contentHash !== contentHash) {
      throw new ReviewError('content-changed', 'the presented digest does not match the revision');
    }
    if (target.status !== 'pending') {
      throw new ReviewError('not-reviewable', `revision is already ${target.status}`);
    }

    const digest = await this.#hash(serializePresetDocument(target.document as PresetDocument));

    // Post-await re-check: this is the window a concurrent write can enter.
    const current = this.#revision;
    if (current === null) {
      throw new ReviewError('not-reviewable', 'the revision disappeared during review');
    }
    if (current.version !== target.version) {
      throw new ReviewError('stale-version', 'a newer revision was submitted during review');
    }
    if (current.contentHash !== target.contentHash || digest !== target.contentHash) {
      throw new ReviewError('content-changed', 'the revision content changed during review');
    }
    if (current.status !== 'pending') {
      throw new ReviewError('not-reviewable', `revision is already ${current.status}`);
    }

    // Only review metadata changes; document, digest and version are reused.
    const next = Object.freeze<PresetRevision>({
      ...current,
      status,
      reviewedBy: actor.id,
      reviewNote: note,
    });
    this.#revision = next;
    return next;
  }
}
