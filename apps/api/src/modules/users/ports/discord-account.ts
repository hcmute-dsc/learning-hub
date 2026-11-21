/** The Discord account a member linked: what scope `identify` gives, nothing more. */
export interface DiscordAccount {
  /** snowflake id, digits only */
  id: string;
  /** current Discord username (unique handle, not the display name) */
  username: string;
}

/**
 * Port owned by the users module (learning-hub#76). The Discord adapter in
 * integrations/discord implements it with OAuth2, scope `identify` only: it reads the
 * account id and name, never messages or the member's servers. The access token is
 * thrown away after the one call.
 */
export interface DiscordAccountProvider {
  /** false when the Discord application is not configured: linking is off */
  readonly enabled: boolean;
  /** URL to send the browser to, bound to `state`. */
  authorizeUrl(input: { state: string; redirectUri: string }): string;
  /** Exchange the callback code and read the account. */
  fetchAccount(input: { code: string; redirectUri: string }): Promise<DiscordAccount>;
}

export const DISCORD_ACCOUNT_PROVIDER = Symbol('DISCORD_ACCOUNT_PROVIDER');

/** Discord ids are snowflakes (same rule as the CHECK in the migration). */
export const DISCORD_ID_PATTERN = /^[0-9]{15,21}$/;
