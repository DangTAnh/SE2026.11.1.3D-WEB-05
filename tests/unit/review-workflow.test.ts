/**
 * BT3 / VT-123 — preset review workflow.
 *
 * Risk focus: two requests changing the same preset concurrently. The suite
 * mixes deterministic interleavings (a gated hasher forces the read/await/write
 * order) with 40-task stress runs. Assertions are over the set of outcomes, not
 * over completion order, so scheduler order cannot change the result.
 */
import { expect, test } from 'vitest';
import {
  PresetReviewBoard,
  ReviewError,
  type ReviewActor,
} from '../../src/presets/review.ts';
import {
  DEFAULT_CONFIG,
  cloneConfig,
  serializePresetDocument,
  type PresetDocument,
} from '../../src/presets/preset.ts';

const editor: ReviewActor = { id: 'editor-ana', role: 'editor' };
const reviewer: ReviewActor = { id: 'reviewer-bao', role: 'reviewer' };

/** Deterministic content identity for tests: no crypto, no clock, no random. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const hashCanonical = async (text: string): Promise<string> => `fnv1a-${fnv1a(text)}`;

/** Valid v2 documents that differ only in simulation.particleCount and name. */
function documentFor(index: number, name?: string): PresetDocument {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.simulation.particleCount = 1000 + index * 1000;
  return { schemaVersion: 2, app: '3D-WEB-05', ...(name === undefined ? {} : { name }), config };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

test('[T01] a reviewer cannot submit preset content', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });

  await expect(board.submit(reviewer, documentFor(1), 0))
    .rejects.toMatchObject({ code: 'forbidden-role' });
  expect(board.read()).toBeNull();
});

test('[T02] read returns a deeply frozen snapshot and cannot mutate stored content', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  const stored = documentFor(2);
  await board.submit(editor, stored, 0);

  const snapshot = board.read();
  expect(snapshot).not.toBeNull();
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot!.document)).toBe(true);
  expect(Object.isFrozen(snapshot!.document.config.simulation)).toBe(true);

  expect(() => {
    (snapshot!.document.config.simulation as { particleCount: number }).particleCount = 999;
  }).toThrow(TypeError);
  expect(board.read()!.document.config.simulation.particleCount)
    .toBe(stored.config.simulation.particleCount);
});

test('[T03] a reviewer approves the exact revision without changing its content', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(3, 'approved-preset'), 0);
  const pending = board.read()!;

  const approved = await board.approve(reviewer, pending.version, pending.contentHash, 'looks good');

  expect(approved.status).toBe('approved');
  expect(approved.reviewedBy).toBe(reviewer.id);
  expect(approved.reviewNote).toBe('looks good');
  expect(approved.version).toBe(pending.version);
  expect(approved.contentHash).toBe(pending.contentHash);
  expect(approved.document).toEqual(pending.document);
});

test('[T04] an editor cannot approve', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(4), 0);
  const pending = board.read()!;

  await expect(board.approve(editor, pending.version, pending.contentHash))
    .rejects.toMatchObject({ code: 'forbidden-role' });
});

test('[T05] approval with a wrong content hash is rejected and changes nothing', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(5), 0);
  const pending = board.read()!;

  await expect(board.approve(reviewer, pending.version, 'fnv1a-deadbeef'))
    .rejects.toMatchObject({ code: 'content-changed' });
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();
});

test('[T06] two concurrent submissions from the same base have exactly one winner', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  const documents = [documentFor(6, 'first'), documentFor(7, 'second')];

  const outcomes = await Promise.allSettled(
    documents.map((document) => board.submit(editor, document, 0)),
  );

  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
  expect(rejected).toHaveLength(1);
  expect(rejected[0]!.reason).toMatchObject({ code: 'stale-version' });

  const winnerIndex = outcomes.findIndex((outcome) => outcome.status === 'fulfilled');
  expect(board.read()!.version).toBe(1);
  expect(board.read()!.document.name).toBe(documents[winnerIndex]!.name);
});

test('[T07] forty concurrent submissions from the same base have exactly one winner', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  const documents = Array.from({ length: 40 }, (_, index) => documentFor(index + 1, `task-${index + 1}`));

  const outcomes = await Promise.allSettled(
    documents.map((document) => board.submit(editor, document, 0)),
  );

  const winners = outcomes.flatMap((outcome, index) => (outcome.status === 'fulfilled' ? [index] : []));
  expect(winners).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(39);
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ code: 'stale-version' });
  }
  expect(board.read()!.version).toBe(1);
  expect(board.read()!.document.name).toBe(documents[winners[0]!]!.name);
});

test('[T08] forty concurrent approvals accept exactly one review', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(8), 0);
  const pending = board.read()!;
  const reviewers = Array.from({ length: 40 }, (_, index): ReviewActor => ({
    id: `reviewer-${index + 1}`, role: 'reviewer',
  }));

  const outcomes = await Promise.allSettled(
    reviewers.map((actor) => board.approve(actor, pending.version, pending.contentHash)),
  );

  const accepted = outcomes.filter((outcome) => outcome.status === 'fulfilled');
  expect(accepted).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(39);
  expect(board.read()!.status).toBe('approved');
  expect(board.read()!.document).toEqual(pending.document);
});

