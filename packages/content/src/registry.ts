import { parse } from 'yaml';
import { z } from 'zod';
import type { ContentIssue } from './types';

/**
 * The registry (DECISIONS ADR-10): `learning-hub-content` only holds `tracks.yaml`, which
 * says where each track lives and which commit of it is published. Each track repo
 * (`learning-hub-track-<slug>`) contains exactly one folder, `tracks/<slug>/`.
 *
 *   tracks:
 *     - slug: sql-30-days
 *       repo: hcmute-dsc/learning-hub-track-sql-30-days
 *       commit: <40 hex characters>
 */
export const REGISTRY_FILE = 'tracks.yaml';

const entrySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case (a-z, 0-9, -)'),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be owner/name'),
    // A branch name would make the published content move without a reviewed PR.
    commit: z.string().regex(/^[0-9a-f]{40}$/, 'commit must be a full 40-character SHA'),
  })
  .strict();

const registrySchema = z.object({ tracks: z.array(entrySchema) }).strict();

export type RegistryEntry = z.infer<typeof entrySchema>;

export interface RegistryResult {
  entries: RegistryEntry[];
  issues: ContentIssue[];
}

/** Parse and check `tracks.yaml`. Entries are only returned when there are no issues. */
export function parseRegistry(text: string): RegistryResult {
  const issue = (message: string): RegistryResult => ({
    entries: [],
    issues: [{ path: REGISTRY_FILE, message }],
  });

  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    return issue(`invalid YAML: ${(e as Error).message}`);
  }
  const result = registrySchema.safeParse(data);
  if (!result.success) {
    return {
      entries: [],
      issues: result.error.issues.map((i) => ({
        path: REGISTRY_FILE,
        message: `${i.path.join('.') || '(root)'}: ${i.message}`,
      })),
    };
  }

  const issues: ContentIssue[] = [];
  const seen = { slug: new Set<string>(), repo: new Set<string>() };
  for (const e of result.data.tracks) {
    if (seen.slug.has(e.slug))
      issues.push({ path: REGISTRY_FILE, message: `slug "${e.slug}" is listed twice` });
    if (seen.repo.has(e.repo))
      issues.push({ path: REGISTRY_FILE, message: `repo "${e.repo}" is listed twice` });
    seen.slug.add(e.slug);
    seen.repo.add(e.repo);
  }
  return issues.length ? { entries: [], issues } : { entries: result.data.tracks, issues };
}

/** The track folder a path belongs to: `tracks/<slug>/…` → `<slug>`, otherwise null. */
export function trackSlugOf(path: string): string | null {
  const match = /^tracks\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
}
