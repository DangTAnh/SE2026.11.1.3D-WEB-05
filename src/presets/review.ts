/**
 * Preset review workflow (BT3 / VT-123).
 *
 * A read/approve-only reviewer role over an immutable preset document. The
 * repository has no server, auth or persistence (docs/architecture.md §1), so
 * this module models the *concurrency contract* a future store must preserve;
 * `ReviewActor` is an authorization input, never an authenticated principal.
 *
 * The risky sequence is read → await → write: the content digest is computed
 * asynchronously, so a concurrent submission can land between the reviewer's
 * read and the status change. Every committed review therefore re-checks the
 * exact revision and content hash it read (optimistic compare-and-swap).
 *
 * Reuses `serializePresetDocument` for validation and canonical identity. The
 * benchmark `configHash` is deliberately not reused: it excludes the preset
 * envelope, name, color and backend preference, which are part of the artifact
 * a reviewer approves.
 */
import { parsePresetDocument, serializePresetDocument, type PresetDocument } from './preset.ts';

export type ReviewRole = 'editor' | 'reviewer';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewErrorCode = 'forbidden-role' | 'not-reviewable' | 'stale-version' | 'content-changed';

/** Supplied by the caller; a server must derive this from authentication. */
export interface ReviewActor {
  readonly id: string;
  readonly role: ReviewRole;
}

/** Immutable revision. `document` is deeply frozen; review metadata is separate. */
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

/** Canonical document string → content digest. Injectable for harnesses/tests. */
export type ContentHasher = (canonical: string) => Promise<string>;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

export interface PresetReviewBoardOptions {
  /** Defaults to SHA-256. Tests inject a deterministic or gated hasher. */
  readonly hash?: ContentHasher;
}

/**
 * In-memory review board for one preset. `submit` is editor-only; `approve` and
 * `reject` are reviewer-only and never change the document, hash or version.
 */
export class PresetReviewBoard {
  #revision: PresetRevision | null = null;
  readonly #hash: ContentHasher;

  constructor(options: PresetReviewBoardOptions = {}) {
    this.#hash = options.hash ?? sha256;
  }

  /** Current revision, deeply frozen. Any role may read. */
  read(): Readonly<PresetRevision> | null {
    return this.#revision;
  }

  /**
   * Creates a new revision from an editor's validated document. `baseVersion`
   * is the version the editor read; a mismatch after the async hash means
   * another submission won and this one is refused.
   */
  async submit(
    actor: ReviewActor,
    document: PresetDocument,
    baseVersion: number,
  ): Promise<Readonly<PresetRevision>> {
    if (actor.role !== 'editor') {
      throw new ReviewError('forbidden-role', 'only an editor may submit preset content');
    }

    // Validate and canonicalize before the await so invalid data cannot reach
    // the store, and store an independent copy the caller cannot mutate.
    const canonical = serializePresetDocument(document);
    const stored = deepFreeze(parsePresetDocument(canonical));
    const contentHash = await this.#hash(canonical);

    // Re-read after the await: the version the editor based this on may be gone.
    const currentVersion = this.#revision?.version ?? 0;
    if (currentVersion !== baseVersion) {
      throw new ReviewError(
        'stale-version',
        `revision ${baseVersion} is no longer current (current ${currentVersion})`,
      );
    }

    const next = deepFreeze<PresetRevision>({
      version: baseVersion + 1,
      document: stored,
      contentHash,
      status: 'pending',
      submittedBy: actor.id,
      reviewedBy: null,
      reviewNote: null,
    });
    this.#revision = next;
    return next;
  }

  /** Approves the exact revision the reviewer read. */
  approve(
    actor: ReviewActor,
    version: number,
    contentHash: string,
    note: string | null = null,
  ): Promise<Readonly<PresetRevision>> {
    return this.#review(actor, version, contentHash, 'approved', note);
  }

  /** Rejects the exact revision the reviewer read. */
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
    status: 'approved' | 'rejected',
    note: string | null,
  ): Promise<Readonly<PresetRevision>> {
    if (actor.role !== 'reviewer') {
      throw new ReviewError('forbidden-role', 'only a reviewer may approve or reject');
    }
    const target = this.#revision;
    if (target === null) {
      throw new ReviewError('not-reviewable', 'there is no revision to review');
    }
    if (target.status !== 'pending') {
      throw new ReviewError('not-reviewable', `revision ${target.version} is already ${target.status}`);
    }
    if (target.version !== version) {
      throw new ReviewError('stale-version', `revision ${version} is not current`);
    }

    // The reviewer's claim is checked against the stored content after the
    // await; this is where a concurrent submission can invalidate the review.
    const confirmed = await this.#hash(serializePresetDocument(target.document));
    const current = this.#revision;
    if (
      current === null
      || current !== target
      || current.status !== 'pending'
      || current.contentHash !== contentHash
      || confirmed !== contentHash
    ) {
      throw new ReviewError(
        'content-changed',
        'the reviewed revision is no longer the current content',
      );
    }

    const next = deepFreeze<PresetRevision>({
      ...current,
      status,
      reviewedBy: actor.id,
      reviewNote: note,
    });
    this.#revision = next;
    return next;
  }
}
