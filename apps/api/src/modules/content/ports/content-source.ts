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
  /**
   * Only for a registry (DECISIONS ADR-10): the repo and commit each track was read from
   * at that registry commit, keyed by track slug. Stored on the version so pages link to
   * the track's own repo instead of the registry.
   */
  trackSources?(sha: string): Promise<TrackSources>;
}

export interface TrackSource {
  repo: string;
  commitSha: string;
}

export type TrackSources = Record<string, TrackSource>;

/** Read `content_versions.track_sources` (JSON): keep only well-formed entries, else null. */
export function toTrackSources(value: unknown): TrackSources | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sources: TrackSources = {};
  for (const [slug, entry] of Object.entries(value)) {
    const { repo, commitSha } = (entry ?? {}) as Partial<TrackSource>;
    if (typeof repo === 'string' && typeof commitSha === 'string') {
      sources[slug] = { repo, commitSha };
    }
  }
  return Object.keys(sources).length ? sources : null;
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
