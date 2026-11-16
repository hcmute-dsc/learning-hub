import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { LessonProgressInput, LessonView } from '@hub/shared';
import { Clock } from '../../infrastructure/clock';
import { CatalogReader } from '../catalog/catalog.reader';
import { ExerciseStateService } from '../submissions/exercise-state.service';
import { EnrollmentService } from './enrollment.service';
import { LearningEvents, type LessonCompletedEvent } from './learning.events';
import { LessonProgressRepository } from './lesson-progress.repository';
import { neighbours } from './progress';

/** Lesson page and lesson progress (BACKEND-DESIGN §2 learning, §4 endpoints). */
@Injectable()
export class LessonService {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly exerciseStates: ExerciseStateService,
    private readonly lessonProgress: LessonProgressRepository,
    private readonly enrollments: EnrollmentService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  /** GET /lessons/:id. Read only: opening a lesson does not mark it as started. */
  async view(userId: string, lessonId: string): Promise<LessonView> {
    const lesson = await this.catalog.lesson(lessonId);
    const exerciseIds = lesson.exercises.map((e) => e.id);
    const [outline, states, progress] = await Promise.all([
      this.catalog.trackOutline({ id: lesson.track.id }),
      this.exerciseStates.statesFor(userId, exerciseIds),
      this.lessonProgress.statusOf(userId, lesson.id),
    ]);
    const { previous, next } = neighbours(outline.items, lesson.id);

    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      bodyMd: lesson.bodyMd,
      estMinutes: lesson.estMinutes,
      track: { slug: lesson.track.slug, title: lesson.track.title },
      module: lesson.module,
      previous,
      next,
      progress,
      exercises: lesson.exercises.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        state: states.get(e.id) ?? 'not_started',
      })),
      source: { ...lesson.source, path: lesson.sourcePath },
    };
  }

  /** PUT /lessons/:id/progress. Auto-enrolls so "Tiếp tục học" works without an extra click. */
  async setProgress(
    userId: string,
    lessonId: string,
    input: LessonProgressInput,
  ): Promise<{ status: LessonProgressInput['status'] }> {
    const lesson = await this.catalog.lesson(lessonId);
    await this.enrollments.ensureEnrolled(userId, lesson.track.id);
    await this.lessonProgress.save(userId, lesson.id, input.status, this.clock.now());
    if (input.status === 'completed') {
      const event: LessonCompletedEvent = { userId, lessonId: lesson.id, trackId: lesson.track.id };
      await this.events.emitAsync(LearningEvents.LessonCompleted, event);
      // The last lesson may finish the track (BACKEND-DESIGN §2 learning: TrackCompleted).
      await this.enrollments.refreshCompletion(userId, lesson.track.id);
    }
    return { status: input.status };
  }
}
