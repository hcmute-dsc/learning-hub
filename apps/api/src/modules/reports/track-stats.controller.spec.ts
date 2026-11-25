import { ZodError } from 'zod';
import { trackStatsQuerySchema } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { TrackStatsController } from './track-stats.controller';
import type { TrackStatsService } from './track-stats.service';

/** `?days=` of GET /tracks/:slug/stats (learning-hub#126). */
describe('TrackStatsController days', () => {
  const pipe = new ZodPipe(trackStatsQuerySchema);
  const parse = (query: Record<string, unknown>) => pipe.transform(query, { type: 'query' });

  it('accepts the four periods and defaults to 14 days', () => {
    expect(parse({})).toEqual({ days: 14 });
    for (const days of [7, 14, 30, 90]) expect(parse({ days: String(days) })).toEqual({ days });
  });

  it('rejects any other value (422 through ZodError)', () => {
    for (const days of ['0', '8', '365', '-7', '7.5', 'abc', '', ['7', '14']]) {
      expect(() => parse({ days })).toThrow(ZodError);
    }
  });

  it('passes the parsed days to the service', async () => {
    const stats = jest.fn(async () => ({ track: { slug: 'sql' } }));
    const controller = new TrackStatsController({ stats } as unknown as TrackStatsService);
    const viewer: AuthUser = { id: 'm', githubLogin: 'm', status: 'active', roles: ['mentor'] };
    await expect(controller.get(viewer, 'sql', parse({ days: '30' }))).resolves.toEqual({
      data: { track: { slug: 'sql' } },
    });
    expect(stats).toHaveBeenCalledWith(viewer, 'sql', 30);
  });
});
