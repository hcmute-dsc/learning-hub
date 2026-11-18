import { parseRegistry, REGISTRY_FILE, trackSlugOf, type RegistryEntry } from '@hub/content';
import { DomainError } from '../../common/errors';
import type { ContentSource, TrackSources } from '../../modules/content/ports/content-source';
import { GithubContentSource } from './github-content.source';

/** Opens one GitHub repo; tests pass fakes. */
type OpenRepo = (repo: string) => Pick<ContentSource, 'getHead' | 'listFiles' | 'readFile'>;

interface Resolved {
  bySlug: Map<string, RegistryEntry>;
  files: string[];
}

/** Registry commits kept in memory: a sync or publish reads one commit many times. */
const CACHED_COMMITS = 5;

/**
 * Reads content through the registry (DECISIONS ADR-10, CONTENT-SPECIFICATION §8):
 * `tracks.yaml` in the registry repo lists, for each track, its repo and the commit to
 * publish. The files of track `<slug>` come from `tracks/<slug>/…` of that repo at that
 * commit, so the parser sees the same layout as a single content repo.
 *
 * A content version is still one registry commit (`sourceRepo` = the registry), and
 * `trackSources()` says where each track really came from.
 */
export class RegistryContentSource implements ContentSource {
  readonly sourceRepo: string;
  private readonly registry: ReturnType<OpenRepo>;
  private readonly resolved = new Map<string, Promise<Resolved>>();

  constructor(
    repo: string,
    branch: string,
    token?: string,
    private readonly openRepo: OpenRepo = (r) => new GithubContentSource(r, branch, token),
  ) {
    this.sourceRepo = repo;
    this.registry = openRepo(repo);
  }

  getHead(): Promise<{ sha: string }> {
    return this.registry.getHead();
  }

  async listFiles(sha: string): Promise<string[]> {
    return (await this.resolve(sha)).files;
  }

  async readFile(sha: string, path: string): Promise<string> {
    const entry = (await this.resolve(sha)).bySlug.get(trackSlugOf(path) ?? '');
    if (!entry) throw DomainError.notFound(`Content file ${path}`);
    return this.openRepo(entry.repo).readFile(entry.commit, path);
  }

  async trackSources(sha: string): Promise<TrackSources> {
    const sources: TrackSources = {};
    for (const [slug, e] of (await this.resolve(sha)).bySlug) {
      sources[slug] = { repo: e.repo, commitSha: e.commit };
    }
    return sources;
  }

  /** Read `tracks.yaml` at a registry commit and list every track's files, once per commit. */
  private resolve(sha: string): Promise<Resolved> {
    let pending = this.resolved.get(sha);
    if (!pending) {
      pending = this.load(sha);
      // A failed read (rate limit, network) must not be cached.
      pending.catch(() => this.resolved.delete(sha));
      this.resolved.set(sha, pending);
      if (this.resolved.size > CACHED_COMMITS) {
        this.resolved.delete(this.resolved.keys().next().value as string);
      }
    }
    return pending;
  }

  private async load(sha: string): Promise<Resolved> {
    const { entries, issues } = parseRegistry(await this.registry.readFile(sha, REGISTRY_FILE));
    if (issues.length) {
      throw new DomainError('VALIDATION_FAILED', 422, `${REGISTRY_FILE} is not valid`, issues);
    }

    const bySlug = new Map(entries.map((e) => [e.slug, e]));
    const files: string[] = [];
    for (const e of entries) {
      const paths = (await this.openRepo(e.repo).listFiles(e.commit)).filter((p) =>
        p.startsWith('tracks/'),
      );
      const foreign = paths.filter((p) => trackSlugOf(p) !== e.slug);
      if (foreign.length) {
        throw new DomainError(
          'VALIDATION_FAILED',
          422,
          `${e.repo} may only contain tracks/${e.slug}/ (found ${foreign[0]})`,
        );
      }
      if (!paths.includes(`tracks/${e.slug}/track.yaml`)) {
        throw new DomainError(
          'VALIDATION_FAILED',
          422,
          `${e.repo} has no tracks/${e.slug}/track.yaml at ${e.commit.slice(0, 7)}`,
        );
      }
      files.push(...paths);
    }
    return { bySlug, files };
  }
}
