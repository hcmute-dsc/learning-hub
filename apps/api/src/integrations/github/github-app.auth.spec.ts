import { createVerify, generateKeyPairSync } from 'node:crypto';
import { DomainError } from '../../common/errors';
import { appJwt, GithubAppTokens, normalizePrivateKey } from './github-app.auth';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const NOW = new Date('2026-11-25T05:00:00Z');

const json = (status: number, body: object) => new Response(JSON.stringify(body), { status });

describe('appJwt', () => {
  it('signs a short-lived RS256 JWT issued by the App, verifiable with its public key', () => {
    const jwt = appJwt('Iv23liClientId', PEM, NOW);
    const [header, payload, signature] = jwt.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const iat = NOW.getTime() / 1000 - 60;
    expect(claims).toEqual({ iat, exp: iat + 540, iss: 'Iv23liClientId' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('reads a key whose newlines were written as \\n in .env', () => {
    const oneLine = PEM.trim().replace(/\n/g, '\\n');
    expect(normalizePrivateKey(oneLine)).toBe(PEM.trim());
    expect(() => appJwt('id', oneLine, NOW)).not.toThrow();
  });
});

describe('GithubAppTokens', () => {
  function setup() {
    const http = jest.fn(async (url: string, _init: RequestInit) =>
      url.endsWith('/installation')
        ? json(200, { id: 42 })
        : json(201, { token: 'ghs_x', expires_at: '2026-11-25T06:00:00Z' }),
    );
    let now = NOW;
    const tokens = new GithubAppTokens('Iv23li', PEM, http, () => now);
    return { http, tokens, setNow: (d: Date) => (now = d) };
  }

  it('mints a token for one repo with issues: write only, and reuses it until near expiry', async () => {
    const { http, tokens, setNow } = setup();
    await expect(tokens.issuesToken('hcmute-dsc/learning-hub-track-sql')).resolves.toBe('ghs_x');
    expect(http.mock.calls.map((c) => c[0])).toEqual([
      'https://api.github.com/repos/hcmute-dsc/learning-hub-track-sql/installation',
      'https://api.github.com/app/installations/42/access_tokens',
    ]);
    expect(JSON.parse(http.mock.calls[1][1].body as string)).toEqual({
      repositories: ['learning-hub-track-sql'],
      permissions: { issues: 'write' },
    });

    await tokens.issuesToken('hcmute-dsc/learning-hub-track-sql');
    expect(http).toHaveBeenCalledTimes(2); // cached

    setNow(new Date('2026-11-25T05:56:00Z')); // 4 minutes left
    await tokens.issuesToken('hcmute-dsc/learning-hub-track-sql');
    expect(http).toHaveBeenCalledTimes(4);
  });

  it('explains a repo without the App and an App without the Issues permission', async () => {
    const notInstalled = new GithubAppTokens(
      'id',
      PEM,
      async () => json(404, {}),
      () => NOW,
    );
    const err = await notInstalled.issuesToken('o/r').catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toContain('chưa được cài');

    const noPermission = new GithubAppTokens(
      'id',
      PEM,
      async (url: string) => (url.endsWith('/installation') ? json(200, { id: 1 }) : json(422, {})),
      () => NOW,
    );
    const err2 = await noPermission.issuesToken('o/r').catch((e) => e);
    expect(err2.message).toContain('Issues: Read and write');
  });

  it('answers 503 for a private key that cannot be read', async () => {
    const broken = new GithubAppTokens('id', 'not a key', jest.fn(), () => NOW);
    const err = await broken.issuesToken('o/r').catch((e) => e);
    expect(err.status).toBe(503);
  });
});
