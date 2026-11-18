import { describe, expect, it } from 'vitest';
import { parseRegistry, REGISTRY_FILE, trackSlugOf } from './index';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const registry = (...lines: string[]) => ['tracks:', ...lines].join('\n');
const entry = (slug: string, repo: string, commit: string) =>
  [`  - slug: ${slug}`, `    repo: ${repo}`, `    commit: "${commit}"`].join('\n');

describe('parseRegistry', () => {
  it('returns the entries of a valid registry', () => {
    const text = registry(
      entry('sql-30-days', 'hcmute-dsc/learning-hub-track-sql-30-days', SHA_A),
      entry('csharp-basics', 'hcmute-dsc/learning-hub-track-csharp-basics', SHA_B),
    );
    expect(parseRegistry(text)).toEqual({
      entries: [
        { slug: 'sql-30-days', repo: 'hcmute-dsc/learning-hub-track-sql-30-days', commit: SHA_A },
        {
          slug: 'csharp-basics',
          repo: 'hcmute-dsc/learning-hub-track-csharp-basics',
          commit: SHA_B,
        },
      ],
      issues: [],
    });
  });

  it('accepts an empty list (no track published yet)', () => {
    expect(parseRegistry('tracks: []')).toEqual({ entries: [], issues: [] });
  });

  it('rejects a branch name instead of a commit, so publishing always goes through a PR', () => {
    const { entries, issues } = parseRegistry(registry(entry('sql-30-days', 'o/r', 'main')));
    expect(entries).toEqual([]);
    expect(issues).toEqual([
      { path: REGISTRY_FILE, message: 'tracks.0.commit: commit must be a full 40-character SHA' },
    ]);
  });

  it('rejects a slug or a repo listed twice', () => {
    const { entries, issues } = parseRegistry(
      registry(entry('sql', 'o/a', SHA_A), entry('sql', 'o/b', SHA_B), entry('java', 'o/a', SHA_B)),
    );
    expect(entries).toEqual([]);
    expect(issues.map((i) => i.message)).toEqual([
      'slug "sql" is listed twice',
      'repo "o/a" is listed twice',
    ]);
  });

  it('rejects unknown keys, a bad slug and broken YAML', () => {
    expect(
      parseRegistry(registry(entry('sql', 'o/a', SHA_A), '    branch: main')).issues,
    ).toHaveLength(1);
    expect(parseRegistry(registry(entry('SQL_Track', 'o/a', SHA_A))).issues[0].message).toMatch(
      /kebab-case/,
    );
    expect(parseRegistry('tracks: [').issues[0].message).toMatch(/^invalid YAML/);
  });
});

describe('trackSlugOf', () => {
  it('reads the track folder of a path', () => {
    expect(trackSlugOf('tracks/sql-30-days/modules/01/module.yaml')).toBe('sql-30-days');
    expect(trackSlugOf('tracks/sql-30-days/track.yaml')).toBe('sql-30-days');
    expect(trackSlugOf('README.md')).toBeNull();
    expect(trackSlugOf('tracks/x')).toBeNull();
  });
});
