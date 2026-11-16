import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAX_FILE_BYTES = 1024 * 1024;
const TEXT_FILE = /\.(ya?ml|md)$/i;

/**
 * Read every .yaml/.md file under `<root>/tracks` into a FileMap (paths use `/`).
 * Binary assets are skipped: the parser never needs them.
 */
export function readDirectory(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        entry.isFile() &&
        TEXT_FILE.test(entry.name) &&
        statSync(full).size <= MAX_FILE_BYTES
      ) {
        files.set(relative(root, full).split(sep).join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  walk(join(root, 'tracks'));
  return files;
}
