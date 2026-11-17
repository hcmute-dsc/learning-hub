import { describe, expect, it } from 'vitest';
import { grantsAdmin, roleLockReason, sameRoles, toggleRole } from './role-edit';

describe('toggleRole', () => {
  it('adds and removes a role, always keeping member first', () => {
    expect(toggleRole(['member'], 'admin')).toEqual(['member', 'admin']);
    expect(toggleRole(['member', 'mentor', 'admin'], 'mentor')).toEqual(['member', 'admin']);
  });

  it('keeps a stable order whatever the click order', () => {
    expect(toggleRole(['member', 'admin'], 'mentor')).toEqual(['member', 'mentor', 'admin']);
  });

  it('never removes member', () => {
    expect(toggleRole(['member'], 'member')).toEqual(['member']);
  });
});

describe('sameRoles', () => {
  it('ignores order', () => {
    expect(sameRoles(['member', 'admin'], ['admin', 'member'])).toBe(true);
    expect(sameRoles(['member'], ['member', 'mentor'])).toBe(false);
  });
});

describe('grantsAdmin', () => {
  it('is true only when admin is newly added', () => {
    expect(grantsAdmin(['member'], ['member', 'admin'])).toBe(true);
    expect(grantsAdmin(['member', 'admin'], ['member', 'admin', 'mentor'])).toBe(false);
    expect(grantsAdmin(['member', 'admin'], ['member'])).toBe(false);
  });
});

describe('roleLockReason', () => {
  it('locks your own admin checkbox only', () => {
    expect(roleLockReason('admin', ['member', 'admin'], true)).not.toBeNull();
    expect(roleLockReason('admin', ['member', 'admin'], false)).toBeNull();
    expect(roleLockReason('mentor', ['member', 'admin'], true)).toBeNull();
  });
});
