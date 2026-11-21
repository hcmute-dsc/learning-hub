import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardRepository } from './leaderboard.repository';
import { LeaderboardService } from './leaderboard.service';

/**
 * E14 opt-in leaderboard (ADR-08). Reads users, submissions, exercises and reviews with
 * one counting query and stores nothing. Imports no other business module.
 */
@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardRepository, LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
