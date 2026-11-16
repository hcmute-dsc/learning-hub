import { Injectable } from '@nestjs/common';
import type { TrackItemsProgress } from '@hub/shared';
import { CatalogReader, type TrackOutline } from '../catalog/catalog.reader';
import { ExerciseStateService } from '../submissions/exercise-state.service';
import { EnrollmentRepository } from './enrollment.repository';
import { LessonProgressRepository } from './lesson-progress.repository';
import { enrollmentStatus, isAllDone, summarize, type ItemStatuses } from './progress';

/**
 * Loads the status of every item of a track for one member. Lesson status comes from
 * lesson_progress; exercise state comes from submissions through ExerciseStateService
 * (never stored, DATABASE §3.11).
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly exerciseStates: ExerciseStateService,
    private readonly lessonProgress: LessonProgressRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  async statusesFor(userId: string, outline: TrackOutline): Promise<ItemStatuses> {
    const lessonIds: string[] = [];
    const exerciseIds: string[] = [];
    for (const item of outline.items) {
      if (item.kind === 'lesson') lessonIds.push(item.id);
      else exerciseIds.push(item.id);
    }
    const [lessons, exercises] = await Promise.all([
      this.lessonProgress.statusesFor(userId, lessonIds),
      this.exerciseStates.statesFor(userId, exerciseIds),
    ]);
    return { lessons, exercises };
  }

  /** GET /tracks/:slug/progress. Works without an enrollment so the track page can show locks. */
  async trackItems(userId: string, slug: string): Promise<TrackItemsProgress> {
    const outline = await this.catalog.trackOutline({ slug });
    const [statuses, enrollment] = await Promise.all([
      this.statusesFor(userId, outline),
      this.enrollments.find(userId, outline.id),
    ]);
    const enrolled = enrollment !== null && enrollment.status !== 'dropped';
    // The same summary as the dashboard, so "Tiếp tục" and "completed" follow one rule.
    const summary = summarize(outline.items, statuses);
    const allDone = isAllDone(summary.lessons, summary.exercises);

    const result: TrackItemsProgress = {
      enrolled,
      completed: enrolled ? enrollmentStatus(enrollment.status, allDone) === 'completed' : allDone,
      lessons: {},
      exercises: {},
      next: summary.next,
    };
    for (const item of outline.items) {
      if (item.kind === 'lesson') {
        result.lessons[item.id] = statuses.lessons.get(item.id) ?? 'not_started';
      } else {
        result.exercises[item.id] = statuses.exercises.get(item.id) ?? 'not_started';
      }
    }
    return result;
  }
}