test('[T09] a stale approval cannot land after a concurrent submission', async () => {
  const gates: { promise: Promise<string>; resolve: (value: string) => void }[] = [];
  const gatedHash = (): Promise<string> => {
    const gate = deferred<string>();
    gates.push(gate);
    return gate.promise;
  };
  const board = new PresetReviewBoard({ hash: gatedHash });

  const versionOne = documentFor(9, 'version-one');
  const seeded = board.submit(editor, versionOne, 0);
  gates[0]!.resolve(await hashCanonical(serializePresetDocument(versionOne)));
  const pending = await seeded;

  // The reviewer read version 1; both requests are now paused inside their await.
  const approval = board.approve(reviewer, pending.version, pending.contentHash, 'looks good');
  const versionTwo = documentFor(10, 'version-two');
  const submission = board.submit(editor, versionTwo, pending.version);
  expect(gates).toHaveLength(3);

  gates[2]!.resolve(await hashCanonical(serializePresetDocument(versionTwo)));
  await submission;
  gates[1]!.resolve(await hashCanonical(serializePresetDocument(versionOne)));

  await expect(approval).rejects.toMatchObject({ code: 'content-changed' });
  const final = board.read()!;
  expect(final.version).toBe(2);
  expect(final.status).toBe('pending');
  expect(final.document.name).toBe('version-two');
});

test('[T10] a failing hasher leaves the board unchanged', async () => {
  let fail = false;
  const switchable = async (text: string): Promise<string> => {
    if (fail) throw new Error('store offline');
    return hashCanonical(text);
  };
  const board = new PresetReviewBoard({ hash: switchable });

  fail = true;
  await expect(board.submit(editor, documentFor(11), 0)).rejects.toThrow('store offline');
  expect(board.read()).toBeNull();

  fail = false;
  await board.submit(editor, documentFor(11), 0);
  const pending = board.read()!;
  fail = true;
  await expect(board.approve(reviewer, pending.version, pending.contentHash)).rejects.toThrow('store offline');
  expect(board.read()).toEqual(pending);
});

test('[T11] an invalid document is refused before any state change', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  const invalid = documentFor(12);
  invalid.config.simulation.particleCount = 999;

  await expect(board.submit(editor, invalid, 0)).rejects.toThrow();
  expect(board.read()).toBeNull();
});

test('[T12] a reviewer can reject with a reason without mutating content', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(13), 0);
  const pending = board.read()!;

  const rejected = await board.reject(reviewer, pending.version, pending.contentHash, 'needs tuning');

  expect(rejected.status).toBe('rejected');
  expect(rejected.reviewedBy).toBe(reviewer.id);
  expect(rejected.reviewNote).toBe('needs tuning');
  expect(rejected.document).toEqual(pending.document);
});

test('[T13] an already-reviewed revision cannot be reviewed again', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(14), 0);
  const pending = board.read()!;
  await board.approve(reviewer, pending.version, pending.contentHash);

  await expect(board.reject(reviewer, pending.version, pending.contentHash, 'late'))
    .rejects.toMatchObject({ code: 'not-reviewable' });
});

test('[T14] mixed concurrent submissions and approvals keep version/content invariants', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(15, 'seed'), 0);
  const seed = board.read()!;

  const submissions = Array.from({ length: 20 }, (_, index) =>
    board.submit(editor, documentFor(index + 16, `chaos-${index + 1}`), seed.version));
  const approvals = Array.from({ length: 20 }, (_, index) =>
    board.approve({ id: `reviewer-${index + 1}`, role: 'reviewer' }, seed.version, seed.contentHash));

  const outcomes = await Promise.allSettled([...submissions, ...approvals]);
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') expect(outcome.reason).toBeInstanceOf(ReviewError);
  }

  const final = board.read()!;
  expect(Number.isInteger(final.version)).toBe(true);
  expect(final.version).toBeGreaterThanOrEqual(1);
  expect(final.contentHash).toBe(await hashCanonical(serializePresetDocument(final.document)));
  if (final.status === 'pending') {
    expect(final.reviewedBy).toBeNull();
  } else {
    expect(final.reviewedBy).toMatch(/^reviewer-/);
  }
});

test('[T15] canonical serialization pins the review identity independent of key order', () => {
  const first = documentFor(17, 'ordered');
  const second: PresetDocument = {
    name: 'ordered',
    app: '3D-WEB-05',
    schemaVersion: 2,
    config: {
      camera: { ...first.config.camera },
      rendering: { ...first.config.rendering },
      modes: { vortex: { ...first.config.modes.vortex }, attractor: { ...first.config.modes.attractor } },
      simulation: { ...first.config.simulation },
      backendPreference: first.config.backendPreference,
      mode: first.config.mode,
    },
  };

  expect(serializePresetDocument(second)).toBe(serializePresetDocument(first));
});

test('[T16] the default SHA-256 hasher gives a stable 64-hex identity', async () => {
  const board = new PresetReviewBoard();
  await board.submit(editor, documentFor(18, 'sha'), 0);
  const pending = board.read()!;

  expect(pending.contentHash).toMatch(/^[0-9a-f]{64}$/);
  const approved = await board.approve(reviewer, pending.version, pending.contentHash);
  expect(approved.status).toBe('approved');
  expect(approved.contentHash).toBe(pending.contentHash);
});

test('[T17] reviewing an empty board is refused', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });

  await expect(board.approve(reviewer, 1, 'fnv1a-00000000'))
    .rejects.toMatchObject({ code: 'not-reviewable' });
});

test('[T18] a wrong version is refused before the review starts', async () => {
  const board = new PresetReviewBoard({ hash: hashCanonical });
  await board.submit(editor, documentFor(19), 0);
  const pending = board.read()!;

  await expect(board.approve(reviewer, pending.version + 1, pending.contentHash))
    .rejects.toMatchObject({ code: 'stale-version' });
  expect(board.read()!.status).toBe('pending');
});
