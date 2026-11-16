import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { checkAccess } from './auth.guard';

const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  githubLogin: 'linh',
  status: 'active',
  roles: ['member'],
  ...over,
});
const opts = { isPublic: false, allowPending: false, roles: [] as AuthUser['roles'] };

const codeOf = (fn: () => void): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as DomainError).code;
  }
};

describe('checkAccess', () => {
  it('lets anyone through public routes', () => {
    expect(codeOf(() => checkAccess(null, { ...opts, isPublic: true }))).toBeUndefined();
  });

  it('requires a session otherwise', () => {
    expect(codeOf(() => checkAccess(null, opts))).toBe('UNAUTHENTICATED');
  });

  it('blocks pending users unless the route allows them', () => {
    const pending = user({ status: 'pending' });
    expect(codeOf(() => checkAccess(pending, opts))).toBe('ACCOUNT_PENDING');
    expect(codeOf(() => checkAccess(pending, { ...opts, allowPending: true }))).toBeUndefined();
  });

  it('blocks suspended users everywhere except public routes', () => {
    expect(
      codeOf(() => checkAccess(user({ status: 'suspended' }), { ...opts, allowPending: true })),
    ).toBe('FORBIDDEN');
  });

  it('enforces roles, with admin passing every role check', () => {
    const mentorOnly = { ...opts, roles: ['mentor'] as AuthUser['roles'] };
    expect(codeOf(() => checkAccess(user(), mentorOnly))).toBe('FORBIDDEN');
    expect(
      codeOf(() => checkAccess(user({ roles: ['member', 'mentor'] }), mentorOnly)),
    ).toBeUndefined();
    expect(
      codeOf(() => checkAccess(user({ roles: ['member', 'admin'] }), mentorOnly)),
    ).toBeUndefined();
  });
});
