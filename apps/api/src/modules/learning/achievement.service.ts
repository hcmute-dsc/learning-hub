import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Achievements, EarnedBadge, Streak, TrackProgress } from '@hub/shared';
import { Clock } from '../../infrastructure/clock';
import { ExerciseStateService } from '../submissions/exercise-state.service';
import { UsersService } from '../users/users.service';
import { countByDay, streaks, vietnamDay } from './activity';
import { BadgeRepository } from './badge.repository';
import { badgesToAward, type LearningFacts } from './badges';
import { EnrollmentService } from './enrollment.service';
import { LearningEvents, type BadgeAwardedEvent } from './learning.events';
import { LessonProgressRepository } from './lesson-progress.repository';

/** Everything known about one member's learning, loaded once (profile + badges). */
export interface LearningRecord {
  tracks: TrackProgress[];
  /** number of learning actions per Vietnam day */
  days: Map<string, number>;
  /** today's Vietnam day, YYYY-MM-DD */
  today: string;
  streak: Streak;
  facts: LearningFacts;
}

/**
 * Badges and streak (PRD F12). Badges are awarded from learning events
 * (AchievementListener) and, as a safety net, whenever achievements are read, so members
 * who learned before badges existed get theirs on their next visit. Awarding is
 * idempotent (user_badges primary key). Hiding achievements in /settings only hides
 * them; awarding goes on.
 */
@Injectable()
export class AchievementService {
  constructor(
    private readonly enrollments: EnrollmentService,
    private readonly lessonProgress: LessonProgressRepository,
    private readonly exerciseStates: ExerciseStateService,
    private readonly badges: BadgeRepository,
    private readonly users: UsersService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  async record(userId: string): Promise<LearningRecord> {
    const [overview, lessonTimes, submissions] = await Promise.all([
      this.enrollments.overview(userId),
      this.lessonProgress.completedAtFor(userId),
      this.exerciseStates.activityOf(userId),
    ]);
    const days = countByDay([...lessonTimes, ...submissions.submittedAt]);
    const today = vietnamDay(this.clock.now());
    const streak = streaks(days.keys(), today);
    return {
      tracks: overview.tracks,
      days,
      today,
      streak,
      facts: {
        lessonsCompleted: lessonTimes.length,
        exercisesCompleted: submissions.completedExercises,
        modulesCompleted: overview.modulesCompleted,
        tracksCompleted: overview.tracks.filter((t) => t.status === 'completed').length,
        longestStreak: streak.longest,
      },
    };
  }

  /** Stores the badges the facts deserve and returns all of the member's badges. */
  async award(userId: string, facts: LearningFacts): Promise<EarnedBadge[]> {
    const stored = await this.badges.listFor(userId);
    const missing = badgesToAward(
      facts,
      stored.map((b) => b.code),
    );
    if (!missing.length) return stored;

    const now = this.clock.now();
    for (const badge of missing) {
      const created = await this.badges.insert(userId, badge, now);
      if (!created) continue;
      const event: BadgeAwardedEvent = { userId, badge, awardedAt: now.toISOString() };
      await this.events.emitAsync(LearningEvents.BadgeAwarded, event);
    }
    return this.badges.listFor(userId);
  }

  /** After a learning event: load the facts and award what is new. */
  async refresh(userId: string): Promise<void> {
    const record = await this.record(userId);
    await this.award(userId, record.facts);
  }

  /** GET /me/achievements. null when the member hid achievements in /settings. */
  async mine(userId: string): Promise<Achievements | null> {
    if (!(await this.users.showsAchievements(userId))) return null;
    const record = await this.record(userId);
    return { streak: record.streak, badges: await this.award(userId, record.facts) };
  }
}
