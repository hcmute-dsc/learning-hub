import {
  reactivateRefusal,
  roleChangeRefusal,
  suspendRefusal,
  type RoleChangeFacts,
} from './account-rules';

const roles = (over: Partial<RoleChangeFacts> = {}): RoleChangeFacts => ({
  actorId: 'admin-a',
  targetId: 'user-b',
  currentRoles: ['member'],
  nextRoles: ['member', 'mentor'],
  activeAdminCount: 2,
  ...over,
});

describe('roleChangeRefusal', () => {
  it('allows granting roles, admin included', () => {
    expect(roleChangeRefusal(roles())).toBeNull();
    expect(roleChangeRefusal(roles({ nextRoles: ['admin'], activeAdminCount: 1 }))).toBeNull();
  });

  it('allows an admin to change their own other roles while keeping admin', () => {
    const self = roles({ targetId: 'admin-a', currentRoles: ['member', 'admin'] });
    expect(roleChangeRefusal({ ...self, nextRoles: ['admin', 'mentor'] })).toBeNull();
  });

  it('refuses removing your own admin role, even when other admins exist', () => {
    const self = roles({
      targetId: 'admin-a',
      currentRoles: ['member', 'admin'],
      nextRoles: ['member'],
      activeAdminCount: 3,
    });
    expect(roleChangeRefusal(self)).toMatch(/own admin/);
  });

  it('refuses demoting the last admin', () => {
    const last = roles({ currentRoles: ['admin'], nextRoles: ['mentor'], activeAdminCount: 1 });
    expect(roleChangeRefusal(last)).toMatch(/last admin/);
  });

  it('allows demoting another admin when one more remains', () => {
    const other = roles({ currentRoles: ['admin'], nextRoles: ['mentor'], activeAdminCount: 2 });
    expect(roleChangeRefusal(other)).toBeNull();
  });
});

describe('suspendRefusal', () => {
  it('allows suspending an active or pending account', () => {
    expect(suspendRefusal({ actorId: 'a', targetId: 'b', targetStatus: 'active' })).toBeNull();
    expect(suspendRefusal({ actorId: 'a', targetId: 'b', targetStatus: 'pending' })).toBeNull();
  });

  it('refuses suspending yourself', () => {
    expect(suspendRefusal({ actorId: 'a', targetId: 'a', targetStatus: 'active' })).toMatch(
      /your own/,
    );
  });

  it('refuses suspending twice', () => {
    expect(suspendRefusal({ actorId: 'a', targetId: 'b', targetStatus: 'suspended' })).toMatch(
      /already/,
    );
  });
});

describe('reactivateRefusal', () => {
  it('only reactivates suspended accounts', () => {
    expect(reactivateRefusal('suspended')).toBeNull();
    expect(reactivateRefusal('active')).not.toBeNull();
    expect(reactivateRefusal('pending')).not.toBeNull();
  });
});
