import { describe, expect, it } from 'vitest';
import { ADMIN_TABS, adminHomeFor, adminTabsFor, isTabActive } from './admin-tabs';

const hrefs = (roles: Parameters<typeof adminTabsFor>[0]) => adminTabsFor(roles).map((t) => t.href);

describe('adminTabsFor', () => {
  it('shows every tab to admins', () => {
    expect(hrefs(['member', 'admin'])).toEqual([
      '/admin/members',
      '/admin/content',
      '/admin/audit',
    ]);
  });

  it('shows members to mentors and content to content maintainers only', () => {
    expect(hrefs(['member', 'mentor'])).toEqual(['/admin/members']);
    expect(hrefs(['member', 'content_maintainer'])).toEqual(['/admin/content']);
    expect(hrefs(['member', 'mentor', 'content_maintainer'])).toEqual([
      '/admin/members',
      '/admin/content',
    ]);
  });

  it('shows nothing to plain members', () => {
    expect(hrefs(['member'])).toEqual([]);
  });
});

describe('adminHomeFor', () => {
  it('is the first tab the person may open', () => {
    expect(adminHomeFor(['member', 'admin'])).toBe('/admin/members');
    expect(adminHomeFor(['member', 'content_maintainer'])).toBe('/admin/content');
    expect(adminHomeFor(['member'])).toBeNull();
  });
});

describe('isTabActive', () => {
  it('matches the tab and its sub-pages, not a lookalike prefix', () => {
    const content = ADMIN_TABS[1];
    expect(isTabActive(content, '/admin/content')).toBe(true);
    expect(isTabActive(content, '/admin/content/versions/abc')).toBe(true);
    expect(isTabActive(content, '/admin/contentx')).toBe(false);
  });
});
