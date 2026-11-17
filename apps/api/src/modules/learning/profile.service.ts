import { Injectable } from '@nestjs/common';
import { ACTIVITY_WEEKS, type MemberProfile } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ExerciseStateService } from '../submissions/exercise-state.service';
import { UsersService } from '../users/users.service';
import { activityGrid, countByDay, streaks, vietnamDay } from './activity';
import { EnrollmentService } from './enrollment.service';
import { LessonProgressRepository } from './lesson-progress.repository';

/**
 * Member profile page (/u/:login): who the member is plus what they learned.
 * Lives in learning because most of it is learning data; user facts come from
 * UsersService (users never depends on learning, so the direction stays one way).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    private readonly enrollments: EnrollmentService,
    private readonly lessonProgress: LessonProgressRepository,
    private readonly exerciseStates: ExerciseStateService,
    private readonly clock: Clock,
  ) {}

  async byLogin(viewerId: string, login: string): Promise<MemberProfile> {
    const user = await this.users.findActiveByLogin(login);
    if (!user) throw DomainError.notFound('Member');

    const [tracks, lessonTimes, submissions] = await Promise.all([
      this.enrollments.listMine(user.id),
      this.lessonProgress.completedAtFor(user.id),
      this.exerciseStates.activityOf(user.id),
    ]);

    const counts = countByDay([...lessonTimes, ...submissions.submittedAt]);
    const today = vietnamDay(this.clock.now());
    const streak = streaks(counts.keys(), today);

    return {
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles: user.roles,
      joinedAt: user.createdAt.toISOString(),
      isMe: user.id === viewerId,
      stats: {
        lessonsCompleted: lessonTimes.length,
        exercisesCompleted: submissions.completedExercises,
        tracksCompleted: tracks.filter((t) => t.status === 'completed').length,
        activeDays: counts.size,
        currentStreak: streak.current,
        longestStreak: streak.longest,
      },
      activity: activityGrid(counts, today, ACTIVITY_WEEKS),
      tracks,
    };
  }
}
