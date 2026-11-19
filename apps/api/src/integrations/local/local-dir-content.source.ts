import { readDirectory } from '@hub/content';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DomainError } from '../../common/errors';
import type { ContentSource } from '../../modules/content/ports/content-source';

/**
 * Development/test adapter: reads a local folder (e.g. content-example).
 * A folder has no commits, so the "sha" is sha1 over sorted paths + contents.
 * Publishing a version fails if the folder changed after it was synced.
 * `top` is the folder that is read: `tracks` for content, `exercises` for checker-example.
 */
export class LocalDirContentSource implements ContentSource {
  readonly sourceRepo: string;
  private readonly root: string;

  constructor(
    dir: string,
    private readonly top = 'tracks',
  ) {
    this.root = resolve(dir);
    this.sourceRepo = `local:${this.root.replace(/\\/g, '/')}`;
  }

  private snapshot(): { sha: string; files: Map<string, string> } {
    let files: Map<string, string>;
    try {
      files = readDirectory(this.root, this.top);
    } catch {
      throw new DomainError('UPSTREAM_ERROR', 503, `Content folder not readable: ${this.root}`);
    }
    const hash = createHash('sha1');
    for (const p of [...files.keys()].sort())
      hash.update(p).update('\0').update(files.get(p)!).update('\0');
    return { sha: hash.digest('hex'), files };
  }

  private at(sha: string): Map<string, string> {
    const snap = this.snapshot();
    if (snap.sha !== sha) {
      throw DomainError.conflict(
        'The local content folder changed since this version was synced. Sync again.',
      );
    }
    return snap.files;
  }

  async getHead(): Promise<{ sha: string }> {
    return { sha: this.snapshot().sha };
  }

  private cache?: { sha: string; files: Map<string, string> };

  async listFiles(sha: string): Promise<string[]> {
    this.cache = { sha, files: this.at(sha) };
    return [...this.cache.files.keys()];
  }

  async readFile(sha: string, path: string): Promise<string> {
    const files = this.cache?.sha === sha ? this.cache.files : this.at(sha);
    const text = files.get(path);
    if (text === undefined) throw DomainError.notFound(`Content file ${path}`);
    return text;
  }
}
