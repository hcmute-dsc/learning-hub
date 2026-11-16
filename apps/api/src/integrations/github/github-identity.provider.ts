import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../infrastructure/config/env';
import { DomainError } from '../../common/errors';
import type {
  ExternalProfile,
  IdentityProvider,
} from '../../modules/identity/ports/identity-provider';

const GITHUB = 'https://github.com';
const API = 'https://api.github.com';

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * GitHub OAuth adapter. It only translates GitHub responses into ExternalProfile;
 * deciding who is approved is the users module's job (SECURITY §1).
 */
@Injectable()
export class GithubIdentityProvider implements IdentityProvider {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Least privilege: `read:org` is requested only when the optional org check is on. */
  private get scopes(): string {
    return ['read:user', 'user:email', ...(this.env.GITHUB_ORG ? ['read:org'] : [])].join(' ');
  }

  authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string {
    const url = new URL('/login/oauth/authorize', GITHUB);
    url.searchParams.set('client_id', this.env.GITHUB_CLIENT_ID);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('scope', this.scopes);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('allow_signup', 'true');
    return url.toString();
  }

  async fetchProfile(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ExternalProfile> {
    const token = await this.exchangeCode(input);
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'learning-hub',
    };

    const user = await this.getJson<GithubUser>(
      `${API}/user`,
      headers,
      'Could not read GitHub profile',
    );
    const emails = await this.getJson<GithubEmail[]>(
      `${API}/user/emails`,
      headers,
      'Could not read GitHub emails',
    );
    const verified = emails.filter((e) => e.verified);

    return {
      githubId: BigInt(user.id),
      login: user.login,
      name: user.name,
      email: verified.find((e) => e.primary)?.email.toLowerCase() ?? null,
      verifiedEmails: verified.map((e) => e.email.toLowerCase()),
      avatarUrl: user.avatar_url,
      isOrgMember: this.env.GITHUB_ORG ? await this.checkOrgMember(user.login, headers) : null,
    };
  }

  private async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string> {
    if (!this.env.GITHUB_CLIENT_ID || !this.env.GITHUB_CLIENT_SECRET) {
      throw new DomainError('UPSTREAM_ERROR', 503, 'GitHub sign-in is not configured');
    }
    const res = await fetch(`${GITHUB}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.env.GITHUB_CLIENT_ID,
        client_secret: this.env.GITHUB_CLIENT_SECRET,
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
      }),
    });
    const body = (await res.json()) as { access_token?: string };
    if (!res.ok || !body.access_token) {
      throw new DomainError('UPSTREAM_ERROR', 502, 'GitHub rejected the sign-in code');
    }
    return body.access_token;
  }

  private async getJson<T>(
    url: string,
    headers: Record<string, string>,
    error: string,
  ): Promise<T> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new DomainError('UPSTREAM_ERROR', 502, error);
    return (await res.json()) as T;
  }

  /** 204 = member, 404/302 = not a member (or membership hidden), other = unknown. */
  private async checkOrgMember(
    login: string,
    headers: Record<string, string>,
  ): Promise<boolean | null> {
    const url = `${API}/orgs/${encodeURIComponent(this.env.GITHUB_ORG)}/members/${encodeURIComponent(login)}`;
    const res = await fetch(url, { headers, redirect: 'manual' });
    if (res.status === 204) return true;
    if (res.status === 404 || res.status === 302) return false;
    return null;
  }
}
