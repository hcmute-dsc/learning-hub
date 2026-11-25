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
