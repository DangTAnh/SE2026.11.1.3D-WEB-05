/**
 * BT3 / VT-123 — preset review workflow.
 *
 * Risk focus: two requests changing the same preset concurrently. The race
 * tests start both operations before either digest resolves (a gated hasher),
 * then resolve the digests in a chosen order. Assertions are over outcome
 * sets, not completion order, so the scheduler cannot change the result.
 */
import { expect, test } from 'vitest';
import {
  PresetReviewBoard,
  ReviewError,
  type ContentHasher,
  type ReviewActor,
} from '../../src/presets/review.ts';
import {
  DEFAULT_CONFIG,
  cloneConfig,
  serializePresetDocument,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { configHash } from '../../src/core/measurement/configHash.ts';

const editor: ReviewActor = { id: 'editor-ana', role: 'editor' };
const otherEditor: ReviewActor = { id: 'editor-binh', role: 'editor' };
const reviewer: ReviewActor = { id: 'reviewer-bao', role: 'reviewer' };
const otherReviewer: ReviewActor = { id: 'reviewer-chi', role: 'reviewer' };

/** Valid v2 documents that differ by particle count and optional name. */
function documentFor(index: number, name = `preset-${index}`): PresetDocument {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.simulation.particleCount = 1000 + index * 1000;
  return { schemaVersion: 2, app: '3D-WEB-05', name, config };
}

/** Deterministic content identity for tests: no crypto, clock or randomness. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const deterministicHash: ContentHasher = async (canonical) => `fnv1a-${fnv1a(canonical)}`;

interface Gate {
  readonly canonical: string;
  resolve: (value: string) => void;
}

/**
 * The first phase resolves normally; after `gate()` every digest is held until
 * the test releases it. Both operations can therefore be in flight at once.
 */
function gatedHasher(): {
  hash: ContentHasher;
  gates: Gate[];
  gate: () => void;
  release: (gate: Gate, digest?: string) => void;
} {
  let gated = false;
  const gates: Gate[] = [];
  const hash: ContentHasher = (canonical) => {
    if (!gated) return Promise.resolve(`fnv1a-${fnv1a(canonical)}`);
    return new Promise<string>((resolve) => {
      gates.push({ canonical, resolve });
    });
  };
  return {
    hash,
    gates,
    gate: () => { gated = true; },
    release: (gate, digest) => {
      gate.resolve(digest ?? `fnv1a-${fnv1a(gate.canonical)}`);
    },
  };
}

test('[T01] a reviewer cannot submit preset content', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });

  await expect(board.submit(reviewer, documentFor(1), 0))
    .rejects.toMatchObject({ code: 'forbidden-role' });
  expect(board.read()).toBeNull();
});

test('[T02] an editor cannot approve', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  await board.submit(editor, documentFor(2), 0);
  const pending = board.read()!;

  await expect(board.approve(editor, pending.version, pending.contentHash))
    .rejects.toMatchObject({ code: 'forbidden-role' });
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();
});

test('[T03] a reviewer approves the exact revision without changing content', async () => {
  // Uses the production default SHA-256 hasher; only the outcome is asserted.
  const board = new PresetReviewBoard();
  await board.submit(editor, documentFor(3, 'approved-preset'), 0);
  const pending = board.read()!;
  expect(pending.contentHash).toMatch(/^[0-9a-f]{64}$/);

  const approved = await board.approve(reviewer, pending.version, pending.contentHash, 'looks good');

  expect(approved.status).toBe('approved');
  expect(approved.reviewedBy).toBe(reviewer.id);
  expect(approved.reviewNote).toBe('looks good');
  expect(approved.version).toBe(pending.version);
  expect(approved.contentHash).toBe(pending.contentHash);
  expect(approved.document).toEqual(pending.document);
});

test('[T04] a reviewer rejects without changing content', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  await board.submit(editor, documentFor(4, 'rejected-preset'), 0);
  const pending = board.read()!;

  const rejected = await board.reject(reviewer, pending.version, pending.contentHash, 'not ready');

  expect(rejected.status).toBe('rejected');
  expect(rejected.reviewedBy).toBe(reviewer.id);
  expect(rejected.version).toBe(pending.version);
  expect(rejected.contentHash).toBe(pending.contentHash);
  expect(rejected.document).toEqual(pending.document);
});

test('[T05] read and input cannot mutate stored content', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  const input = documentFor(5);
  const originalCount = input.config.simulation.particleCount;
  await board.submit(editor, input, 0);
  const stored = board.read()!;

  expect(() => { stored.document.config.simulation.particleCount = 999; }).toThrow(TypeError);
  expect(() => { (stored as { status: string }).status = 'approved'; }).toThrow(TypeError);
  expect(board.read()!.document.config.simulation.particleCount).toBe(originalCount);

  input.config.simulation.particleCount = 4242;
  expect(board.read()!.document.config.simulation.particleCount).toBe(originalCount);

  expect(Object.isFrozen(stored)).toBe(true);
  expect(Object.isFrozen(stored.document)).toBe(true);
  expect(Object.isFrozen(stored.document.config.simulation)).toBe(true);
});

