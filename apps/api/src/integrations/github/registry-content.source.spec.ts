import { DomainError } from '../../common/errors';
import { RegistryContentSource } from './registry-content.source';

const REGISTRY = 'hcmute-dsc/learning-hub-content';
const SQL_REPO = 'hcmute-dsc/learning-hub-track-sql-30-days';
const GIT_REPO = 'hcmute-dsc/learning-hub-track-git-basics';
const REG_SHA = '1'.repeat(40);
const SQL_SHA = 'a'.repeat(40);
const GIT_SHA = 'b'.repeat(40);

/** In-memory repos: repo → commit → path → content */
type Repos = Record<string, Record<string, Record<string, string>>>;

const tracksYaml = (...entries: [string, string, string][]) =>
  [
    'tracks:',
    ...entries.map(
      ([slug, repo, commit]) => `  - slug: ${slug}\n    repo: ${repo}\n    commit: "${commit}"`,
    ),
  ].join('\n');

function setup(repos: Repos) {
  const calls: string[] = [];
  const open = (repo: string) => ({
    getHead: jest.fn(async () => ({ sha: REG_SHA })),
    listFiles: jest.fn(async (sha: string) => {
      calls.push(`list ${repo}@${sha.slice(0, 1)}`);
      return Object.keys(repos[repo]?.[sha] ?? {});
    }),
    readFile: jest.fn(async (sha: string, path: string) => {
      const body = repos[repo]?.[sha]?.[path];
      if (body === undefined) throw DomainError.notFound(path);
      return body;
    }),
  });
  return { source: new RegistryContentSource(REGISTRY, 'main', undefined, open), calls };
}

const twoTracks = (): Repos => ({
  [REGISTRY]: {
    [REG_SHA]: {
      'tracks.yaml': tracksYaml(
        ['sql-30-days', SQL_REPO, SQL_SHA],
        ['git-basics', GIT_REPO, GIT_SHA],
      ),
    },
  },
  [SQL_REPO]: {
    [SQL_SHA]: {
      'README.md': '# SQL',
      'tracks/sql-30-days/track.yaml': 'slug: sql-30-days',
      'tracks/sql-30-days/modules/01/module.yaml': 'slug: m1',
    },
  },
  [GIT_REPO]: {
    [GIT_SHA]: { 'tracks/git-basics/track.yaml': 'slug: git-basics' },
  },
});

describe('RegistryContentSource', () => {
  it('uses the registry repo as the version source and its HEAD as the head', async () => {
    const { source } = setup(twoTracks());
    expect(source.sourceRepo).toBe(REGISTRY);
    await expect(source.getHead()).resolves.toEqual({ sha: REG_SHA });
  });

  it('lists the files under tracks/ of every track repo, at the pinned commits', async () => {
    const { source } = setup(twoTracks());
    await expect(source.listFiles(REG_SHA)).resolves.toEqual([
      'tracks/sql-30-days/track.yaml',
      'tracks/sql-30-days/modules/01/module.yaml',
      'tracks/git-basics/track.yaml',
    ]);
  });

  it('reads each file from the repo of its track', async () => {
    const { source } = setup(twoTracks());
    await expect(source.readFile(REG_SHA, 'tracks/git-basics/track.yaml')).resolves.toBe(
      'slug: git-basics',
    );
    await expect(
      source.readFile(REG_SHA, 'tracks/sql-30-days/modules/01/module.yaml'),
    ).resolves.toBe('slug: m1');
    await expect(source.readFile(REG_SHA, 'tracks/java/track.yaml')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('reports where each track came from', async () => {
    const { source } = setup(twoTracks());
    await expect(source.trackSources(REG_SHA)).resolves.toEqual({
      'sql-30-days': { repo: SQL_REPO, commitSha: SQL_SHA },
      'git-basics': { repo: GIT_REPO, commitSha: GIT_SHA },
    });
  });

  it('reads tracks.yaml and lists each track once per registry commit', async () => {
    const { source, calls } = setup(twoTracks());
    await source.listFiles(REG_SHA);
    await source.readFile(REG_SHA, 'tracks/git-basics/track.yaml');
    await source.trackSources(REG_SHA);
    expect(calls).toEqual([`list ${SQL_REPO}@a`, `list ${GIT_REPO}@b`]);
  });

  it('rejects an invalid tracks.yaml with its issues', async () => {
    const repos = twoTracks();
    repos[REGISTRY][REG_SHA]['tracks.yaml'] = tracksYaml(['sql-30-days', SQL_REPO, 'main']);
    const { source } = setup(repos);
    await expect(source.listFiles(REG_SHA)).rejects.toMatchObject({
      status: 422,
      message: 'tracks.yaml is not valid',
    });
  });

  it('rejects a track repo that holds another track folder', async () => {
    const repos = twoTracks();
    repos[SQL_REPO][SQL_SHA]['tracks/java/track.yaml'] = 'slug: java';
    const { source } = setup(repos);
    await expect(source.listFiles(REG_SHA)).rejects.toMatchObject({
      status: 422,
      message: `${SQL_REPO} may only contain tracks/sql-30-days/ (found tracks/java/track.yaml)`,
    });
  });

  it('rejects a track repo without the track.yaml of its slug', async () => {
    const repos = twoTracks();
    delete repos[GIT_REPO][GIT_SHA]['tracks/git-basics/track.yaml'];
    const { source } = setup(repos);
    await expect(source.listFiles(REG_SHA)).rejects.toMatchObject({
      status: 422,
      message: `${GIT_REPO} has no tracks/git-basics/track.yaml at bbbbbbb`,
    });
  });

  it('does not keep a failed read, so a retry after a GitHub error works', async () => {
    const repos = twoTracks();
    const saved = repos[GIT_REPO];
    delete repos[GIT_REPO];
    const { source } = setup(repos);
    await expect(source.listFiles(REG_SHA)).rejects.toBeInstanceOf(DomainError);
    repos[GIT_REPO] = saved;
    await expect(source.listFiles(REG_SHA)).resolves.toHaveLength(3);
  });
});
