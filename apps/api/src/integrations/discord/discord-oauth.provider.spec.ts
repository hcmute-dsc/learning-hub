import { DiscordOAuthProvider } from './discord-oauth.provider';

const env = { DISCORD_CLIENT_ID: 'client-1', DISCORD_CLIENT_SECRET: 'not-a-real-secret' };

describe('DiscordOAuthProvider', () => {
  it('asks for scope identify only', () => {
    const url = new URL(
      new DiscordOAuthProvider(env).authorizeUrl({ state: 's1', redirectUri: 'https://hub/cb' }),
    );
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('identify');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('exchanges the code, reads /users/@me and returns id + username', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'tok' }))
      .mockResolvedValueOnce(Response.json({ id: '123456789012345678', username: 'an' }));
    const provider = new DiscordOAuthProvider(env, fetch as unknown as typeof globalThis.fetch);
    await expect(
      provider.fetchAccount({ code: 'c', redirectUri: 'https://hub/cb' }),
    ).resolves.toEqual({ id: '123456789012345678', username: 'an' });

    const [tokenUrl, tokenInit] = fetch.mock.calls[0];
    expect(tokenUrl).toBe('https://discord.com/api/oauth2/token');
    const form = tokenInit.body as URLSearchParams;
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('redirect_uri')).toBe('https://hub/cb');
    expect(fetch.mock.calls[1][1].headers).toEqual({ authorization: 'Bearer tok' });
  });

  it('fails without leaking anything when Discord refuses or sends a bad id', async () => {
    const refused = jest.fn().mockResolvedValueOnce(new Response('no', { status: 400 }));
    await expect(
      new DiscordOAuthProvider(env, refused as never).fetchAccount({ code: 'c', redirectUri: 'r' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });

    const badId = jest
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'tok' }))
      .mockResolvedValueOnce(Response.json({ id: '@everyone', username: 'x' }));
    await expect(
      new DiscordOAuthProvider(env, badId as never).fetchAccount({ code: 'c', redirectUri: 'r' }),
    ).rejects.toThrow('unexpected account id');
  });
});
