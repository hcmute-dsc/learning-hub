import { describe, expect, it } from 'vitest';
import {
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

  it('keeps everything for local repos or a missing origin', () => {
    expect(rewriteContentUrl('a.png', 'image', { ...origin, repo: 'local:content-example' })).toBe(
      'a.png',
    );
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
