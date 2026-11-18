import {
  groupPrerequisites,
  sourceFor,
  toExerciseContext,
  toLessonContext,
  toOutlineItems,
  toTrackDetail,
  toTrackSummary,
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
    sourcePath: 'tracks/sql-30-days/modules/01/day-01.md',
    module: moduleRow,
    contentVersion: { sourceRepo: REPO, commitSha: '01aaa53' },
    exercises: [{ id: 'e1', title: 'Bài tập 1', type: 'quiz' }],
  };

  it('keeps the commit that last changed this lesson', () => {
    expect(toLessonContext(lesson).source).toEqual({ repo: REPO, commitSha: '01aaa53' });
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
      requiresReview: false,
      contentVersionId: 'cv1',
      module: moduleRow,
      lesson: { id: 'l1', title: 'Ngày 1', status: 'active' },
      prerequisites: [],
      ...over,
    };
  }

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
