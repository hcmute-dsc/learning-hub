import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainError } from '../../common/errors';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DiscordLinkService } from './discord-link.service';
import type { DiscordAccountProvider } from './ports/discord-account';
import { UserEvents } from './users.events';

const ID = '123456789012345678';

function setup(opts: { holder?: string; current?: { id: string | null; name: string | null } }) {
  const user = {
    findUnique: jest.fn(async (args: { where: { id?: string; discordUserId?: string } }) => {
      if (args.where.discordUserId) return opts.holder ? { id: opts.holder } : null;
      return opts.current
        ? { discordUserId: opts.current.id, discordUsername: opts.current.name }
        : null;
    }),
    update: jest.fn(async (_args: unknown) => ({})),
    findMany: jest.fn(async () => [
      { id: 'u1', discordUserId: ID },
      { id: 'u2', discordUserId: null },
    ]),
  };
  const events = { emitAsync: jest.fn(async () => []) };
  const provider: DiscordAccountProvider = {
    enabled: true,
    authorizeUrl: jest.fn(() => 'https://discord.com/oauth2/authorize?x'),
    fetchAccount: jest.fn(async () => ({ id: ID, username: 'an' })),
  };
  const service = new DiscordLinkService(
    { user } as unknown as PrismaService,
    events as unknown as EventEmitter2,
    provider,
  );
  return { service, user, events, provider };
}

describe('DiscordLinkService', () => {
  it('links the account read from Discord and writes the audit event', async () => {
    const { service, user, events } = setup({});
    await service.complete('me', 'code', 'https://hub/cb');
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 'me' },
      data: { discordUserId: ID, discordUsername: 'an' },
    });
    expect(events.emitAsync).toHaveBeenCalledWith(UserEvents.DiscordLinked, {
      userId: 'me',
      discordUsername: 'an',
    });
  });

  it('refuses an account another member already linked', async () => {
    const { service, user } = setup({ holder: 'someone-else' });
    await expect(service.link('me', { id: ID, username: 'an' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it('turns a unique-index race into the same conflict', async () => {
    const { service, user } = setup({});
    user.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(service.link('me', { id: ID, username: 'an' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('refuses an id that is not a Discord snowflake', async () => {
    const { service } = setup({});
    await expect(service.link('me', { id: '<@everyone>', username: 'x' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('unlinks with an audit event, and unlinking again does nothing', async () => {
    const linked = setup({ current: { id: ID, name: 'an' } });
    await linked.service.unlink('me');
    expect(linked.user.update).toHaveBeenCalledWith({
      where: { id: 'me' },
      data: { discordUserId: null, discordUsername: null },
    });
    expect(linked.events.emitAsync).toHaveBeenCalledWith(UserEvents.DiscordUnlinked, {
      userId: 'me',
      discordUsername: 'an',
    });

    const none = setup({ current: { id: null, name: null } });
    await none.service.unlink('me');
    expect(none.user.update).not.toHaveBeenCalled();
    expect(none.events.emitAsync).not.toHaveBeenCalled();
  });

  it('reports the link and maps member ids to Discord ids', async () => {
    const { service } = setup({ current: { id: ID, name: 'an' } });
    await expect(service.status('me')).resolves.toEqual({ available: true, username: 'an' });
    await expect(service.discordIdsOf(['u1', 'u2'])).resolves.toEqual(new Map([['u1', ID]]));
  });
});
