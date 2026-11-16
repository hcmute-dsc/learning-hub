import { approvalReason, normalizeEmail, type SignInFacts } from './approval';

const list = new Set(['linh@student.hcmute.edu.vn']);
const onList = (email: string) => list.has(email);
const facts = (over: Partial<SignInFacts> = {}): SignInFacts => ({
  login: 'stranger',
  verifiedEmails: ['stranger@gmail.com'],
  isOrgMember: null,
  ...over,
});

describe('approvalReason', () => {
  it('approves when any verified email is on the club list (not only the primary one)', () => {
    const f = facts({ verifiedEmails: ['linh@gmail.com', 'linh@student.hcmute.edu.vn'] });
    expect(approvalReason(f, onList, undefined)).toBe('approved_email');
  });

  it('approves the bootstrap admin by login, case-insensitively', () => {
    expect(approvalReason(facts({ login: 'TienNHM' }), onList, 'tiennhm')).toBe('bootstrap_admin');
  });

  it('approves org members only when the optional org check said yes', () => {
    expect(approvalReason(facts({ isOrgMember: true }), onList, undefined)).toBe('org_member');
    expect(approvalReason(facts({ isOrgMember: false }), onList, undefined)).toBeNull();
  });

  it('leaves everyone else pending', () => {
    expect(approvalReason(facts(), onList, undefined)).toBeNull();
    expect(approvalReason(facts({ verifiedEmails: [] }), onList, undefined)).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Linh@Student.HCMUTE.edu.vn ')).toBe('linh@student.hcmute.edu.vn');
  });
});
