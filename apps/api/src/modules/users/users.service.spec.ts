import { initialStatus } from './users.service';

const env = { ALLOWLIST_GITHUB_LOGINS: ['friend'], BOOTSTRAP_ADMIN_GITHUB_LOGIN: 'chair' };

describe('initialStatus', () => {
  it('activates org members', () => {
    expect(initialStatus({ login: 'Linh', isOrgMember: true }, env)).toBe('active');
  });

  it('activates allowlisted logins case-insensitively', () => {
    expect(initialStatus({ login: 'FRIEND', isOrgMember: false }, env)).toBe('active');
  });

  it('activates the bootstrap admin', () => {
    expect(initialStatus({ login: 'chair', isOrgMember: null }, env)).toBe('active');
  });

  it('keeps everyone else pending, including when the org check failed', () => {
    expect(initialStatus({ login: 'stranger', isOrgMember: false }, env)).toBe('pending');
    expect(initialStatus({ login: 'stranger', isOrgMember: null }, env)).toBe('pending');
  });
});
