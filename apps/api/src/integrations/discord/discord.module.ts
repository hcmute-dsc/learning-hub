import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../infrastructure/config/env';
import { DISCORD_ACCOUNT_PROVIDER } from '../../modules/users/ports/discord-account';
import { DiscordOAuthProvider, DisabledDiscordAccountProvider } from './discord-oauth.provider';

/**
 * Binds the users module's DiscordAccountProvider port (learning-hub#76). Without a
 * client id and secret the provider is disabled and /settings hides the button.
 */
@Module({
  providers: [
    {
      provide: DISCORD_ACCOUNT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
          ? new DiscordOAuthProvider(env)
          : new DisabledDiscordAccountProvider(),
    },
  ],
  exports: [DISCORD_ACCOUNT_PROVIDER],
})
export class DiscordIntegrationModule {}
