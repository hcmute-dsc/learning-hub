import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TrackProgress } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { CatalogReader, type TrackOutline } from '../catalog/catalog.reader';
import { EnrollmentRepository, type EnrollmentRow } from './enrollment.repository';
import { LearningEvents, type EnrolledEvent, type TrackCompletedEvent } from './learning.events';
import {
  completedModules,
  enrollmentStatus,
  isAllDone,
  shouldMarkCompleted,
  summarize,
  type ItemStatuses,
} from './progress';
import { ProgressService } from './progress.service';

/** Enrolling in tracks and the member's track list with progress (BACKEND-DESIGN §2 learning). */
@Injectable()
export class EnrollmentService {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly enrollments: EnrollmentRepository,
    private readonly progress: ProgressService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  /** POST /tracks/:slug/enrollments. `created` decides 201 vs 200 (USER-FLOWS §3). */
  async enroll(
    userId: string,
    slug: string,
    cohort: string | null,
  ): Promise<{ created: boolean; progress: TrackProgress }> {
    const outline = await this.catalog.trackOutline({ slug });
    const { row, created } = await this.enrollIn(userId, outline.id, cohort);
    const statuses = await this.progress.statusesFor(userId, outline);
    return { created, progress: await this.toTrackProgress(userId, row, outline, statuses) };
  }

  /** Saving lesson progress enrolls the member automatically (learning.ts contract). */
  async ensureEnrolled(userId: string, trackId: string): Promise<void> {
    await this.enrollIn(userId, trackId, null);
  }

  /** GET /me/enrollments: active and completed enrollments with their progress. */
  async listMine(userId: string): Promise<TrackProgress[]> {
    return (await this.overview(userId)).tracks;
  }

  /**
   * The member's tracks with progress, plus how many modules (chặng) they finished in
   * them (badges, F12). One pass, so item statuses are loaded once per track.
   */
  async overview(userId: string): Promise<{ tracks: TrackProgress[]; modulesCompleted: number }> {
    const rows = await this.enrollments.listVisible(userId);
    const tracks: TrackProgress[] = [];
    let modulesCompleted = 0;
    for (const row of rows) {
      const outline = await this.outlineOrNull(row.trackId);
      if (!outline) continue;
      const statuses = await this.progress.statusesFor(userId, outline);
      tracks.push(await this.toTrackProgress(userId, row, outline, statuses));
      modulesCompleted += completedModules(outline.items, statuses);
    }
    return { tracks, modulesCompleted };
  }

  /**
   * Store the completion as soon as the last item is done: called after a lesson is
   * completed and when an exercise passes (BACKEND-DESIGN §2 learning listens to
   * SubmissionPassed). Does nothing without an active enrollment.
   */
  async refreshCompletion(userId: string, trackId: string): Promise<void> {
    const row = await this.enrollments.find(userId, trackId);
    if (!row || row.status !== 'active') return;
    const outline = await this.catalog.trackOutline({ id: trackId });
    const summary = summarize(outline.items, await this.progress.statusesFor(userId, outline));
    await this.recordCompletion(userId, row, isAllDone(summary.lessons, summary.exercises));
  }

  /**
   * Idempotent on the unique (user, track) key (BACKEND-DESIGN §3.7). Two parallel
   * requests may both miss `find`; the loser of the insert race reads the winner's row.
   */
  private async enrollIn(
    userId: string,
    trackId: string,
    cohort: string | null,
  ): Promise<{ row: EnrollmentRow; created: boolean }> {
    const existing = await this.enrollments.find(userId, trackId);
    if (existing) {
      if (existing.status === 'dropped') {
        const row = await this.enrollments.reactivate(existing.id, cohort ?? existing.cohort);
        return { row, created: false };
      }
      return { row: existing, created: false };
    }

    const inserted = await this.enrollments.insert(userId, trackId, cohort);
    if (inserted) {
      const event: EnrolledEvent = { enrollmentId: inserted.id, userId, trackId };
      await this.events.emitAsync(LearningEvents.Enrolled, event);
      return { row: inserted, created: true };
    }

    const winner = await this.enrollments.find(userId, trackId);
    if (!winner) throw DomainError.conflict('Enrollment changed concurrently, please retry');
    return { row: winner, created: false };
  }

  private async toTrackProgress(
    userId: string,
    row: EnrollmentRow,
    outline: TrackOutline,
    statuses: ItemStatuses,
  ): Promise<TrackProgress> {
    const summary = summarize(outline.items, statuses);
    const allDone = isAllDone(summary.lessons, summary.exercises);
    const stored = await this.recordCompletion(userId, row, allDone);
    return {
      trackId: outline.id,
      slug: outline.slug,
      title: outline.title,
      status: enrollmentStatus(stored.status, allDone),
      cohort: stored.cohort,
      enrolledAt: stored.enrolledAt.toISOString(),
      ...summary,
      hasSetup: outline.hasSetup,
    };
  }

  /**
   * The first time every item is done we store it, so completed_at keeps the real date
   * for stats and certificates later. Usually refreshCompletion has stored it already;
   * this read-time check is the safety net for completions no event reports yet
   * (mentor approvals arrive with the reviews module) and for content changes.
   */
  private async recordCompletion(
    userId: string,
    row: EnrollmentRow,
    allDone: boolean,
  ): Promise<EnrollmentRow> {
    if (!shouldMarkCompleted(row.status, allDone)) return row;
    const stored = await this.enrollments.markCompleted(row.id, this.clock.now());
    // Someone else completed it a moment ago and already announced it.
    if (!stored) return (await this.enrollments.find(userId, row.trackId)) ?? row;
    const event: TrackCompletedEvent = {
      enrollmentId: stored.id,
      userId,
      trackId: stored.trackId,
      completedAt: (stored.completedAt ?? this.clock.now()).toISOString(),
    };
    await this.events.emitAsync(LearningEvents.TrackCompleted, event);
    return stored;
  }

  /**
   * TODO(DATABASE §8): archived content should stay readable for enrolled members, but
   * CatalogReader only returns active content, so an archived track is left out of the
   * list here instead of failing the whole request. Fix once CatalogReader can include
   * archived items for enrolled members.
   */
  private async outlineOrNull(trackId: string): Promise<TrackOutline | null> {
    try {
      return await this.catalog.trackOutline({ id: trackId });
    } catch (error) {
      if (error instanceof DomainError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }
}
