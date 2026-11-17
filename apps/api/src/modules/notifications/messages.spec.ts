import {
  awaitingReviewMessage,
  contentPublishedMessage,
  escapeDiscord,
  pathWithoutQuery,
  reviewCompletedMessage,
  serverErrorMessage,
} from './messages';

const ORIGIN = 'https://learn.hcmute-dsc.io.vn';

describe('escapeDiscord', () => {
  it('defuses @everyone and @here', () => {
    const out = escapeDiscord('hi @everyone and @here');
    expect(out).not.toMatch(/@everyone|@here/);
    expect(out).toContain('@​everyone');
  });

  it('escapes markdown and fake links', () => {
    expect(escapeDiscord('**bold** [x](http://evil) `code`')).toBe(
      '\\*\\*bold\\*\\* \\[x\\]\\(http://evil\\) \\`code\\`',
    );
  });

  it('keeps one line and cuts long values', () => {
    expect(escapeDiscord('a\n\nb')).toBe('a b');
    expect(escapeDiscord('x'.repeat(500), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('awaitingReviewMessage', () => {
  it('names the exercise, track, member and links the review page', () => {
    const msg = awaitingReviewMessage(`${ORIGIN}/`, {
      submissionId: 'sub-1',
      exerciseTitle: 'Todo API',
      trackTitle: 'Backend',
      memberLogin: 'octo-cat',
    });
    expect(msg).toContain('📝 **Bài chờ review**: Todo API (Backend)');
    expect(msg).toContain('octo\\-cat');
    expect(msg).toContain(`<${ORIGIN}/review/sub-1>`);
  });

  it('cannot ping through a title', () => {
    const msg = awaitingReviewMessage(ORIGIN, {
      submissionId: 's',
      exerciseTitle: '@everyone',
      trackTitle: '<@&123>',
      memberLogin: 'm',
    });
    expect(msg).not.toMatch(/@everyone|<@&/);
  });
});

describe('reviewCompletedMessage', () => {
  it('shows the outcome in Vietnamese', () => {
    const base = { exerciseTitle: 'Quiz', trackTitle: 'Web', memberLogin: 'a' };
    expect(reviewCompletedMessage({ ...base, outcome: 'approved' })).toContain('Đạt');
    expect(reviewCompletedMessage({ ...base, outcome: 'changes_requested' })).toContain('Cần sửa');
  });
});

describe('contentPublishedMessage', () => {
  it('shows the short commit and links /tracks', () => {
    const msg = contentPublishedMessage(ORIGIN, 'abcdef1234567890');
    expect(msg).toContain('`abcdef1`');
    expect(msg).toContain(`<${ORIGIN}/tracks>`);
  });

  it('hides a commit that is not a sha', () => {
    expect(contentPublishedMessage(ORIGIN, '`@everyone`')).toContain('`?`');
  });
});

describe('serverErrorMessage', () => {
  it('cannot break out of the code block', () => {
    const msg = serverErrorMessage({
      method: 'GET',
      path: '/api/v1/x',
      requestId: 'r-1',
      errorName: 'Error',
      errorMessage: '```\n@everyone',
      suppressed: 0,
    });
    expect(msg.match(/```/g)).toHaveLength(2);
    expect(msg).toContain('`GET /api/v1/x`');
    expect(msg).not.toContain('gộp');
  });

  it('mentions alerts merged by the throttle', () => {
    const msg = serverErrorMessage({
      method: 'POST',
      path: '/a',
      errorName: 'E',
      errorMessage: 'm',
      suppressed: 3,
    });
    expect(msg).toContain('3 cảnh báo khác');
  });
});

describe('pathWithoutQuery', () => {
  it('drops the query string and fragment', () => {
    expect(pathWithoutQuery('/api/v1/members?q=email@x.com')).toBe('/api/v1/members');
    expect(pathWithoutQuery('/a#b')).toBe('/a');
    expect(pathWithoutQuery('/a')).toBe('/a');
  });
});
