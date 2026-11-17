import type { Env } from '../../infrastructure/config/env';
import type { CatalogReader } from '../catalog/catalog.reader';
import type { UsersService } from '../users/users.service';
import { NotificationsListener } from './notifications.listener';

const flush = () => new Promise((r) => setImmediate(r));

function setup(opts: { enabled?: boolean; exerciseFails?: boolean } = {}) {
  const channel = { enabled: opts.enabled ?? true, send: jest.fn(async (_c: string) => {}) };
  const catalog = {
    exercise: jest.fn(async () => {
      if (opts.exerciseFails) throw new Error('not found');
      return { title: 'Todo API', track: { title: 'Backend' } };
    }),
  } as unknown as CatalogReader;
  const users = {
    getMe: jest.fn(async () => ({ githubLogin: 'octocat', email: 'hidden@x.com' })),
  } as unknown as UsersService;
  const env = { WEB_ORIGIN: 'https://learn.example' } as Env;
  return { listener: new NotificationsListener(channel, env, catalog, users), channel, catalog };
}

const submission = { submissionId: 's-1', userId: 'u-1', exerciseId: 'e-1', status: 'x' };

describe('NotificationsListener', () => {
  it('returns before the message is sent, then sends it', async () => {
    const { listener, channel } = setup();
    expect(listener.onAwaitingReview(submission)).toBeUndefined();
    expect(channel.send).not.toHaveBeenCalled();
    await flush();
    const content = channel.send.mock.calls[0][0];
    expect(content).toContain('Todo API');
    expect(content).toContain('octocat');
    expect(content).toContain('https://learn.example/review/s-1');
    expect(content).not.toContain('hidden@x.com');
  });

  it('swallows lookup failures', async () => {
    const { listener, channel } = setup({ exerciseFails: true });
    expect(() => listener.onAwaitingReview(submission)).not.toThrow();
    await flush();
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('skips the lookups when the channel is off', async () => {
    const { listener, catalog } = setup({ enabled: false });
    listener.onReviewCompleted({
      reviewId: 'r',
      submissionId: 's',
      exerciseId: 'e',
      memberId: 'm',
      reviewerId: 'v',
      outcome: 'approved',
    });
    await flush();
    expect(catalog.exercise).not.toHaveBeenCalled();
  });

  it('announces published content', async () => {
    const { listener, channel } = setup();
    listener.onContentPublished({
      actorId: null,
      versionId: 'v',
      commitSha: 'abcdef0123',
      status: 'published',
    });
    await flush();
    expect(channel.send.mock.calls[0][0]).toContain('abcdef0');
  });
});
