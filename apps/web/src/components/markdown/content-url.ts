/**
 * Lessons are Markdown files inside a Git content repo, so their relative links and
 * images point at other files of that repo. The web app has no copy of those files,
 * so we point them at GitHub at the exact published commit (CONTENT-SPECIFICATION:
 * every published version is pinned to a commit SHA).
 * Pure functions: tested in content-url.test.ts.
 */

/** Where a Markdown document comes from, as the API returns it (`source`). */
export interface ContentOrigin {
  /** "owner/repo" on GitHub, or "local:<folder>" during local development */
  repo: string;
  commitSha: string;
  /** Path of the Markdown file inside the repo, POSIX style */
  path: string;
}

const GITHUB_REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const HAS_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
/** Same-origin API path (next.config rewrites /api/*), served only when CONTENT_SOURCE=local. */
const LOCAL_IMAGE_BASE = '/api/v1/local-content/';

/** True when `repo` is a real GitHub "owner/repo", not a local folder. */
export function isGithubRepo(repo: string): boolean {
  return GITHUB_REPO.test(repo);
}

/** "Sửa trên GitHub" target, or null when the content is not on GitHub. */
export function githubBlobUrl(origin: ContentOrigin): string | null {
  if (!isGithubRepo(origin.repo)) return null;
  return `https://github.com/${origin.repo}/blob/${origin.commitSha}/${origin.path}`;
}

/**
 * Rewrites one URL found in a Markdown document.
 * - absolute URLs, protocol-relative URLs and in-page anchors (#x) are kept;
 * - with no origin everything is kept (nothing to resolve against);
 * - GitHub repo: images → raw.githubusercontent.com so the browser gets the file
 *   itself; other links → github.com/blob so the reader sees the file rendered by GitHub;
 * - `local:` folder (development): images → the API's /local-content endpoint
 *   (apps/api/src/integrations/local); other links are kept, there is nothing to open.
 */
export function rewriteContentUrl(
  url: string,
  kind: 'image' | 'link',
  origin: ContentOrigin | null,
): string {
  if (!origin) return url;
  if (url === '' || url.startsWith('#') || url.startsWith('//') || HAS_SCHEME.test(url)) {
    return url;
  }
  const github = isGithubRepo(origin.repo);
  if (!github && !(kind === 'image' && origin.repo.startsWith('local:'))) return url;

  const { pathPart, suffix } = splitSuffix(url);
  const resolved = resolvePosix(origin.path, pathPart);
  if (!github)
    return LOCAL_IMAGE_BASE + resolved.split('/').map(encodeURIComponent).join('/') + suffix;
  const base =
    kind === 'image'
      ? `https://raw.githubusercontent.com/${origin.repo}/${origin.commitSha}/`
      : `https://github.com/${origin.repo}/blob/${origin.commitSha}/`;
  return base + resolved + suffix;
}

/** "a/b.png?x#y" → { pathPart: "a/b.png", suffix: "?x#y" } (the suffix is kept as is). */
function splitSuffix(url: string): { pathPart: string; suffix: string } {
  let cut = url.length;
  const query = url.indexOf('?');
  const hash = url.indexOf('#');
  if (query !== -1) cut = query;
  if (hash !== -1 && hash < cut) cut = hash;
  return { pathPart: url.slice(0, cut), suffix: url.slice(cut) };
}

/**
 * Resolves `target` against the folder of `fromFile`, like GitHub does:
 * "/x" starts at the repo root, ".." never climbs above the root.
 */
export function resolvePosix(fromFile: string, target: string): string {
  const parts: string[] = [];
  if (!target.startsWith('/')) {
    const folder = fromFile.split('/').slice(0, -1);
    for (const segment of folder) {
      if (segment !== '' && segment !== '.') parts.push(segment);
    }
  }
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}
