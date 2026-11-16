import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../infrastructure/config/env';
import { DomainError } from '../../common/errors';
import type {
  ExternalProfile,
  IdentityProvider,
} from '../../modules/identity/ports/identity-provider';

const GITHUB = 'https://github.com';
const API = 'https://api.github.com';
const SCOPES = 'read:user user:email read:org';

/** GitHub OAuth adapter. Translates GitHub responses only; no business rules here. */
@Injectable()
export class GithubIdentityProvider implements IdentityProvider {
  constructor(@Inject(ENV) private readonly env: Env) {}

  authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string {
    const url = new URL('/login/oauth/authorize', GITHUB);
    url.searchParams.set('client_id', this.env.GITHUB_CLIENT_ID);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('scope', SCOPES);
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
    if (!this.env.GITHUB_CLIENT_ID || !this.env.GITHUB_CLIENT_SECRET) {
      throw new DomainError('UPSTREAM_ERROR', 503, 'GitHub sign-in is not configured');
    }
    const tokenRes = await fetch(`${GITHUB}/login/oauth/access_token`, {
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
    const token = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !token.access_token) {
      throw new DomainError('UPSTREAM_ERROR', 502, 'GitHub rejected the sign-in code');
    }
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'learning-hub',
    };

    const userRes = await fetch(`${API}/user`, { headers });
    if (!userRes.ok) throw new DomainError('UPSTREAM_ERROR', 502, 'Could not read GitHub profile');
    const user = (await userRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    };

    let email = user.email;
    if (!email) {
      const emailsRes = await fetch(`${API}/user/emails`, { headers });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as {
          email: string;
          primary: boolean;
          verified: boolean;
        }[];
        email = emails.find((e) => e.primary && e.verified)?.email ?? null;
      }
    }

    // 204 = member, 404 = not a member (or hidden), 302 = requester not an org member.
    let isOrgMember: boolean | null = null;
    if (this.env.GITHUB_ORG) {
      const memberRes = await fetch(
        `${API}/orgs/${encodeURIComponent(this.env.GITHUB_ORG)}/members/${encodeURIComponent(user.login)}`,
        { headers, redirect: 'manual' },
      );
      if (memberRes.status === 204) isOrgMember = true;
      else if (memberRes.status === 404 || memberRes.status === 302) isOrgMember = false;
    }

    return {
      githubId: BigInt(user.id),
      login: user.login,
      name: user.name,
      email: email ? email.toLowerCase() : null,
      avatarUrl: user.avatar_url,
      isOrgMember,
    };
  }
}
