// Dependency direction check for the API (CONTRIBUTING "Rules that keep the code
// maintainable", rule 2): business code in apps/api/src/modules never imports
// apps/api/src/integrations. It depends on a port, and the integration binds the adapter.
//
// The one allowed import is Nest wiring: a `*.module.ts` file may import an
// integration's `*.module` file, because that is where the adapter gets bound.
//
// Run: node scripts/check-boundaries.mjs   (exit code 1 when a rule is broken)

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES_DIR = 'apps/api/src/modules';
const INTEGRATIONS_DIR = 'apps/api/src/integrations';

// `import x from '...'`, `export * from '...'`, `import '...'`, `import('...')`, `require('...')`
const IMPORT_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** All module specifiers a TypeScript source file imports. */
export function importSpecifiers(source) {
  const found = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      found.push(match[1]);
    }
  }
  return found;
}

/**
 * Violations in one file under apps/api/src/modules.
 * @param {string} file repo-relative path with forward slashes
 * @param {string} source file contents
 * @returns {{ file: string, specifier: string }[]}
 */
export function checkFile(file, source) {
  const violations = [];
  const isNestModule = file.endsWith('.module.ts');
  for (const specifier of importSpecifiers(source)) {
    // Only relative imports can reach integrations/: the API has no path aliases.
    if (!specifier.startsWith('.')) continue;
    const target = path.posix.join(path.posix.dirname(file), specifier);
    if (target !== INTEGRATIONS_DIR && !target.startsWith(INTEGRATIONS_DIR + '/')) continue;
    if (isNestModule && target.endsWith('.module')) continue;
    violations.push({ file, specifier });
  }
  return violations;
}

/** Repo-relative paths of all .ts files below a directory. */
function listTsFiles(root, dir) {
  const files = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTsFiles(root, relative));
    else if (entry.name.endsWith('.ts')) files.push(relative);
  }
  return files;
}

/** Violations in the whole repository rooted at `root`. */
export function checkRepository(root) {
  const violations = [];
  for (const file of listTsFiles(root, MODULES_DIR)) {
    violations.push(...checkFile(file, readFileSync(path.join(root, file), 'utf8')));
  }
  return violations;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const violations = checkRepository(root);
  for (const v of violations) {
    console.error(
      `${v.file}: imports '${v.specifier}'. Business code must depend on a port in ` +
        `modules/<name>/ports/, not on integrations/ (CONTRIBUTING, rule 2).`,
    );
  }
  if (violations.length > 0) process.exit(1);
  console.log('Dependency direction OK: modules/ does not import integrations/.');
}
