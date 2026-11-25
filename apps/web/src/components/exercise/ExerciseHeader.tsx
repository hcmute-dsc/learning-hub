import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CompletedReview, Difficulty, ExerciseType, ExerciseView } from '@hub/shared';
import { ReportContentButton } from '@/components/content-report/ReportContentButton';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { lessonHref, moduleHref } from '@/components/learn/links';
import { HexIcon } from '@/components/ui/HexIcon';
import { DIFFICULTY_LABEL, EXERCISE_TYPE_LABEL } from '@/lib/labels';
import { ExerciseStateBadge } from './ExerciseStateBadge';
import { ExerciseStatusBanner } from './ExerciseStatusBanner';

/** A small symbol per type; the text label next to it carries the meaning. */
const TYPE_ICON: Record<ExerciseType, string> = {
  code: '</>',
  quiz: '?',
  project: '◆',
  self_check: '☑',
};

/** Easy → green, medium → amber, hard → red, like Exercism's difficulty chips. */
const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  easy: 'border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-200',
  medium: 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200',
  hard: 'border-red-300 text-red-800 dark:border-red-700 dark:text-red-200',
};

/**
 * Breadcrumb, title, info chips and the status banner of an exercise
 * (INFORMATION-ARCHITECTURE §6 header).
 */
export function ExerciseHeader({
  exercise,
  trackIcon,
  review = null,
}: {
  exercise: ExerciseView;
  /** Short label for the track hexagon (lib/track-icon.ts) */
  trackIcon: string;
  /** The mentor review the banner mentions (bannerReview in exercise-status.ts) */
  review?: { submissionId: string; review: CompletedReview } | null;
}) {
  return (
    <header className="motion-fade-up space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Lộ trình', href: '/tracks' },
          { label: exercise.track.title, href: `/tracks/${exercise.track.slug}` },
          {
            label: exercise.module.title,
            href: moduleHref(exercise.track.slug, exercise.module.slug),
          },
        ]}
      />

      <div className="flex items-start gap-4">
        <span className="hidden sm:block">
          <HexIcon label={trackIcon} size={60} className="motion-pop" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{exercise.title}</h1>
          <ul aria-label="Thông tin bài tập" className="mt-3 flex flex-wrap items-center gap-2">
            <li>
              <ExerciseStateBadge state={exercise.state} />
            </li>
            <li>
              <Chip className="border-transparent bg-brand-50 font-medium text-brand-700">
                <span aria-hidden className="font-mono">
                  {TYPE_ICON[exercise.type]}
                </span>
                {EXERCISE_TYPE_LABEL[exercise.type]}
              </Chip>
            </li>
            <li>
              <Chip className={DIFFICULTY_CLASS[exercise.difficulty]}>
                Độ khó: {DIFFICULTY_LABEL[exercise.difficulty]}
              </Chip>
            </li>
            {exercise.requiresReview && (
              <li>
                <Chip className="muted border-[var(--border)]">
                  <span aria-hidden>👀</span>Có mentor review
                </Chip>
              </li>
            )}
            {exercise.attempts > 0 && (
              <li>
                <Chip className="muted border-[var(--border)]">
                  <span aria-hidden>↻</span>
                  {exercise.attempts} lần nộp
                </Chip>
              </li>
            )}
          </ul>
          {exercise.lesson && (
            <p className="muted mt-3 text-sm">
              Thuộc bài học:{' '}
              <Link
                href={lessonHref(exercise.lesson.id)}
                className="font-medium underline underline-offset-2 hover:text-brand-700"
              >
                {exercise.lesson.title}
              </Link>
            </p>
          )}
          <div className="muted mt-2 text-sm">
            <ReportContentButton target={{ kind: 'exercise', id: exercise.id }} />
          </div>
        </div>
      </div>

      <ExerciseStatusBanner state={exercise.state} lockedBy={exercise.lockedBy} review={review} />
    </header>
  );
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}
