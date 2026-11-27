import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/vt122-pairwise.json');

const factors = {
  prior: ['none', 'committed-same', 'committed-different', 'failed'],
  clock: ['before', 'exact', 'after'],
  input: ['valid', 'invalid-key', 'invalid-doc'],
  receipt: ['valid', 'wrong-requestId', 'wrong-canonical', 'uncommitted', 'throw-after-commit'],
};
const names = Object.keys(factors);

function allowed(row) {
  if (row.input === 'invalid-key' && row.prior !== 'none') return false;
  if (row.prior === 'none' && row.clock !== 'before') return false;
  if (row.input !== 'valid' && row.receipt !== 'valid') return false;
  if (row.receipt !== 'valid') {
    if (!(row.prior === 'none' || row.prior === 'failed')) return false;
    if (row.clock !== 'before') return false;
  }
  if ((row.prior === 'committed-same' || row.prior === 'committed-different')
      && row.clock !== 'after' && row.receipt !== 'valid') return false;
  return true;
}

const all = [];
for (const prior of factors.prior) {
  for (const clock of factors.clock) {
    for (const input of factors.input) {
      for (const receipt of factors.receipt) {
        const row = { prior, clock, input, receipt };
        if (allowed(row)) all.push(row);
      }
    }
  }
}

const validPairs = new Set();
for (const row of all) {
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      validPairs.add(`${names[i]}=${row[names[i]]}|${names[j]}=${row[names[j]]}`);
    }
  }
}

function pairs(row) {
  const result = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      result.push(`${names[i]}=${row[names[i]]}|${names[j]}=${row[names[j]]}`);
    }
  }
  return result;
}

const uncovered = new Set(validPairs);
const selected = [];
while (uncovered.size > 0) {
  let best;
  let bestCovered = -1;
  for (const row of all) {
    if (selected.includes(row)) continue;
    const covered = pairs(row).filter(pair => uncovered.has(pair)).length;
    if (covered > bestCovered) {
      best = row;
      bestCovered = covered;
    }
  }
  if (!best || bestCovered <= 0) throw new Error('pairwise generation stalled');
  selected.push(best);
  for (const pair of pairs(best)) uncovered.delete(pair);
}

for (let i = selected.length - 1; i >= 0; i--) {
  const candidate = selected[i];
  const remaining = selected.filter((_, index) => index !== i);
  const covered = new Set(remaining.flatMap(pairs));
  if ([...validPairs].every(pair => covered.has(pair))) selected.splice(i, 1);
}

const covered = new Set(selected.flatMap(pairs));
const missing = [...validPairs].filter(pair => !covered.has(pair));
if (missing.length > 0) throw new Error(`missing pairs: ${missing.join(', ')}`);

const result = {
  generatedBy: 'scripts/vt122-pairwise.mjs',
  seed: 23001846,
  factors,
  constraints: [
    'invalid-key implies prior=none',
    'prior=none implies clock=before (no entry to expire)',
    'invalid input implies receipt=valid (validation precedes the port)',
    'non-valid receipt implies prior in {none, failed} and clock=before',
    'committed prior with clock before/exact implies receipt=valid (replay/conflict precedes the port)',
  ],
  coverage: {
    validCombinations: all.length,
    selectedRows: selected.length,
    validPairs: validPairs.size,
    coveredPairs: covered.size,
    percent: Number(((covered.size / validPairs.size) * 100).toFixed(2)),
  },
  rows: selected.map((row, index) => ({ id: `P${String(index + 1).padStart(2, '0')}`, ...row })),
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result.coverage));
