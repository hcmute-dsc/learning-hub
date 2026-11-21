import { Test } from '@nestjs/testing';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LeaderboardModule } from './leaderboard.module';
import { LeaderboardService } from './leaderboard.service';

/** Wiring check without a database. */
describe('LeaderboardModule wiring', () => {
  it('resolves the leaderboard service', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InfrastructureModule, LeaderboardModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({ LEADERBOARD_WEIGHT_GRADED: 3, LEADERBOARD_WEIGHT_SELF_CHECK: 1 })
      .compile();
    expect(moduleRef.get(LeaderboardService)).toBeInstanceOf(LeaderboardService);
  });
});
