/**
 * Port owned by the content module (CONTENT-SPECIFICATION §8). The app never depends
 * on GitHub's layout directly; adapters implement this interface.
 */
export interface ContentSource {
  /** Stable identifier stored in content_versions.source_repo */
  readonly sourceRepo: string;
  /** Commit the configured branch (or folder) currently points to */
  getHead(): Promise<{ sha: string }>;
  /** All file paths (relative, forward slashes) at that commit */
  listFiles(sha: string): Promise<string[]>;
  /** UTF-8 content of one file at that commit */
  readFile(sha: string, path: string): Promise<string>;
}

export const CONTENT_SOURCE = Symbol('CONTENT_SOURCE');

const PARSED_FILE = /^tracks\/.+\.(ya?ml|md)$/;

/** Read only what the parser needs (yaml + md under tracks/), a few files at a time. */
export async function loadFileMap(
  source: ContentSource,
  sha: string,
): Promise<Map<string, string>> {
  const paths = (await source.listFiles(sha)).filter((p) => PARSED_FILE.test(p)).sort();
  const files = new Map<string, string>();
  const queue = [...paths];
  const worker = async () => {
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      files.set(p, await source.readFile(sha, p));
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return files;
}
