/**
 * Import scanning behind the architecture fitness checks (TV1).
 *
 * Uses the pinned TypeScript parser instead of a regex: comments and string
 * literals cannot fake an import, and `import type` / `export type` can be
 * told apart from value dependencies. A specifier assembled at runtime
 * (`import('./' + name)`) is still invisible to a static scan.
 */
import { posix } from 'node:path';
import ts from 'typescript';

export interface SourceFile {
  /** Repo-relative path with forward slashes, e.g. `src/ui/app.ts`. */
  readonly path: string;
  readonly source: string;
}

export interface Violation {
  /** Rule id as it appears in the failure message. */
  readonly rule: string;
  readonly file: string;
  /** The import specifier or identifier that broke the rule. */
  readonly detail: string;
}

export interface ImportRef {
  readonly specifier: string;
  /** `import type`, `export type`, or only type-only named bindings. */
  readonly typeOnly: boolean;
}

const LINE_COMMENT = /\/\/.*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const DOM_REFERENCE = /\b(document|window)\s*[.[(]/;

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return (
    clause.namedBindings !== undefined
    && ts.isNamedImports(clause.namedBindings)
    && clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function isTypeOnlyExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true;
  return (
    node.exportClause !== undefined
    && ts.isNamedExports(node.exportClause)
    && node.exportClause.elements.every((element) => element.isTypeOnly)
  );
}

/** Import and re-export specifiers in source order, with their type-only flag. */
export function importsOf(source: string): ImportRef[] {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const refs: ImportRef[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: isTypeOnlyImport(node) });
    } else if (
      ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: isTypeOnlyExport(node) });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] !== undefined
      && ts.isStringLiteral(node.arguments[0])
    ) {
      refs.push({ specifier: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };

  visit(file);
  return refs;
}

/** The repo-relative file a relative specifier points at; `null` for a package. */
export function importTarget(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  return posix.normalize(posix.join(posix.dirname(fromPath), specifier));
}

/**
 * Checks the rules from `docs/architecture.md` §2 against a set of sources.
 * Returns every violation instead of the first, so one run shows the whole
 * drift.
 */
export function checkArchitecture(files: readonly SourceFile[]): Violation[] {
  const violations: Violation[] = [];

  for (const file of files) {
    for (const { specifier, typeOnly } of importsOf(file.source)) {
      const target = importTarget(file.path, specifier);

      if (file.path.startsWith('src/ui/') && target?.startsWith('src/simulations/')) {
        violations.push({ rule: 'ui-does-not-import-simulation', file: file.path, detail: specifier });
      }

      if (
        file.path === 'src/main.ts'
        && (specifier === 'three' || specifier.startsWith('three/') || target?.startsWith('src/simulations/'))
      ) {
        violations.push({ rule: 'main-does-not-import-backend', file: file.path, detail: specifier });
      }

      if (file.path.startsWith('src/core/') && (specifier === 'three' || specifier.startsWith('three/'))) {
        violations.push({ rule: 'core-does-not-import-three', file: file.path, detail: specifier });
      }

      // Rule 1: the leaf may reference its own files, nothing outside them.
      if (file.path.startsWith('src/core/types/') && !target?.startsWith('src/core/types/')) {
        violations.push({ rule: 'core-types-is-leaf', file: file.path, detail: specifier });
      }

      // Rule 2: runtime dependencies stay inside the renderer layer; outward
      // references are allowed only as types (the documented LabConfig edge).
      if (
        file.path.startsWith('src/core/renderer/')
        && !typeOnly
        && target !== null
        && !target.startsWith('src/core/renderer/')
        && !target.startsWith('src/core/types/')
      ) {
        violations.push({ rule: 'core-renderer-imports-types-only', file: file.path, detail: specifier });
      }

      if (file.path.startsWith('src/presets/') && target?.startsWith('src/ui/')) {
        violations.push({ rule: 'presets-does-not-import-ui', file: file.path, detail: specifier });
      }
    }

    if (!file.path.startsWith('src/core/')) continue;

    // Comments talk about the DOM freely; only code that reaches for it counts.
    const code = file.source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');
    const dom = DOM_REFERENCE.exec(code);
    if (dom) {
      violations.push({ rule: 'core-does-not-touch-dom', file: file.path, detail: dom[1]! });
    }
  }

  return violations;
}