test('[T06] approval with a wrong content hash changes nothing', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  await board.submit(editor, documentFor(6), 0);
  const pending = board.read()!;

  await expect(board.approve(reviewer, pending.version, 'fnv1a-deadbeef'))
    .rejects.toMatchObject({ code: 'content-changed' });
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();
});

test('[T07] a stale approval after a newer submission is rejected', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  await board.submit(editor, documentFor(7, 'v1'), 0);
  const v1 = board.read()!;
  await board.submit(editor, documentFor(8, 'v2'), v1.version);
  const v2 = board.read()!;
  expect(v2.version).toBe(2);

  let error: unknown;
  try {
    await board.approve(reviewer, v1.version, v1.contentHash);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ReviewError);
  expect(['stale-version', 'content-changed']).toContain((error as ReviewError).code);
  expect(board.read()!.version).toBe(2);
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();
});

test('[T08] two concurrent submissions from the same base have one winner', async () => {
  for (const winner of [0, 1] as const) {
    const gated = gatedHasher();
    const board = new PresetReviewBoard({ hash: gated.hash });
    gated.gate();
    const first = documentFor(20, 'first');
    const second = documentFor(21, 'second');

    const firstAttempt = board.submit(editor, first, 0);
    const secondAttempt = board.submit(otherEditor, second, 0);
    expect(gated.gates).toHaveLength(2);

    gated.release(gated.gates[winner]!);
    gated.release(gated.gates[1 - winner]!);
    const outcomes = await Promise.allSettled([firstAttempt, secondAttempt]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(ReviewError);
    expect((rejected[0]!.reason as ReviewError).code).toBe('stale-version');

    const final = board.read()!;
    expect(final.version).toBe(1);
    const canonical = serializePresetDocument(final.document as PresetDocument);
    expect([serializePresetDocument(first), serializePresetDocument(second)]).toContain(canonical);
    expect(final.contentHash).toBe(`fnv1a-${fnv1a(canonical)}`);
  }
});

test('[T09] two concurrent approvals leave exactly one review', async () => {
  for (const winner of [0, 1] as const) {
    const gated = gatedHasher();
    const board = new PresetReviewBoard({ hash: gated.hash });
    await board.submit(editor, documentFor(30, 'review-me'), 0);
    const pending = board.read()!;
    gated.gate();

    const firstAttempt = board.approve(reviewer, pending.version, pending.contentHash, 'note-1');
    const secondAttempt = board.approve(otherReviewer, pending.version, pending.contentHash, 'note-2');
    expect(gated.gates).toHaveLength(2);

    gated.release(gated.gates[winner]!);
    gated.release(gated.gates[1 - winner]!);
    const outcomes = await Promise.allSettled([firstAttempt, secondAttempt]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const final = board.read()!;
    expect(final.status).toBe('approved');
    expect([reviewer.id, otherReviewer.id]).toContain(final.reviewedBy);
    expect(final.reviewNote).toBe(final.reviewedBy === reviewer.id ? 'note-1' : 'note-2');
  }
});

test('[T10] a concurrent submit and approval leave a consistent revision', async () => {
  for (const firstOperation of ['approve', 'submit'] as const) {
    const gated = gatedHasher();
    const board = new PresetReviewBoard({ hash: gated.hash });
    await board.submit(editor, documentFor(40, 'v1'), 0);
    const v1 = board.read()!;
    gated.gate();

    // Call order sets the gate order: approve is gate 0, submit is gate 1.
    const approveAttempt = board.approve(reviewer, v1.version, v1.contentHash, 'approve-v1');
    const submitAttempt = board.submit(editor, documentFor(41, 'v2'), v1.version);
    expect(gated.gates).toHaveLength(2);

    const order = firstOperation === 'approve' ? [0, 1] : [1, 0];
    gated.release(gated.gates[order[0]!]!);
    gated.release(gated.gates[order[1]!]!);
    const [approveOutcome, submitOutcome] = await Promise.allSettled([
      approveAttempt,
      submitAttempt,
    ]);
    expect(submitOutcome.status).toBe('fulfilled');

    const final = board.read()!;
    const expected = serializePresetDocument(documentFor(41, 'v2'));
    expect(final.version).toBe(2);
    expect(final.status).toBe('pending');
    expect(serializePresetDocument(final.document as PresetDocument)).toBe(expected);

    if (approveOutcome.status === 'fulfilled') {
      // The reviewer approved the old revision before the new one superseded it.
      expect(approveOutcome.value.version).toBe(1);
      expect(approveOutcome.value.status).toBe('approved');
    } else {
      expect(approveOutcome.reason).toBeInstanceOf(ReviewError);
      expect(['content-changed', 'stale-version', 'not-reviewable'])
        .toContain((approveOutcome.reason as ReviewError).code);
    }
  }
});

test('[T11] invalid documents fail at the module boundary without writing', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });

  const v1 = { ...documentFor(50), schemaVersion: 1 } as unknown as PresetDocument;
  await expect(board.submit(editor, v1, 0)).rejects.toThrow(/Preset v1/);
  expect(board.read()).toBeNull();

  const unknown = documentFor(51) as unknown as {
    schemaVersion: 2;
    app: '3D-WEB-05';
    config: Record<string, unknown>;
  };
  unknown.config.unknownKey = true;
  await expect(board.submit(editor, unknown as unknown as PresetDocument, 0))
    .rejects.toThrow(/không được hỗ trợ/);
  expect(board.read()).toBeNull();

  const bad = documentFor(52);
  bad.config.simulation.particleCount = 0;
  await expect(board.submit(editor, bad, 0)).rejects.toThrow(/particle/);
  expect(board.read()).toBeNull();
});

