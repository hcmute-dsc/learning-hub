/** Profile returned by the external identity provider (GitHub in MVP). */
export interface ExternalProfile {
  githubId: bigint;
  login: string;
  name: string | null;
  /** Primary verified email, lower-cased (null if GitHub did not give one) */
  email: string | null;
  /** Every verified email on the account, lower-cased. Used for the approval list. */
  verifiedEmails: string[];
  avatarUrl: string | null;
  /** Only when an org check is configured: true/false, or null if it could not be determined */
  isOrgMember: boolean | null;
}

/**
 * Port owned by the identity module (ARCHITECTURE §7). The GitHub adapter in
 * integrations/github implements it; business code never imports GitHub code.
 */
export interface IdentityProvider {
  /** URL to send the browser to, bound to `state` and the PKCE challenge. */
  authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  /** Exchange the callback code and load the profile. The access token is not kept. */
  fetchProfile(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ExternalProfile>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
