import { DomainError } from '../../common/errors';
import { failureMessage, GithubIssueTracker } from './github-issue.tracker';

const issue = { title: '[Báo lỗi] Bài 1: Khác', body: 'nội dung' };

describe('GithubIssueTracker', () => {
  it('posts the issue with the token and returns its link', async () => {
    const http = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/o/r/issues/3' }), {
        status: 201,
      }),
    );
    const tracker = new GithubIssueTracker('secret-token', http);
    await expect(tracker.createIssue('o/r', issue)).resolves.toEqual({
      url: 'https://github.com/o/r/issues/3',
    });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/o/r/issues');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body)).toEqual(issue);
  });

  it('says what permission is missing when GitHub refuses', async () => {
    const http = jest.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    const err = await new GithubIssueTracker('t', http).createIssue('o/r', issue).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.status).toBe(502);
    expect(err.message).toContain('Issues: write');
  });

  it('does not retry a request that got no answer (it may have created the issue)', async () => {
    const http = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const err = await new GithubIssueTracker('t', http).createIssue('o/r', issue).catch((e) => e);
    expect(err.status).toBe(502);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('explains each refusal', () => {
    expect(failureMessage(401, 'o/r')).toContain('CONTENT_ISSUES_GITHUB_TOKEN');
    expect(failureMessage(404, 'o/r')).toContain('o/r');
    expect(failureMessage(410, 'o/r')).toContain('tắt Issues');
    expect(failureMessage(500, 'o/r')).toContain('500');
  });
});