test('[T12] a failed digest leaves the board unchanged', async () => {
  let fail = false;
  const hash: ContentHasher = async (canonical) => {
    if (fail) throw new Error('digest failed');
    return `fnv1a-${fnv1a(canonical)}`;
  };
  const board = new PresetReviewBoard({ hash });
  await board.submit(editor, documentFor(60), 0);
  const pending = board.read()!;

  fail = true;
  await expect(board.approve(reviewer, pending.version, pending.contentHash))
    .rejects.toThrow('digest failed');
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();

  const empty = new PresetReviewBoard({ hash });
  await expect(empty.submit(editor, documentFor(61), 0)).rejects.toThrow('digest failed');
  expect(empty.read()).toBeNull();
});

test('[T13] a second review of the same revision is refused', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  await board.submit(editor, documentFor(70), 0);
  const pending = board.read()!;
  await board.approve(reviewer, pending.version, pending.contentHash, 'first');

  await expect(board.approve(otherReviewer, pending.version, pending.contentHash, 'second'))
    .rejects.toMatchObject({ code: 'not-reviewable' });
  expect(board.read()!.reviewedBy).toBe(reviewer.id);
  expect(board.read()!.reviewNote).toBe('first');
});

test('[T14] reviewing an empty board is refused', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });

  await expect(board.approve(reviewer, 1, 'fnv1a-empty'))
    .rejects.toMatchObject({ code: 'not-reviewable' });
  expect(board.read()).toBeNull();
});

test('[T17] the review hash covers fields that configHash ignores', async () => {
  const board = new PresetReviewBoard({ hash: deterministicHash });
  const first = documentFor(80, 'color-a');
  const second = documentFor(80, 'color-b');
  second.config.rendering.particleColor = '#ff0000';
  second.config.backendPreference = 'webgl2';

  // The workload hash deliberately ignores name, colour and backend preference.
  expect(await configHash(first.config)).toBe(await configHash(second.config));

  await board.submit(editor, first, 0);
  const firstRevision = board.read()!;
  await board.submit(editor, second, firstRevision.version);
  const secondRevision = board.read()!;

  expect(firstRevision.contentHash).not.toBe(secondRevision.contentHash);
  await expect(board.approve(reviewer, secondRevision.version, firstRevision.contentHash))
    .rejects.toMatchObject({ code: 'content-changed' });
  expect(board.read()!.status).toBe('pending');

  await board.approve(reviewer, secondRevision.version, secondRevision.contentHash);
  expect(board.read()!.status).toBe('approved');
});

test('[T18] two boards do not share review state', async () => {
  const boardA = new PresetReviewBoard({ hash: deterministicHash });
  const boardB = new PresetReviewBoard({ hash: deterministicHash });
  await boardA.submit(editor, documentFor(90, 'board-a'), 0);
  await boardB.submit(editor, documentFor(91, 'board-b'), 0);
  const pendingA = boardA.read()!;

  await boardA.approve(reviewer, pendingA.version, pendingA.contentHash);

  expect(boardA.read()!.status).toBe('approved');
  expect(boardB.read()!.status).toBe('pending');
  expect(boardB.read()!.reviewedBy).toBeNull();
});

test('[T19] a post-await digest mismatch is refused as content-changed', async () => {
  const gated = gatedHasher();
  const board = new PresetReviewBoard({ hash: gated.hash });
  const document = documentFor(100, 'digest-mismatch');
  await board.submit(editor, document, 0);
  const pending = board.read()!;

  gated.gate();
  const attempt = board.approve(reviewer, pending.version, pending.contentHash);
  expect(gated.gates).toHaveLength(1);
  gated.release(gated.gates[0]!, 'fnv1a-deadbeef');

  await expect(attempt).rejects.toMatchObject({ code: 'content-changed' });
  expect(board.read()!.status).toBe('pending');
  expect(board.read()!.reviewedBy).toBeNull();
  expect(board.read()!.contentHash).toBe(pending.contentHash);
  expect(serializePresetDocument(board.read()!.document as PresetDocument))
    .toBe(serializePresetDocument(document));
});
