import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { BadgeCode, EarnedBadge, TrackProgress } from '@hub/shared';
import type { Clock } from '../../infrastructure/clock';
import type { ExerciseStateService } from '../submissions/exercise-state.service';
import type { UsersService } from '../users/users.service';
import { AchievementService } from './achievement.service';
import type { BadgeRepository } from './badge.repository';
import type { EnrollmentService } from './enrollment.service';
import { LearningEvents } from './learning.events';
import type { LessonProgressRepository } from './lesson-progress.repository';

/** In-memory user_badges with the same (user, badge) key as the table. */
class FakeBadges {
  rows = new Map<string, EarnedBadge>();
  async listFor(_userId: string): Promise<EarnedBadge[]> {
    return [...this.rows.values()];
  }
  async insert(_userId: string, badge: BadgeCode, at: Date): Promise<boolean> {
    if (this.rows.has(badge)) return false;
    this.rows.set(badge, { code: badge, awardedAt: at.toISOString() });
    return true;
  }
}

// 2026-11-17 10:00 in Vietnam
const NOW = new Date('2026-11-17T03:00:00Z');

function setup(opts: { lessons?: Date[]; show?: boolean; tracks?: Partial<TrackProgress>[] } = {}) {
  const badges = new FakeBadges();
  const emit = jest.fn(async () => []);
  const service = new AchievementService(
    {
      overview: async () => ({
        tracks: (opts.tracks ?? []) as TrackProgress[],
        modulesCompleted: 0,
      }),
    } as unknown as EnrollmentService,
    { completedAtFor: async () => opts.lessons ?? [] } as unknown as LessonProgressRepository,
    {
      activityOf: async () => ({ submittedAt: [], completedExercises: 0 }),
    } as unknown as ExerciseStateService,
    badges as unknown as BadgeRepository,
    { showsAchievements: async () => opts.show ?? true } as unknown as UsersService,
    { now: () => NOW } as Clock,
    { emitAsync: emit } as unknown as EventEmitter2,
  );
  return { service, badges, emit };
}

describe('AchievementService', () => {
  it('awards a badge once and announces it once, however often it refreshes', async () => {
    const { service, badges, emit } = setup({ lessons: [NOW] });
    await service.refresh('u-1');
    await service.refresh('u-1');
    await service.mine('u-1');

    expect([...badges.rows.keys()]).toEqual(['first_lesson']);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(LearningEvents.BadgeAwarded, {
      userId: 'u-1',
      badge: 'first_lesson',
      awardedAt: NOW.toISOString(),
    });
  });

  it('counts completed tracks for the finish badge', async () => {
    const { service, badges } = setup({ tracks: [{ status: 'completed' }, { status: 'active' }] });
    await service.refresh('u-1');
    expect(badges.rows.has('first_track')).toBe(true);
  });

  it('returns the streak in Vietnam days with the badges', async () => {
    // the 15th and the 17th: the 16th is the one forgiven day
    const lessons = [new Date('2026-11-15T02:00:00Z'), NOW];
    const { service } = setup({ lessons });
    const result = await service.mine('u-1');
    expect(result?.streak).toEqual({ current: 2, longest: 2 });
    expect(result?.badges.map((b) => b.code)).toEqual(['first_lesson']);
  });

  it('returns null when the member hid achievements, and awards nothing on read', async () => {
    const { service, badges } = setup({ lessons: [NOW], show: false });
    expect(await service.mine('u-1')).toBeNull();
    expect(badges.rows.size).toBe(0);
  });

  it('keeps awarding from learning events while achievements are hidden', async () => {
    const { service, badges } = setup({ lessons: [NOW], show: false });
    await service.refresh('u-1');
    expect(badges.rows.has('first_lesson')).toBe(true);
  });
});
