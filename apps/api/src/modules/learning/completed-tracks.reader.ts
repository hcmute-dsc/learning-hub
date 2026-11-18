import { Injectable } from '@nestjs/common';
import { EnrollmentRepository } from './enrollment.repository';

export interface CompletedTrack {
  trackId: string;
  completedAt: Date;
}

/**
 * Tracks a member has completed, for modules that reward completion (certificates F19,
 * badges). The completion rule itself lives in progress.ts (`isAllDone`) and is stored
 * once by EnrollmentService, which then emits LearningEvents.TrackCompleted. Listen to
 * that event for new completions; read here only to catch up on older ones.
 */
@Injectable()
export class CompletedTracksReader {
  constructor(private readonly enrollments: EnrollmentRepository) {}

  async forUser(userId: string): Promise<CompletedTrack[]> {
    const rows = await this.enrollments.listCompleted(userId);
    return rows.flatMap((r) =>
      r.completedAt ? [{ trackId: r.trackId, completedAt: r.completedAt }] : [],
    );
  }
}
