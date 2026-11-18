import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, checkRepository, importSpecifiers } from './check-boundaries.mjs';

const SERVICE = 'apps/api/src/modules/identity/session.service.ts';
const NEST_MODULE = 'apps/api/src/modules/identity/identity.module.ts';

test('finds static, side-effect, dynamic and require imports', () => {
  const source = [
    "import { A } from './a';",
    "export * from '../b';",
    "import './c';",
    "const d = await import('./d');",
    "const e = require('./e');",
  ].join('\n');
  assert.deepEqual(importSpecifiers(source).sort(), ['../b', './a', './c', './d', './e']);
});

test('a service importing an integration is a violation', () => {
  const source =
    "import { GithubIdentityProvider } from '../../integrations/github/github-identity.provider';";
  assert.deepEqual(checkFile(SERVICE, source), [
    { file: SERVICE, specifier: '../../integrations/github/github-identity.provider' },
  ]);
});

test('a dynamic import of an integration is also a violation', () => {
  const source = "const m = await import('../../integrations/discord/discord.channel');";
  assert.equal(checkFile(SERVICE, source).length, 1);
});

test('a Nest module may import an integration module to bind the adapter', () => {
  const source =
    "import { GithubIntegrationModule } from '../../integrations/github/github.module';";
  assert.deepEqual(checkFile(NEST_MODULE, source), []);
});

test('a Nest module may not import an integration class directly', () => {
  const source =
    "import { GithubIdentityProvider } from '../../integrations/github/github-identity.provider';";
  assert.equal(checkFile(NEST_MODULE, source).length, 1);
});

test('ports, other modules and packages are allowed', () => {
  const source = [
    "import { IDENTITY_PROVIDER } from './ports/identity-provider';",
    "import { UsersService } from '../users/users.service';",
    "import { Injectable } from '@nestjs/common';",
    "import { integrations } from '../../common/integrations-config';",
  ].join('\n');
  assert.deepEqual(checkFile(SERVICE, source), []);
});

test('the repository itself follows the rule', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(checkRepository(root), []);
});
