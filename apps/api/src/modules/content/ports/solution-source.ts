import { LAYOUT_PATTERNS } from '@hub/content';
import { loadFileMap, type ContentSource } from './content-source';

/**
 * Port for reference solutions (CONTENT-SPECIFICATION §3.8). They live in the PRIVATE
 * checker repo, `exercises/<track>/<exercise>/solution.md`, because the content repos are
 * public. Bound to null when solutions are off (SOLUTIONS_SOURCE=none).
 */
export type SolutionSource = Pick<
  ContentSource,
  'sourceRepo' | 'getHead' | 'listFiles' | 'readFile'
>;

export const SOLUTION_SOURCE = Symbol('SOLUTION_SOURCE');

export interface LoadedSolutions {
  files: Map<string, string>;
  /** where they were read from, stored on the content version for traceability */
  from: { repo: string; commitSha: string } | null;
}

/**
 * Read every solution at the checker repo's current head. The checker repo is not pinned in
 * the registry, so a solution change goes live with the next content publish.
 */
export async function loadSolutions(source: SolutionSource | null): Promise<LoadedSolutions> {
  if (!source) return { files: new Map(), from: null };
  const { sha } = await source.getHead();
  const files = await loadFileMap(source, sha, LAYOUT_PATTERNS.solution);
  return { files, from: { repo: source.sourceRepo, commitSha: sha } };
}
