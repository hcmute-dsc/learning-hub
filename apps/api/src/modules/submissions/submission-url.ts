import { DomainError } from '../../common/errors';

/**
 * What a link submission may point to, decided by the exercise spec:
 * - code exercise → `spec.submit.kind` (github_pr | github_commit)
 * - project exercise → `spec.deliverable` (github_repo_or_pr | link)
 */
export type AcceptedUrl = 'github_pr' | 'github_commit' | 'github_repo_or_pr' | 'link';

/** The parts of a submission URL that are stored on `submissions`. */
export interface SubmissionSource {
  sourceType: 'github_pr' | 'github_commit' | 'link';
  /** canonical URL (GitHub URLs: no query, no fragment, no trailing slash) */
  sourceUrl: string;
  repoFullName: string | null;
  prNumber: number | null;
  headSha: string | null;
}

// GitHub naming rules: logins are alphanumeric + hyphens (max 39), repos [A-Za-z0-9._-].
const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const SHA = /^[0-9a-fA-F]{40}$/;
const PR_NUMBER = /^[1-9][0-9]{0,9}$/;
const MAX_INT = 2_147_483_647; // submissions.pr_number is a Postgres integer

function invalid(message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 422, 'Đường dẫn bài nộp không hợp lệ', [
    { path: 'url', message },
  ]);
}

/** Parse with URL and refuse anything that is not plain https (SECURITY §3). */
function parseHttps(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid('Đường dẫn không đúng định dạng.');
  }
  if (url.protocol !== 'https:') throw invalid('Chỉ chấp nhận đường dẫn https://.');
  if (url.username || url.password) throw invalid('Đường dẫn không được chứa tài khoản/mật khẩu.');
  if (url.port) throw invalid('Đường dẫn không được chỉ định cổng (port).');
  return url;
}

type GitHubPath =
  | { kind: 'repo'; owner: string; repo: string }
  | { kind: 'pull'; owner: string; repo: string; number: number }
  | { kind: 'commit'; owner: string; repo: string; sha: string };

/** Only github.com itself: no subdomains (gist, raw…) and no look-alike hosts (SECURITY §3). */
function parseGitHubPath(url: URL): GitHubPath | null {
  if (url.hostname !== 'github.com') return null;
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  const [owner, repo, section, id] = parts;
  if (!owner || !repo || !OWNER.test(owner) || !REPO.test(repo)) return null;
  if (repo === '.' || repo === '..') return null;

  if (parts.length === 2) return { kind: 'repo', owner, repo };
  if (parts.length !== 4) return null;
  if (section === 'pull' && PR_NUMBER.test(id) && Number(id) <= MAX_INT) {
    return { kind: 'pull', owner, repo, number: Number(id) };
  }
  if (section === 'commit' && SHA.test(id)) {
    return { kind: 'commit', owner, repo, sha: id.toLowerCase() };
  }
  return null;
}

const EXPECTED_SHAPE: Record<Exclude<AcceptedUrl, 'link'>, string> = {
  github_pr: 'https://github.com/{owner}/{repo}/pull/{số}',
  github_commit: 'https://github.com/{owner}/{repo}/commit/{mã sha 40 ký tự}',
  github_repo_or_pr: 'https://github.com/{owner}/{repo} hoặc .../pull/{số}',
};

function matchesAccepted(path: GitHubPath, accepts: Exclude<AcceptedUrl, 'link'>): boolean {
  if (accepts === 'github_pr') return path.kind === 'pull';
  if (accepts === 'github_commit') return path.kind === 'commit';
  return path.kind === 'repo' || path.kind === 'pull';
}

/**
 * Validate a submission URL and extract what we store (SECURITY §3, BACKEND-DESIGN §3.7).
 * For GitHub kinds the repo owner must be the member's own login (case-insensitive):
 * members submit work from their own repo, never someone else's.
 * Throws a 422 DomainError with a Vietnamese message on the `url` field.
 */
export function parseSubmissionUrl(
  raw: string,
  accepts: AcceptedUrl,
  memberLogin: string,
): SubmissionSource {
  const url = parseHttps(raw);

  if (accepts === 'link') {
    // Any https page (deployed site, slides…). The server never fetches it, so there is no SSRF.
    return {
      sourceType: 'link',
      sourceUrl: url.href,
      repoFullName: null,
      prNumber: null,
      headSha: null,
    };
  }

  const path = parseGitHubPath(url);
  if (!path || !matchesAccepted(path, accepts)) {
    throw invalid(`Đường dẫn phải có dạng ${EXPECTED_SHAPE[accepts]}.`);
  }
  if (path.owner.toLowerCase() !== memberLogin.toLowerCase()) {
    throw invalid(`Repo phải thuộc tài khoản GitHub của bạn (${memberLogin}).`);
  }

  const repoFullName = `${path.owner}/${path.repo}`;
  const base = `https://github.com/${repoFullName}`;
  switch (path.kind) {
    case 'pull':
      return {
        sourceType: 'github_pr',
        sourceUrl: `${base}/pull/${path.number}`,
        repoFullName,
        prNumber: path.number,
        headSha: null, // known only after reading the PR from GitHub (E6)
      };
    case 'commit':
      return {
        sourceType: 'github_commit',
        sourceUrl: `${base}/commit/${path.sha}`,
        repoFullName,
        prNumber: null,
        headSha: path.sha,
      };
    case 'repo':
      // A whole repo (project deliverable) has no own source type in DATABASE.md, so it is a link.
      return { sourceType: 'link', sourceUrl: base, repoFullName, prNumber: null, headSha: null };
  }
}
