import {
  groupPrerequisites,
  sourceFor,
  toExerciseContext,
  toLessonContext,
  toOutlineItems,
  toTrackDetail,
  toTrackDoc,
  toTrackSummary,
  trackDocFlags,
  toStoredHints,
  type ExerciseRow,
  type LessonRow,
  type TrackDetailRow,
} from './catalog-views';

const REPO = 'hcmute-dsc/learning-hub-content';
const SQL_REPO = 'hcmute-dsc/learning-hub-track-sql-30-days';
/** A registry version (ADR-10): the registry commit, plus where each track was read from */
const registryVersion = {
  sourceRepo: REPO,
  commitSha: 'b0b0b0b',
  trackSources: { 'sql-30-days': { repo: SQL_REPO, commitSha: 'c0ffee1' } },
};
const track = { id: 't1', slug: 'sql-30-days', title: 'SQL 30 ngày', starterRepo: null };
const moduleRow = { slug: '01-foundations', title: 'Nền tảng', track };

function trackRow(over: Partial<TrackDetailRow> = {}): TrackDetailRow {
  return {
    id: 't1',
    slug: 'sql-30-days',
    title: 'SQL 30 ngày',
    summary: 'Học SQL',
    level: 'beginner',
    language: 'vi',
    estHours: 60,
    tags: ['sql'],
    starterRepo: null,
    setupMd: null,
    resourcesMd: null,
    glossary: null,
    sourcePath: 'tracks/sql-30-days',
    contentVersion: { sourceRepo: REPO, commitSha: 'ea5de5c' },
    modules: [
      {
        id: 'm1',
        slug: '01-foundations',
        title: 'Nền tảng',
        summary: null,
        lessons: [{ id: 'l1', slug: 'day-01', title: 'Ngày 1', estMinutes: 30 }],
        exercises: [
          { id: 'e1', slug: 'ex-01', title: 'Bài tập 1', type: 'quiz', difficulty: 'easy' },
        ],
      },
    ],
    ...over,
  };
}

describe('toTrackSummary', () => {
  it('adds up active lessons and exercises across modules', () => {
    const summary = toTrackSummary({
      ...trackRow(),
      modules: [{ _count: { lessons: 8, exercises: 7 } }, { _count: { lessons: 7, exercises: 7 } }],
    });
    expect(summary).toMatchObject({ slug: 'sql-30-days', lessonCount: 15, exerciseCount: 14 });
  });

  it('counts zero for a track without modules', () => {
    expect(toTrackSummary({ ...trackRow(), modules: [] })).toMatchObject({
      lessonCount: 0,
      exerciseCount: 0,
    });
  });
});

