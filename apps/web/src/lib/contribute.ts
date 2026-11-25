/**
 * Where each kind of contribution goes (DECISIONS ADR-10, learning-hub-docs WORKFLOW §7.7):
 * lessons live in one repo per track, learning-hub-content is the registry of tracks,
 * learning-hub holds the app. The /contribute page only links; it holds no state.
 */
const ORG = 'hcmute-dsc';
const GITHUB = 'https://github.com';

export const REPOS = {
  /** registry: tracks.yaml, proposals for new tracks, publish PRs */
  registry: `${ORG}/learning-hub-content`,
  app: `${ORG}/learning-hub`,
  docs: `${ORG}/learning-hub-docs`,
  template: `${ORG}/learning-hub-track-template`,
} as const;

/** Track repos follow `learning-hub-track-<slug>` (ADR-10). */
export function trackRepo(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`invalid track slug: ${slug}`);
  return `${ORG}/learning-hub-track-${slug}`;
}

export function repoUrl(repo: string, path = ''): string {
  return `${GITHUB}/${repo}${path}`;
}

/** "New issue" with one of the repo's issue forms (`.github/ISSUE_TEMPLATE/<file>`). */
export function newIssueUrl(repo: string, template: string): string {
  return `${GITHUB}/${repo}/issues/new?template=${encodeURIComponent(template)}`;
}

/** Open issues of a repo carrying one label, e.g. "good first issue". */
export function labelledIssuesUrl(repo: string, label: string): string {
  const q = `is:issue is:open label:"${label}"`;
  return `${GITHUB}/${repo}/issues?q=${encodeURIComponent(q)}`;
}

/** A Markdown file on the main branch of a repo. */
export function docUrl(repo: string, path: string): string {
  return `${GITHUB}/${repo}/blob/main/${path}`;
}

export const CONTRIBUTE_LINKS = {
  proposeTrack: newIssueUrl(REPOS.registry, 'content_proposal.yml'),
  registryFile: docUrl(REPOS.registry, 'tracks.yaml'),
  newTrackGuide: docUrl(REPOS.docs, 'docs/ops/NEW-TRACK.md'),
  contentSpec: docUrl(REPOS.docs, 'docs/product/CONTENT-SPECIFICATION.md'),
  template: repoUrl(REPOS.template),
  /** every track repo is made from the template, so its CONTRIBUTING.md is the same */
  trackContributing: docUrl(REPOS.template, 'CONTRIBUTING.md'),
  appContributing: docUrl(REPOS.app, 'CONTRIBUTING.md'),
  appBug: newIssueUrl(REPOS.app, 'bug_report.yml'),
  goodFirstIssues: labelledIssuesUrl(REPOS.app, 'good first issue'),
  workflow: docUrl(REPOS.docs, 'docs/ops/WORKFLOW.md'),
} as const;
