import { Injectable } from '@nestjs/common';
import { ACTIVITY_WEEKS, type MemberProfile } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { UsersService } from '../users/users.service';
import { AchievementService } from './achievement.service';
import { activityGrid } from './activity';

/**
 * Member profile page (/u/:login): who the member is plus what they learned.
 * Lives in learning because most of it is learning data; user facts come from
 * UsersService (users never depends on learning, so the direction stays one way).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    private readonly achievements: AchievementService,
  ) {}

  async byLogin(viewerId: string, login: string): Promise<MemberProfile> {
    const user = await this.users.findActiveByLogin(login);
    if (!user) throw DomainError.notFound('Member');

    const record = await this.achievements.record(user.id);
    // Hidden achievements (F12, /settings) are left out of the response, not just the page.
    const achievements = user.showAchievements
      ? { streak: record.streak, badges: await this.achievements.award(user.id, record.facts) }
      : null;

    return {
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles: user.roles,
      joinedAt: user.createdAt.toISOString(),
      isMe: user.id === viewerId,
      stats: {
        lessonsCompleted: record.facts.lessonsCompleted,
        exercisesCompleted: record.facts.exercisesCompleted,
        tracksCompleted: record.facts.tracksCompleted,
        activeDays: record.days.size,
      },
      achievements,
      activity: activityGrid(record.days, record.today, ACTIVITY_WEEKS),
      tracks: record.tracks,
    };
  }
}
