import type { ExerciseContext } from '../catalog/catalog.reader';
import { toExerciseView } from './exercise-view';
import { toSubmissionView } from './submission-view';

function exercise(over: Partial<ExerciseContext>): ExerciseContext {
  return {
    id: 'e1',
    slug: 'git-basics-quiz',
    title: 'Git cơ bản',
    type: 'quiz',
    difficulty: 'easy',
    statementMd: '# Quiz',
    spec: {},
    hints: [],
    solutionMd: null,
    mentorNotesMd: null,
    requiresReview: false,
    contentVersionId: 'cv1',
    track: { id: 't1', slug: 'git', title: 'Git', starterRepo: 'hcmute-dsc/git-starter' },
    module: { slug: 'basics', title: 'Cơ bản' },
    lesson: null,
    prerequisites: [],
    ...over,
  };
}

const member = {
  state: 'not_started' as const,
  lockedBy: [],
  attempts: 0,
  openedHints: new Set<number>(),
  solutionUnlocked: false,
};

describe('toExerciseView', () => {
  it('never sends quiz answers or explanations', () => {
    const view = toExerciseView(
      exercise({
        spec: {
          passScore: 0.5,
          questions: [
            {
              id: 'q1',
              type: 'single',
              prompt: 'Lệnh nào?',
              options: ['git add', 'git push'],
              answer: 0,
              explanation: 'Vì…',
            },
            { id: 'q2', type: 'short_text', prompt: 'Tên?', answer: ['main'] },
          ],
        },
      }),
      member,
    );
    expect(view.quiz).toEqual({
      passScore: 0.5,
      questions: [
        { id: 'q1', type: 'single', prompt: 'Lệnh nào?', options: ['git add', 'git push'] },
        { id: 'q2', type: 'short_text', prompt: 'Tên?' },
      ],
    });
    expect(JSON.stringify(view)).not.toMatch(/answer|explanation|Vì…|main"/);
    expect(view.code ?? view.project ?? view.selfCheck).toBeUndefined();
  });

  it('code: starter repo from the track, path and submit kind (with default) from the spec', () => {
    const view = toExerciseView(
      exercise({
        type: 'code',
        spec: {
          starterPath: 'first-pull-request',
          checker: { workflow: 'check.yml', tests: 'tests/' },
          runtime: { language: 'python' },
        },
      }),
      member,
    );
    expect(view.code).toEqual({
      starterRepo: 'hcmute-dsc/git-starter',
      starterPath: 'first-pull-request',
      submitKind: 'github_pr',
    });
    expect(view.quiz).toBeUndefined();
  });

  it('project and self-check blocks', () => {
    const project = toExerciseView(
      exercise({ type: 'project', spec: { rubric: [{ criterion: 'Chạy được' }] } }),
      member,
    );
    expect(project.project).toEqual({
      deliverable: 'github_repo_or_pr',
      rubric: [{ criterion: 'Chạy được', weight: 1 }],
    });
    const selfCheck = toExerciseView(
      exercise({ type: 'self_check', spec: { checklist: ['Đã cài Git'] } }),
      member,
    );
    expect(selfCheck.selfCheck).toEqual({ checklist: ['Đã cài Git'] });
  });

  it('lockedBy is empty unless the exercise is locked', () => {
    const spec = { checklist: ['x'] };
    const lockedBy = [{ id: 'e0', title: 'Bài trước' }];
    const base = exercise({ type: 'self_check', spec });
    expect(toExerciseView(base, { ...member, state: 'locked', lockedBy }).lockedBy).toEqual(
      lockedBy,
    );
    expect(toExerciseView(base, { ...member, state: 'completed', lockedBy }).lockedBy).toEqual([]);
  });
});

describe('toExerciseView: hints and solution (PRD F11)', () => {
  const withExtras = exercise({
    type: 'self_check',
    spec: { checklist: ['x'] },
    hints: [
      { position: 1, cost: 0, bodyMd: 'HINT-ONE' },
      { position: 2, cost: 2, bodyMd: 'HINT-TWO' },
    ],
    solutionMd: 'SECRET-SOLUTION',
  });

  it('sends neither unopened hints nor a locked solution', () => {
    const view = toExerciseView(withExtras, member);
    expect(view.hints).toEqual({
      total: 2,
      opened: [],
      next: { position: 1, cost: 0, ready: true },
    });
    expect(view.solution).toEqual({ unlocked: false, bodyMd: null });
    expect(JSON.stringify(view)).not.toMatch(/HINT-ONE|HINT-TWO|SECRET-SOLUTION/);
  });

  it('sends opened hints and an unlocked solution', () => {
    const view = toExerciseView(withExtras, {
      ...member,
      attempts: 1,
      openedHints: new Set([1]),
      solutionUnlocked: true,
    });
    expect(view.hints.opened).toEqual([{ position: 1, bodyMd: 'HINT-ONE' }]);
    expect(view.hints.next).toEqual({ position: 2, cost: 2, ready: false });
    expect(JSON.stringify(view)).not.toMatch(/HINT-TWO/);
    expect(view.solution).toEqual({ unlocked: true, bodyMd: 'SECRET-SOLUTION' });
  });

  it('never sends mentor notes to the member, even with everything unlocked (#43)', () => {
    const view = toExerciseView(
      { ...withExtras, mentorNotesMd: 'MENTOR-ONLY-NOTES' },
      { ...member, attempts: 5, openedHints: new Set([1, 2]), solutionUnlocked: true },
    );
    expect(JSON.stringify(view)).not.toMatch(/MENTOR-ONLY-NOTES/);
    expect(view).not.toHaveProperty('mentorNotesMd');
  });

  it('has no solution block when the exercise has no solution', () => {
    const plain = toExerciseView(
      exercise({ type: 'self_check', spec: { checklist: ['x'] } }),
      member,
    );
    expect(plain.solution).toBeNull();
    expect(plain.hints).toEqual({ total: 0, opened: [], next: null });
  });
});

describe('toSubmissionView', () => {
  const row = {
    id: 's1',
    exerciseId: 'e1',
    attempt: 2,
    sourceType: 'quiz_answers',
    sourceUrl: null,
    note: null,
    status: 'passed',
    answers: { answers: { q1: 0 }, score: 0.75 },
    submittedAt: new Date('2026-11-16T10:00:00Z'),
    exercise: { title: 'Git cơ bản' },
  };

  it('maps the row and reads the quiz score from answers', () => {
    expect(toSubmissionView(row)).toEqual({
      id: 's1',
      exerciseId: 'e1',
      exerciseTitle: 'Git cơ bản',
      attempt: 2,
      sourceType: 'quiz_answers',
      sourceUrl: null,
      note: null,
      status: 'passed',
      score: 0.75,
      submittedAt: '2026-11-16T10:00:00.000Z',
      review: null,
    });
  });

  it('score is null for non-quiz submissions', () => {
    expect(toSubmissionView({ ...row, sourceType: 'self_check', answers: null }).score).toBeNull();
  });
});
