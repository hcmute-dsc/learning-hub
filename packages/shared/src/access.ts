import type { Role } from './index';

/**
 * Small role rules used by both the API and the web, so a link and the endpoint behind it
 * never disagree. Tested where they are used (web content-url.test.ts, API specs).
 */

/**
 * Who sees "✎ Sửa trên GitHub" (learning-hub#122): staff who edit or review content, that is
 * admins, mentors and content maintainers ("Biên tập nội dung"). Members report mistakes
 * with the "Báo lỗi nội dung" button instead, or open a pull request from the track repo.
 */
export function canEditOnGitHub(roles: readonly Role[]): boolean {
  return roles.some((r) => r === 'admin' || r === 'mentor' || r === 'content_maintainer');
}

/**
 * Who handles content reports (learning-hub#121): admins and every mentor, for every track,
 * the same rule as the review queue (#30) and the track statistics (#118).
 */
export function canHandleContentReports(roles: readonly Role[]): boolean {
  return roles.includes('admin') || roles.includes('mentor');
}

const GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const GITHUB_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * True for a GitHub "owner/repo" (not a `local:` folder used in development). `.` and `..`
 * are refused as the repo name, so a value can never walk up a URL path.
 */
export function isGithubRepo(repo: string): boolean {
  const parts = repo.split('/');
  if (parts.length !== 2) return false;
  const [owner, name] = parts;
  return GITHUB_OWNER.test(owner) && GITHUB_NAME.test(name) && name !== '.' && name !== '..';
}
