import { DomainError } from '../../common/errors';
import { parseSubmissionUrl, type AcceptedUrl } from './submission-url';

const SHA = 'a'.repeat(40);

function expectRejected(url: string, accepts: AcceptedUrl, login = 'alice'): void {
  expect(() => parseSubmissionUrl(url, accepts, login)).toThrow(DomainError);
}

describe('parseSubmissionUrl', () => {
  it('accepts a pull request in the member own repo (owner is case-insensitive)', () => {
    expect(
      parseSubmissionUrl('https://github.com/Alice/hello/pull/12/', 'github_pr', 'alice'),
    ).toEqual({
      sourceType: 'github_pr',
      sourceUrl: 'https://github.com/Alice/hello/pull/12',
      repoFullName: 'Alice/hello',
      prNumber: 12,
      headSha: null,
    });
  });

  it('accepts a commit and stores the sha lower-cased', () => {
    const source = parseSubmissionUrl(
      `https://github.com/alice/hello/commit/${'A'.repeat(40)}`,
      'github_commit',
      'alice',
    );
    expect(source).toMatchObject({ sourceType: 'github_commit', headSha: SHA, prNumber: null });
  });

  it('drops the query string and fragment from GitHub URLs', () => {
    const source = parseSubmissionUrl(
      'https://github.com/alice/hello/pull/3?tab=files#diff',
      'github_pr',
      'alice',
    );
    expect(source.sourceUrl).toBe('https://github.com/alice/hello/pull/3');
  });

  it('rejects a kind that does not match the exercise', () => {
    expectRejected(`https://github.com/alice/hello/commit/${SHA}`, 'github_pr');
    expectRejected('https://github.com/alice/hello/pull/1', 'github_commit');
    expectRejected('https://github.com/alice/hello', 'github_pr');
  });

  it('rejects a repo owned by someone else', () => {
    expectRejected('https://github.com/bob/hello/pull/1', 'github_pr');
  });

  it('rejects non-https, other hosts, credentials, ports and odd paths', () => {
    expectRejected('http://github.com/alice/hello/pull/1', 'github_pr');
    expectRejected('https://gist.github.com/alice/hello/pull/1', 'github_pr');
    expectRejected('https://github.com.evil.io/alice/hello/pull/1', 'github_pr');
    expectRejected('https://user:pw@github.com/alice/hello/pull/1', 'github_pr');
    expectRejected('https://github.com:8443/alice/hello/pull/1', 'github_pr');
    expectRejected('https://github.com/alice/hello/pull/0', 'github_pr');
    expectRejected('https://github.com/alice/hello/pull/99999999999', 'github_pr');
    expectRejected('https://github.com/alice/hello/pull/1/files', 'github_pr');
    expectRejected('https://github.com/alice/hello/commit/abc123', 'github_commit');
    expectRejected('not a url', 'link');
  });

  it('project github_repo_or_pr: a repo or a PR of the member', () => {
    expect(
      parseSubmissionUrl('https://github.com/alice/final-project', 'github_repo_or_pr', 'alice'),
    ).toEqual({
      sourceType: 'link',
      sourceUrl: 'https://github.com/alice/final-project',
      repoFullName: 'alice/final-project',
      prNumber: null,
      headSha: null,
    });
    const pr = parseSubmissionUrl(
      'https://github.com/alice/final-project/pull/4',
      'github_repo_or_pr',
      'alice',
    );
    expect(pr.sourceType).toBe('github_pr');
    expectRejected(`https://github.com/alice/final-project/commit/${SHA}`, 'github_repo_or_pr');
    expectRejected('https://github.com/bob/final-project', 'github_repo_or_pr');
  });

  it('project link: any https URL', () => {
    expect(parseSubmissionUrl('https://my-site.vercel.app/demo', 'link', 'alice')).toEqual({
      sourceType: 'link',
      sourceUrl: 'https://my-site.vercel.app/demo',
      repoFullName: null,
      prNumber: null,
      headSha: null,
    });
    expectRejected('http://my-site.vercel.app', 'link');
    expectRejected('javascript:alert(1)', 'link');
  });

  it('reports the problem as a 422 on the url field', () => {
    let error: unknown;
    try {
      parseSubmissionUrl('http://x.io', 'link', 'alice');
    } catch (err) {
      error = err;
    }
    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });
    expect((error as DomainError).errors?.[0].path).toBe('url');
  });
});
