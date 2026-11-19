import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubmissionEvents, type SubmissionEvent } from '../submissions/submissions.events';
import { AchievementService } from './achievement.service';
import { LearningEvents, type LessonCompletedEvent } from './learning.events';

/**
 * Awards badges right after the learning events that can earn one (PRD F12): a lesson
 * completed, an exercise passed or a project approved. Finishing a module or a track
 * always comes with one of these, so they need no listener of their own. Failures are
 * logged and never break the member's request (CONTRIBUTING rule 6).
 */
@Injectable()
export class AchievementListener {
  private readonly logger = new Logger(AchievementListener.name);

  constructor(private readonly achievements: AchievementService) {}

  @OnEvent(LearningEvents.LessonCompleted)
  async onLessonCompleted(event: LessonCompletedEvent): Promise<void> {
    await this.refresh(event.userId);
  }

  @OnEvent(SubmissionEvents.Passed)
  @OnEvent(SubmissionEvents.Approved)
  async onSubmissionPassed(event: SubmissionEvent): Promise<void> {
    await this.refresh(event.userId);
  }

  private async refresh(userId: string): Promise<void> {
    try {
      await this.achievements.refresh(userId);
    } catch (err) {
      this.logger.error({ err, userId }, 'Failed to award badges');
    }
  }
}
