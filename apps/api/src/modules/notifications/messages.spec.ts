import {
  awaitingReviewMessage,
  contentPublishedMessage,
  errorSummary,
  escapeDiscord,
  MAX_PUBLISHED_TITLES,
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
  const base = {
    commitSha: 'abcdef1234567890',
    sourceRepo: 'hcmute-dsc/learning-hub-content',
    previousCommitSha: '1234567aaaaaaaa',
    removed: 0,
  };
  const sql = { slug: 'sql-30-days', title: 'SQL 30 ngày', isNew: false };

  it('names the track, the changed lessons and links the GitHub diff', () => {
    const msg = contentPublishedMessage(ORIGIN, {
      ...base,
      tracks: [{ ...sql, added: ['Ngày 31: Ôn tập'], changed: ['Ngày 1: Giới thiệu SQL'] }],
    });
    expect(msg).toContain('`abcdef1`');
    expect(msg).toContain('**SQL 30 ngày**');
    expect(msg).toContain('➕ Thêm 1 bài:\n• Ngày 31: Ôn tập');
    expect(msg).toContain('✏️ Cập nhật 1 bài:\n• Ngày 1: Giới thiệu SQL');
    expect(msg).toContain(`<${ORIGIN}/tracks/sql-30-days>`);
    expect(msg).toContain(
      '<https://github.com/hcmute-dsc/learning-hub-content/compare/1234567aaaaaaaa...abcdef1234567890>',
    );
  });

  it(`lists at most ${MAX_PUBLISHED_TITLES} titles and counts the rest`, () => {
    const changed = Array.from({ length: 30 }, (_, i) => `Ngày ${i + 1}`);
    const msg = contentPublishedMessage(ORIGIN, {
      ...base,
      tracks: [{ ...sql, added: [], changed }],
    });
    expect(msg.match(/^• /gm)).toHaveLength(MAX_PUBLISHED_TITLES);
    expect(msg).toContain(`… và ${30 - MAX_PUBLISHED_TITLES} bài khác`);
    expect(msg.length).toBeLessThan(2000);
  });

  it('announces a new track and removed lessons', () => {
    const msg = contentPublishedMessage(ORIGIN, {
      ...base,
      removed: 2,
      tracks: [{ slug: 'git', title: 'Git cơ bản', isNew: true, added: ['a', 'b'], changed: [] }],
    });
    expect(msg).toContain('🆕 **Lộ trình mới: Git cơ bản**');
    expect(msg).toContain('🗑️ Gỡ 2 bài');
  });

  it('escapes titles and hides values that are not a sha or a GitHub repo', () => {
    const msg = contentPublishedMessage(ORIGIN, {
      commitSha: '`@everyone`',
      sourceRepo: 'local:D:/content',
      previousCommitSha: null,
      removed: 0,
      tracks: [{ ...sql, added: [], changed: ['@everyone **x**'] }],
    });
    expect(msg).toContain('`?`');
    expect(msg).not.toMatch(/@everyone|github\.com/);
    expect(msg).toContain(String.raw`\*\*x\*\*`);
  });

  it('says so when nothing a member can see changed', () => {
    expect(contentPublishedMessage(ORIGIN, { ...base, tracks: [] })).toContain(
      'Không có bài học hay bài tập nào thay đổi',
    );
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

describe('errorSummary', () => {
  it('keeps the cause of a multi-line Prisma error, not the code excerpt or paths', () => {
    const prisma =
      "\nInvalid `this.prisma.session.findUnique()` invocation in\nD:\app\dist\session.service.js:66:51\n\n  63 if (!token)\n→ 66 const session = await this.prisma.session.findUnique(\nCan't reach database server at `db:5432`";
    expect(errorSummary(prisma)).toBe("Can't reach database server at `db:5432`");
  });

  it('leaves one-line messages alone', () => {
    expect(errorSummary('boom')).toBe('boom');
    expect(errorSummary('')).toBe('');
  });
});
