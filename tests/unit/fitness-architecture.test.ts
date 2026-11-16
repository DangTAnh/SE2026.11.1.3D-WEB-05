/**
 * Architecture fitness checks (TV1).
 *
 * The dependency rules in `docs/architecture.md` §2 are written down; this test
 * is what makes them fail the build. A rule that only exists in a diagram is a
 * suggestion — the first import written in a hurry deletes it.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArchitecture, type SourceFile } from '../fitness/imports.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Every TypeScript file under `src/`, keyed by its repo-relative path. */
function readSources(dir: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, dir), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const absolute = join(entry.parentPath, entry.name);
    files.push({
      path: relative(REPO_ROOT, absolute).replaceAll('\\', '/'),
      source: readFileSync(absolute, 'utf8'),
    });
  }
  return files;
}

const source = (path: string, body: string): SourceFile => ({ path, source: body });

test('fitness: the UI does not import the simulation directly', () => {
  const violations = checkArchitecture([
    source('src/ui/app.ts', "import { step } from '../simulations/simulation.ts';"),
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, 'ui-does-not-import-simulation');
});

test('fitness: core stays free of three', () => {
  const violations = checkArchitecture([
    source('src/core/renderer/adapter.ts', "import { WebGPURenderer } from 'three/webgpu';"),
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, 'core-does-not-import-three');
});

test('fitness: core does not touch document or window', () => {
  const violations = checkArchitecture([
    source('src/core/renderer/adapter.ts', 'const canvas = document.createElement("canvas");'),
    source('src/core/measurement/aggregate.ts', 'const size = window.innerWidth;'),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['core-does-not-touch-dom', 'core-does-not-touch-dom'],
  );
});

test('fitness: a comment that mentions the DOM is not a violation', () => {
  const violations = checkArchitecture([
    source('src/core/renderer/Port.ts', '// The port is DOM-free: no document, no window.\nexport interface Port {}'),
  ]);

  assert.deepEqual(violations, []);
});

test('fitness: allowed imports and package imports stay clean', () => {
  const violations = checkArchitecture([
    source('src/ui/app.ts', "import type { LabConfig } from '../presets/preset.ts';"),
    source('src/core/measurement/hash.ts', "import { createHash } from 'node:crypto';"),
    source('src/main.ts', "import { mountLabUI } from './ui/app.ts';"),
  ]);

  assert.deepEqual(violations, []);
});

test('fitness: the composition root does not import a concrete backend', () => {
  const violations = checkArchitecture([
    source('src/main.ts', "import { ThreeRendererAdapter } from './simulations/rendererAdapter.ts';"),
    source('src/main.ts', "import { WebGPURenderer } from 'three/webgpu';"),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['main-does-not-import-backend', 'main-does-not-import-backend'],
  );
});

test('fitness: core/types is a leaf with no outward imports', () => {
  const violations = checkArchitecture([
    source('src/core/types/example.ts', "import { x } from '../renderer/RendererPort.ts';"),
    source('src/core/types/example.ts', "export { x } from '../../presets/preset.ts';"),
    source('src/core/types/example.ts', 'async function load() { await import("../../ui/app.ts"); }'),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['core-types-is-leaf', 'core-types-is-leaf', 'core-types-is-leaf'],
  );
});

test('fitness: core/types may reference its own files', () => {
  const violations = checkArchitecture([
    source('src/core/types/measurement.ts', "import type { ActualBackend } from './backend.ts';"),
  ]);

  assert.deepEqual(violations, []);
});

test('fitness: core/renderer only type-imports outward', () => {
  const violations = checkArchitecture([
    source('src/core/renderer/example.ts', "import { x } from '../../presets/example.ts';"),
    source('src/core/renderer/example.ts', "export { x } from '../../simulations/example.ts';"),
    source('src/core/renderer/example.ts', 'async function load() { await import("../../presets/example.ts"); }'),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['core-renderer-imports-types-only', 'core-renderer-imports-types-only', 'core-renderer-imports-types-only'],
  );
});

test('fitness: core/renderer keeps the documented LabConfig type-only exception', () => {
  const violations = checkArchitecture([
    source('src/core/renderer/RendererPort.ts', "import type { LabConfig } from '../../presets/preset.ts';"),
    source('src/core/renderer/RendererPort.ts', "export type { LabConfig } from '../../presets/preset.ts';"),
    source('src/core/renderer/adapter.ts', "import type { RendererPort } from './RendererPort.ts';"),
  ]);

  assert.deepEqual(violations, []);
});

test('fitness: presets never import the UI', () => {
  const violations = checkArchitecture([
    source('src/presets/example.ts', "import { mount } from '../ui/app.ts';"),
    source('src/presets/example.ts', "export type { View } from '../ui/app.ts';"),
    source('src/presets/example.ts', 'async function load() { await import("../ui/app.ts"); }'),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['presets-does-not-import-ui', 'presets-does-not-import-ui', 'presets-does-not-import-ui'],
  );
});

test('fitness: import-looking text in comments and strings is not a violation', () => {
  const violations = checkArchitecture([
    source(
      'src/core/types/example.ts',
      '// import { x } from "../ui/example.ts";\nconst text = "import { x } from \'../ui/example.ts\'";',
    ),
    source(
      'src/presets/example.ts',
      '/* export { x } from "../ui/example.ts" */\nconst specifier = "from \'../ui/example.ts\'";',
    ),
  ]);

  assert.deepEqual(violations, []);
});

test('fitness: the repository itself follows the rules', () => {
  assert.deepEqual(checkArchitecture(readSources('src')), []);
});
