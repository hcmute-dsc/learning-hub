import { createSign } from 'node:crypto';
import { DomainError } from '../../common/errors';

const API = 'https://api.github.com';
const TIMEOUT_MS = 20_000;
/** GitHub allows at most 10 minutes; backdated a minute for clock drift (GitHub docs). */
const JWT_BACKDATE_S = 60;
const JWT_LIFETIME_S = 9 * 60;
/** An installation token lives 1 hour; a new one is minted when less than this is left. */
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/**
 * `.env` files hold one line per value, so the App's private key may arrive with `\n`
 * written out (deploy/README Bước 15). Real newlines work too.
 */
export function normalizePrivateKey(key: string): string {
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

/**
 * The app's own JWT (RS256), signed with its private key. `iss` is the App's Client ID,
 * which GitHub accepts like the App ID (the org's Actions already know the App by it).
 */
export function appJwt(clientId: string, privateKey: string, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000) - JWT_BACKDATE_S;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat, exp: iat + JWT_LIFETIME_S, iss: clientId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64url(signer.sign(normalizePrivateKey(privateKey)))}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Installation tokens of the organization's GitHub App (`hcmute-dsc-learning-hub`,
 * SECURITY §10). Each token is limited to ONE repo and to `issues: write`, and is kept in
 * memory until 5 minutes before it expires. Nothing is written to disk or logs.
 */
export class GithubAppTokens {
  private readonly tokens = new Map<string, CachedToken>();

  constructor(
    private readonly clientId: string,
    private readonly privateKey: string,
    private readonly http: Fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** A token that may write issues in `repo` ("owner/name"). */
  async issuesToken(repo: string): Promise<string> {
    const cached = this.tokens.get(repo);
    if (cached && cached.expiresAt - this.now().getTime() > TOKEN_REFRESH_MS) return cached.token;

    let jwt: string;
    try {
      jwt = appJwt(this.clientId, this.privateKey, this.now());
    } catch {
      throw new DomainError(
        'UPSTREAM_ERROR',
        503,
        'Không đọc được khóa riêng của GitHub App (GITHUB_APP_PRIVATE_KEY).',
      );
    }
    const installation = await this.call(`${API}/repos/${repo}/installation`, 'GET', jwt);
    if (installation.status === 404) {
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        `GitHub App của CLB chưa được cài trên ${repo}. Owner của org cần cài App cho repo này.`,
      );
    }
    if (installation.status === 401) {
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        'GitHub từ chối khóa của GitHub App (GITHUB_APP_CLIENT_ID / GITHUB_APP_PRIVATE_KEY sai hoặc đã đổi).',
      );
    }
    if (!installation.ok) {
      throw new DomainError('UPSTREAM_ERROR', 502, `GitHub trả lỗi ${installation.status}`);
    }
    const { id } = (await installation.json()) as { id: number };

    const name = repo.split('/')[1];
    const minted = await this.call(`${API}/app/installations/${id}/access_tokens`, 'POST', jwt, {
      repositories: [name],
      permissions: { issues: 'write' },
    });
    if (minted.status === 403 || minted.status === 422) {
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        'GitHub App của CLB chưa có quyền "Issues: Read and write". Owner của org cần cấp quyền và chấp nhận cập nhật quyền.',
      );
    }
    if (minted.status !== 201) {
      throw new DomainError('UPSTREAM_ERROR', 502, `GitHub trả lỗi ${minted.status}`);
    }
    const body = (await minted.json()) as { token: string; expires_at: string };
    this.tokens.set(repo, { token: body.token, expiresAt: Date.parse(body.expires_at) });
    return body.token;
  }

  private async call(url: string, method: string, jwt: string, body?: object): Promise<Response> {
    try {
      return await this.http(url, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'learning-hub',
          Authorization: `Bearer ${jwt}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new DomainError('UPSTREAM_ERROR', 502, 'Không kết nối được GitHub. Thử lại sau.');
    }
  }
}
