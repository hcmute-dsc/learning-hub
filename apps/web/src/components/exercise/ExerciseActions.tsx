import type { ExerciseView } from '@hub/shared';
import { CodeSteps } from './CodeSteps';
import { CompletedNotice } from './CompletedNotice';
import { LockedNotice } from './LockedNotice';
import { ProjectPanel } from './ProjectPanel';
import { QuizForm } from './QuizForm';
import { SelfCheckForm } from './SelfCheckForm';

/** The action panel of an exercise, chosen by `type` (INFORMATION-ARCHITECTURE §6). */
export function ExerciseActions({ exercise }: { exercise: ExerciseView }) {
  if (exercise.state === 'locked') return <LockedNotice />;

  if (exercise.type === 'quiz' && exercise.quiz) {
    return (
      <QuizForm
        exerciseId={exercise.id}
        quiz={exercise.quiz}
        completed={exercise.state === 'completed'}
      />
    );
  }
  if (exercise.type === 'self_check' && exercise.selfCheck) {
    return (
      <SelfCheckForm
        exerciseId={exercise.id}
        checklist={exercise.selfCheck.checklist}
        completed={exercise.state === 'completed'}
      />
    );
  }
  // A completed code or project exercise refuses new submissions (409).
  if (exercise.state === 'completed') return <CompletedNotice />;
  if (exercise.type === 'code' && exercise.code) {
    return <CodeSteps exerciseId={exercise.id} code={exercise.code} />;
  }
  if (exercise.type === 'project' && exercise.project) {
    return <ProjectPanel exerciseId={exercise.id} project={exercise.project} />;
  }
  // The API sends exactly one detail block matching `type`; this only guards bad data.
  return <p className="muted text-sm">Bài tập này chưa có phần nộp bài.</p>;
}
