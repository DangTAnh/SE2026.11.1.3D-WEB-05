import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { importPresetBatch } from '../../src/presets/batchImport.ts';
import { parsePresetDocument, serializePresetDocument } from '../../src/presets/preset.ts';
import { vt124Document } from '../support/vt124-presets.ts';

test('VT124-T09 strict schema failures do not poison a later valid record', () => {
  const base = vt124Document();
  const { camera: _camera, ...missingCamera } = base.config;
  const result = importPresetBatch([
    JSON.stringify({ ...base, schemaVersion: 1 }),
    JSON.stringify({ ...base, extra: true }),
    JSON.stringify({ ...base, config: missingCamera }),
    JSON.stringify(base),
  ]);
  expect(result.items.map(item => item.status)).toEqual(['rejected', 'rejected', 'rejected', 'accepted']);
  expect(result.items[3]).toEqual({ index: 3, status: 'accepted', document: base });
  expect(result.acceptedCount).toBe(1);
  expect(result.rejectedCount).toBe(3);
});

test.each(['attractor', 'vortex'] as const)('VT124-T10 %s document/name round-trip survives batch import', mode => {
  const input = vt124Document('Đám mây VT124 🌦', mode);
  const result = importPresetBatch([JSON.stringify(input), '{bad']);
  const item = result.items[0];
  if (item?.status !== 'accepted') throw new Error('valid document was lost');
  expect(item.document).toEqual(input);
  expect(parsePresetDocument(serializePresetDocument(item.document))).toEqual(input);
  expect(result.items[1]?.status).toBe('rejected');
});

test('VT124-T11 count/range/precision validation remains unchanged', () => {
  const inputs = [1000, 500000, 999, 500001, 1000.5].map(count => {
    const document = vt124Document();
    document.config.simulation.particleCount = count;
    return JSON.stringify(document);
  });
  const precision = vt124Document();
  precision.config.simulation.speed = 1.2345;
  const result = importPresetBatch([...inputs, JSON.stringify(precision)]);
  expect(result.items.map(item => item.status)).toEqual([
    'accepted', 'accepted', 'rejected', 'rejected', 'rejected', 'rejected',
  ]);
  expect(result.acceptedCount).toBe(2);
  expect(result.rejectedCount).toBe(4);
});

test('VT124-T22 published examples stay byte-identical after batch round-trip', () => {
  const texts = ['attractor', 'vortex'].map(mode =>
    readFileSync(new URL(`../../public/examples/${mode}-preset.json`, import.meta.url), 'utf8'));
  const result = importPresetBatch(texts);
  expect(result.acceptedCount).toBe(2);
  result.items.forEach((item, index) => {
    if (item.status !== 'accepted') throw new Error('published example rejected');
    expect(serializePresetDocument(item.document)).toBe(texts[index]);
  });
});

