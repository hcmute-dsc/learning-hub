import {
  lessonTerms,
  storedGlossary,
  toTrackGlossary,
  type GlossaryTrackRow,
} from './glossary-views';

// Track glossary, learning-hub#106 (CONTENT-SPECIFICATION §3.1c).

const SOURCE = { repo: 'hcmute-dsc/learning-hub-track-git', commitSha: 'c0ffee1' };

const GLOSSARY = [
  {
    term: 'repository',
    anchor: 'repository',
    expansion: null,
    literal: 'kho chứa',
    meaning: 'Thư mục Git theo dõi.',
    example: null,
    see: ['commit'],
  },
  {
    term: 'init',
    anchor: 'init',
    expansion: 'initialize',
    literal: 'khởi tạo',
    meaning: 'Tạo thư mục .git.',
    example: 'git init',
    see: ['Repository', 'gone'],
  },
  {
    term: 'commit',
    anchor: 'commit',
    expansion: null,
    literal: 'chốt lại',
    meaning: 'Một lần chốt thay đổi.',
    example: null,
    see: [],
  },
];

function row(over: Partial<GlossaryTrackRow> = {}): GlossaryTrackRow {
  return {
    slug: 'git',
    title: 'Git',
    glossary: GLOSSARY,
    sourcePath: 'tracks/git/track.yaml',
    modules: [
      { lessons: [{ id: 'l1', title: 'Bài 1', terms: ['init', 'repository'] }] },
      {
        lessons: [
          { id: 'l2', title: 'Bài 2', terms: ['commit', 'Repository'] },
          { id: 'l3', title: 'Bài 3', terms: [] },
        ],
      },
    ],
    ...over,
  };
}

describe('storedGlossary', () => {
  it('reads the stored entries and drops malformed ones', () => {
    expect(storedGlossary(null)).toEqual([]);
    expect(storedGlossary({ term: 'x' })).toEqual([]);
    const entries = storedGlossary([...GLOSSARY, { term: 'no meaning' }, null, 'text']);
    expect(entries.map((e) => e.term)).toEqual(['repository', 'init', 'commit']);
  });

  it('fills a missing anchor from the term and missing texts with null', () => {
    expect(storedGlossary([{ term: 'Pull Request', meaning: 'PR.' }])).toEqual([
      {
        term: 'Pull Request',
        anchor: 'pull-request',
        expansion: null,
        literal: null,
        meaning: 'PR.',
        example: null,
        see: [],
      },
    ]);
  });
});

describe('lessonTerms', () => {
  it('keeps the order of terms:, matches without case, skips unknown terms and see:', () => {
    const terms = lessonTerms(GLOSSARY, ['Commit', 'branch', 'init']);
    expect(terms.map((t) => t.term)).toEqual(['commit', 'init']);
    expect(terms[1]).toEqual({
      term: 'init',
      anchor: 'init',
      expansion: 'initialize',
      literal: 'khởi tạo',
      meaning: 'Tạo thư mục .git.',
      example: 'git init',
    });
  });

  it('is empty when the track has no glossary', () => {
    expect(lessonTerms(null, ['init'])).toEqual([]);
  });
});

describe('toTrackGlossary', () => {
  it('is null when the track has no glossary', () => {
    expect(toTrackGlossary(row({ glossary: null }), SOURCE)).toBeNull();
    expect(toTrackGlossary(row({ glossary: [] }), SOURCE)).toBeNull();
  });

  it('lists the lessons that introduce each term, in reading order', () => {
    const view = toTrackGlossary(row(), SOURCE)!;
    const lessons = Object.fromEntries(view.terms.map((t) => [t.term, t.lessons]));
    expect(lessons).toEqual({
      repository: [
        { id: 'l1', title: 'Bài 1' },
        { id: 'l2', title: 'Bài 2' },
      ],
      init: [{ id: 'l1', title: 'Bài 1' }],
      commit: [{ id: 'l2', title: 'Bài 2' }],
    });
  });

  it('resolves see: to the term and its anchor, dropping unknown terms', () => {
    const init = toTrackGlossary(row(), SOURCE)!.terms[1];
    expect(init.see).toEqual([{ term: 'repository', anchor: 'repository' }]);
  });

  it('keeps file order and links to glossary.yaml next to track.yaml', () => {
    const view = toTrackGlossary(row(), SOURCE)!;
    expect(view.terms.map((t) => t.term)).toEqual(['repository', 'init', 'commit']);
    expect(view.track).toEqual({ slug: 'git', title: 'Git' });
    expect(view.source).toEqual({ ...SOURCE, path: 'tracks/git/glossary.yaml' });
  });
});