describe('toTrackDetail', () => {
  // learning-hub#8: a publish that changed only lessons left the track row (and its
  // contentVersion) untouched, so the page kept showing the older commit.
  it('shows the published commit, not the one that last wrote the track row', () => {
    const detail = toTrackDetail(trackRow(), { sourceRepo: REPO, commitSha: '95a1924' });
    expect(detail.source).toEqual({ repo: REPO, commitSha: '95a1924', path: 'tracks/sql-30-days' });
  });

  it("falls back to the track's own version before anything is published", () => {
    expect(toTrackDetail(trackRow(), null).source.commitSha).toBe('ea5de5c');
  });

  it("links a registry version to the track's own repo and commit", () => {
    expect(toTrackDetail(trackRow(), registryVersion).source).toEqual({
      repo: SQL_REPO,
      commitSha: 'c0ffee1',
      path: 'tracks/sql-30-days',
    });
  });

  it('keeps modules, lessons and exercises in the given order', () => {
    const detail = toTrackDetail(trackRow(), null);
    expect(detail.modules).toHaveLength(1);
    expect(detail.modules[0].lessons.map((l) => l.id)).toEqual(['l1']);
    expect(detail.modules[0].exercises.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('track pages (learning-hub#44)', () => {
  const withDocs = (over: Partial<TrackDetailRow> = {}) =>
    trackRow({
      sourcePath: 'tracks/sql-30-days/track.yaml',
      setupMd: 'Cài PostgreSQL 16.',
      resourcesMd: null,
      ...over,
    });

  it('tells the track page which pages exist, without their text', () => {
    expect(toTrackDetail(withDocs(), null).docs).toEqual({ setup: true, resources: false });
    expect(toTrackDetail(trackRow(), null).docs).toEqual({ setup: false, resources: false });
    expect(toTrackDetail(trackRow(), null).hasGlossary).toBe(false);
    const glossary = [{ term: 'init', anchor: 'init', meaning: 'Khởi tạo.', see: [] }];
    expect(toTrackDetail(trackRow({ glossary }), null).hasGlossary).toBe(true);
  });

  it('treats an empty text as no page', () => {
    expect(trackDocFlags({ setupMd: '', resourcesMd: 'x' })).toEqual({
      setup: false,
      resources: true,
    });
  });

  it("returns the page with docs/<page>.md next to track.yaml in the track's repo", () => {
    expect(toTrackDoc(withDocs(), 'setup', registryVersion)).toEqual({
      page: 'setup',
      bodyMd: 'Cài PostgreSQL 16.',
      track: { slug: 'sql-30-days', title: 'SQL 30 ngày' },
      source: { repo: SQL_REPO, commitSha: 'c0ffee1', path: 'tracks/sql-30-days/docs/setup.md' },
    });
  });

  it("uses the track's own version before the first publish", () => {
    const doc = toTrackDoc(withDocs({ resourcesMd: '- link' }), 'resources', null);
    expect(doc?.source).toEqual({
      repo: REPO,
      commitSha: 'ea5de5c',
      path: 'tracks/sql-30-days/docs/resources.md',
    });
  });

  it('returns null when the track has no such page', () => {
    expect(toTrackDoc(withDocs(), 'resources', null)).toBeNull();
    expect(toTrackDoc(withDocs({ setupMd: '' }), 'setup', null)).toBeNull();
  });
});

describe('toOutlineItems', () => {
  it('lists each module’s lessons before its exercises, module by module', () => {
    const items = toOutlineItems({
      modules: [
        {
          slug: 'a',
          lessons: [{ id: 'l1', title: 'L1' }],
          exercises: [{ id: 'e1', title: 'E1' }],
        },
        {
          slug: 'b',
          lessons: [{ id: 'l2', title: 'L2' }],
          exercises: [],
        },
      ],
    });
    expect(items.map((i) => `${i.kind}:${i.id}@${i.moduleSlug}`)).toEqual([
      'lesson:l1@a',
      'exercise:e1@a',
      'lesson:l2@b',
    ]);
  });
});

describe('toLessonContext', () => {
  const lesson: LessonRow = {
    id: 'l1',
    slug: 'day-01',
    title: 'Ngày 1',
    bodyMd: '# Ngày 1',
    estMinutes: 30,
    terms: [],
    sourcePath: 'tracks/sql-30-days/modules/01/day-01.md',
    module: moduleRow,
    contentVersion: { sourceRepo: REPO, commitSha: '01aaa53' },
    exercises: [{ id: 'e1', title: 'Bài tập 1', type: 'quiz' }],
  };

  it('uses the commit that last changed this lesson before the first publish', () => {
    expect(toLessonContext(lesson).source).toEqual({ repo: REPO, commitSha: '01aaa53' });
  });

  // learning-hub#20: a publish that changed no lesson left every lesson on the old version,
  // so after the move to a registry their edit links still pointed at learning-hub-content.
  it('links to the published version, even when it did not change this lesson', () => {
    expect(toLessonContext(lesson, registryVersion).source).toEqual({
      repo: SQL_REPO,
      commitSha: 'c0ffee1',
    });
    expect(toLessonContext(lesson, { sourceRepo: REPO, commitSha: '0b0b0b0' }).source).toEqual({
      repo: REPO,
      commitSha: '0b0b0b0',
    });
  });

  it("reads a registry lesson from its track's repo, so images and edit links work", () => {
    expect(toLessonContext({ ...lesson, contentVersion: registryVersion }).source).toEqual({
      repo: SQL_REPO,
      commitSha: 'c0ffee1',
    });
  });

  it('names its track, module and linked exercises', () => {
    const ctx = toLessonContext(lesson);
    expect(ctx.track).toEqual({ id: 't1', slug: 'sql-30-days', title: 'SQL 30 ngày' });
    expect(ctx.module).toEqual({ slug: '01-foundations', title: 'Nền tảng' });
    expect(ctx.exercises).toEqual([{ id: 'e1', title: 'Bài tập 1', type: 'quiz' }]);
  });

  it('gives the glossary entries of its terms, in front matter order (learning-hub#106)', () => {
    const glossary = [
      { term: 'SELECT', anchor: 'select', meaning: 'Chọn cột.', see: [] },
      { term: 'row', anchor: 'row', literal: 'hàng', meaning: 'Một dòng.', see: [] },
    ];
    const ctx = toLessonContext({
      ...lesson,
      terms: ['row', 'select', 'missing'],
      module: { ...moduleRow, track: { ...track, glossary } },
    });
    expect(ctx.terms.map((t) => t.term)).toEqual(['row', 'SELECT']);
    expect(toLessonContext(lesson).terms).toEqual([]);
  });
});

describe('toExerciseContext', () => {
  function exercise(over: Partial<ExerciseRow> = {}): ExerciseRow {
    return {
      id: 'e2',
      slug: 'ex-02',
      title: 'Bài tập 2',
      type: 'quiz',
      difficulty: 'medium',
      statementMd: '# Đề',
      spec: { passScore: 0.5 },
      hints: [],
      solutionMd: null,
      mentorNotesMd: null,
      requiresReview: false,
      contentVersionId: 'cv1',
      module: moduleRow,
      lesson: { id: 'l1', title: 'Ngày 1', status: 'active' },
      prerequisites: [],
      ...over,
    };
  }

  it('carries the mentor notes for the review page', () => {
    expect(toExerciseContext(exercise()).mentorNotesMd).toBeNull();
    expect(toExerciseContext(exercise({ mentorNotesMd: 'Xem tiêu đề PR' })).mentorNotesMd).toBe(
      'Xem tiêu đề PR',
    );
  });

  it('links its lesson while the lesson is active', () => {
    expect(toExerciseContext(exercise()).lesson).toEqual({ id: 'l1', title: 'Ngày 1' });
  });

  it('drops the link to an archived lesson', () => {
    const ctx = toExerciseContext(
      exercise({ lesson: { id: 'l1', title: 'Ngày 1', status: 'archived' } }),
    );
    expect(ctx.lesson).toBeNull();
  });

  it('ignores archived prerequisites so they no longer lock the exercise', () => {
    const ctx = toExerciseContext(
      exercise({
        prerequisites: [
          { requiredExercise: { id: 'e1', title: 'Bài tập 1', status: 'active' } },
          { requiredExercise: { id: 'e0', title: 'Bài cũ', status: 'archived' } },
        ],
      }),
    );
    expect(ctx.prerequisites).toEqual([{ id: 'e1', title: 'Bài tập 1' }]);
  });

  it('carries the track starter repo and the spec', () => {
    const ctx = toExerciseContext(
      exercise({
        module: { ...moduleRow, track: { ...track, starterRepo: 'hcmute-dsc/starter' } },
      }),
    );
    expect(ctx.track.starterRepo).toBe('hcmute-dsc/starter');
    expect(ctx.spec).toEqual({ passScore: 0.5 });
  });
});

describe('toStoredHints', () => {
  it('keeps well-formed hints, sorted by position', () => {
    expect(
      toStoredHints([
        { position: 2, cost: 1, bodyMd: 'B' },
        { position: 1, cost: 0, bodyMd: 'A' },
      ]),
    ).toEqual([
      { position: 1, cost: 0, bodyMd: 'A' },
      { position: 2, cost: 1, bodyMd: 'B' },
    ]);
  });

  it('drops broken entries and reads anything else as no hints', () => {
    expect(toStoredHints([{ position: '1', cost: 0, bodyMd: 'A' }, null, { position: 1 }])).toEqual(
      [],
    );
    expect(toStoredHints(null)).toEqual([]);
    expect(toStoredHints({ position: 1 })).toEqual([]);
  });
});

describe('groupPrerequisites', () => {
  it('returns every asked exercise, with an empty list when it has none', () => {
    const map = groupPrerequisites(
      ['e1', 'e2', 'e3'],
      [
        { exerciseId: 'e2', requiredExerciseId: 'e1' },
        { exerciseId: 'e3', requiredExerciseId: 'e1' },
        { exerciseId: 'e3', requiredExerciseId: 'e2' },
      ],
    );
    expect(Object.fromEntries(map)).toEqual({ e1: [], e2: ['e1'], e3: ['e1', 'e2'] });
  });

  it('ignores rows for exercises that were not asked for', () => {
    const map = groupPrerequisites(['e1'], [{ exerciseId: 'x', requiredExerciseId: 'e1' }]);
    expect(Object.fromEntries(map)).toEqual({ e1: [] });
  });
});

describe('sourceFor', () => {
  it("uses the track's entry of a registry version", () => {
    expect(sourceFor(registryVersion, 'sql-30-days')).toEqual({
      repo: SQL_REPO,
      commitSha: 'c0ffee1',
    });
  });

  it('falls back to the version itself for a single repo, a missing track or a bad entry', () => {
    const own = { repo: REPO, commitSha: 'b0b0b0b' };
    expect(sourceFor({ sourceRepo: REPO, commitSha: 'b0b0b0b' }, 'sql-30-days')).toEqual(own);
    expect(sourceFor({ ...registryVersion, trackSources: null }, 'sql-30-days')).toEqual(own);
    expect(sourceFor(registryVersion, 'java-basics')).toEqual(own);
    expect(
      sourceFor(
        { ...registryVersion, trackSources: { 'sql-30-days': { repo: 1 } } },
        'sql-30-days',
      ),
    ).toEqual(own);
  });
});
