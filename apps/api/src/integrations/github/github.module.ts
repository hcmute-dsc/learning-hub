import { Module } from '@nestjs/common';
import { IDENTITY_PROVIDER } from '../../modules/identity/ports/identity-provider';
import { GithubIdentityProvider } from './github-identity.provider';

/**
 * GitHub adapters. Business modules depend on the ports; this module binds them.
 * Later: ContentSource, RepoReader, webhook controller (ARCHITECTURE §7).
 */
@Module({
  providers: [{ provide: IDENTITY_PROVIDER, useClass: GithubIdentityProvider }],
  exports: [IDENTITY_PROVIDER],
})
export class GithubIntegrationModule {}
