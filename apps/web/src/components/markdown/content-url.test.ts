import { describe, expect, it } from 'vitest';
import { canEditOnGitHub } from '@hub/shared';
import {
  editOnGitHubUrl,
  githubBlobUrl,
  isGithubRepo,
  resolvePosix,
  rewriteContentUrl,
  type ContentOrigin,
} from './content-url';

const origin: ContentOrigin = {
  repo: 'hcmute-dsc/learning-content',
  commitSha: 'abc123',
  path: 'tracks/git/modules/basics/lessons/intro.md',
};

describe('resolvePosix', () => {
  it('resolves relative to the folder of the file', () => {
    expect(resolvePosix('a/b/c.md', 'img/x.png')).toBe('a/b/img/x.png');
    expect(resolvePosix('a/b/c.md', './x.png')).toBe('a/b/x.png');
    expect(resolvePosix('a/b/c.md', '../x.png')).toBe('a/x.png');
  });

  it('treats a leading slash as the repo root', () => {
    expect(resolvePosix('a/b/c.md', '/assets/x.png')).toBe('assets/x.png');
  });

  it('never climbs above the repo root', () => {
    expect(resolvePosix('a/c.md', '../../../x.png')).toBe('x.png');
  });
});

describe('rewriteContentUrl', () => {
  it('sends images to raw.githubusercontent.com at the commit', () => {
    expect(rewriteContentUrl('../assets/diagram.png', 'image', origin)).toBe(
      'https://raw.githubusercontent.com/hcmute-dsc/learning-content/abc123/tracks/git/modules/basics/assets/diagram.png',
    );
  });

  it('sends other links to github.com/blob and keeps query and hash', () => {
    expect(rewriteContentUrl('next.md#step-2', 'link', origin)).toBe(
      'https://github.com/hcmute-dsc/learning-content/blob/abc123/tracks/git/modules/basics/lessons/next.md#step-2',
    );
  });

  it('keeps the dark/light-mode marker on images', () => {
    expect(rewriteContentUrl('logo.png#gh-dark-mode-only', 'image', origin)).toMatch(
      /lessons\/logo\.png#gh-dark-mode-only$/,
    );
  });

  it('keeps absolute URLs, anchors and mailto links', () => {
    for (const url of ['https://x.dev/a', '//cdn.x/a.png', '#heading', 'mailto:a@b.c', '']) {
      expect(rewriteContentUrl(url, 'link', origin)).toBe(url);
    }
  });

  it('sends images of a local folder to the API, keeping the mode marker', () => {
    const local = { ...origin, repo: 'local:D:/repos/learning-hub-content' };
    expect(
      rewriteContentUrl('../../../assets/img/sơ đồ.png#gh-dark-mode-only', 'image', local),
    ).toBe(
      '/api/v1/local-content/tracks/git/assets/img/s%C6%A1%20%C4%91%E1%BB%93.png#gh-dark-mode-only',
    );
  });

  it('keeps links of a local folder, and everything when the origin is missing', () => {
    const local = { ...origin, repo: 'local:content-example' };
    expect(rewriteContentUrl('next.md', 'link', local)).toBe('next.md');
    expect(rewriteContentUrl('a.png', 'image', null)).toBe('a.png');
  });
});

describe('githubBlobUrl / isGithubRepo', () => {
  it('builds the edit link only for owner/repo', () => {
    expect(githubBlobUrl(origin)).toBe(
      'https://github.com/hcmute-dsc/learning-content/blob/abc123/tracks/git/modules/basics/lessons/intro.md',
    );
    expect(githubBlobUrl({ ...origin, repo: 'local:content-example' })).toBeNull();
    expect(isGithubRepo('owner/repo/extra')).toBe(false);
  });
});

describe('canEditOnGitHub (learning-hub#122)', () => {
  it('shows the edit link to admins, mentors and content maintainers only', () => {
    expect(canEditOnGitHub(['member', 'admin'])).toBe(true);
    expect(canEditOnGitHub(['member', 'mentor'])).toBe(true);
    expect(canEditOnGitHub(['member', 'content_maintainer'])).toBe(true);
    expect(canEditOnGitHub(['member'])).toBe(false);
    expect(canEditOnGitHub([])).toBe(false);
  });
});

describe('editOnGitHubUrl', () => {
  const origin = { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: 'abc123', path: 'a/b.md' };

  it('links staff to the file at the published commit', () => {
    expect(editOnGitHubUrl(origin, ['member', 'mentor'])).toBe(
      'https://github.com/hcmute-dsc/learning-hub-track-sql/blob/abc123/a/b.md',
    );
  });

  it('gives nothing to members, guests and local content', () => {
    expect(editOnGitHubUrl(origin, ['member'])).toBeNull();
    expect(editOnGitHubUrl(origin, undefined)).toBeNull();
    expect(editOnGitHubUrl({ ...origin, repo: 'local:content-example' }, ['admin'])).toBeNull();
  });
});
