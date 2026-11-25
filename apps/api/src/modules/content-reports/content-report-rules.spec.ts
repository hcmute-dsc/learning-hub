import { DomainError } from '../../common/errors';
import {
  assertStatusChange,
  assertUnderDailyLimit,
  canHandleContentReports,
  canMoveTo,
  closedAtAfter,
  dailyLimitSince,
  issueContent,
  notifiesReporter,
  quoted,
  storedCommit,
  targetLink,
} from './content-report-rules';

const NOW = new Date('2026-11-25T05:00:00Z');
const SHA = 'a'.repeat(40);

function errorOf(fn: () => void): DomainError {
  try {
    fn();
  } catch (e) {
    return e as DomainError;
  }
  throw new Error('expected an error');
}

describe('canHandleContentReports', () => {
  it('is for admins and every mentor, like the review queue', () => {
    expect(canHandleContentReports(['member', 'admin'])).toBe(true);
    expect(canHandleContentReports(['member', 'mentor'])).toBe(true);
    expect(canHandleContentReports(['member'])).toBe(false);
    expect(canHandleContentReports(['member', 'content_maintainer'])).toBe(false);
  });
});

describe('daily limit', () => {
  it('counts the last 24 hours', () => {
    expect(dailyLimitSince(NOW)).toEqual(new Date('2026-11-24T05:00:00Z'));
  });

  it('lets the 10th report through and stops the 11th with 429', () => {
    expect(() => assertUnderDailyLimit(9)).not.toThrow();
    const err = errorOf(() => assertUnderDailyLimit(10));
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(() => assertUnderDailyLimit(2, 3)).not.toThrow();
    expect(() => assertUnderDailyLimit(3, 3)).toThrow(DomainError);
  });
});

describe('status changes', () => {
  it('allows open ⇄ in progress, closing from either, and reopening', () => {
    expect(canMoveTo('open', 'in_progress')).toBe(true);
    expect(canMoveTo('in_progress', 'open')).toBe(true);
    expect(canMoveTo('open', 'resolved')).toBe(true);
    expect(canMoveTo('in_progress', 'dismissed')).toBe(true);
    expect(canMoveTo('resolved', 'open')).toBe(true);
    expect(canMoveTo('dismissed', 'open')).toBe(true);
  });

  it('refuses the same status and jumps between closed states with 409', () => {
    expect(canMoveTo('open', 'open')).toBe(false);
    expect(canMoveTo('resolved', 'dismissed')).toBe(false);
    expect(canMoveTo('dismissed', 'in_progress')).toBe(false);
    expect(errorOf(() => assertStatusChange('resolved', 'resolved')).status).toBe(409);
  });

  it('tells the reporter only when the report closes', () => {
    expect(notifiesReporter('open', 'resolved')).toBe(true);
    expect(notifiesReporter('in_progress', 'dismissed')).toBe(true);
    expect(notifiesReporter('open', 'in_progress')).toBe(false);
    expect(notifiesReporter('resolved', 'open')).toBe(false);
  });

  it('sets closed_at when closing and clears it when reopening', () => {
    const earlier = new Date('2026-11-20T00:00:00Z');
    expect(closedAtAfter('resolved', null, NOW)).toEqual(NOW);
    expect(closedAtAfter('dismissed', earlier, NOW)).toEqual(earlier);
    expect(closedAtAfter('open', earlier, NOW)).toBeNull();
    expect(closedAtAfter('in_progress', null, NOW)).toBeNull();
  });
});

describe('storedCommit and targetLink', () => {
  it('keeps real commit SHAs only', () => {
    expect(storedCommit(SHA)).toBe(SHA);
    expect(storedCommit('local')).toBeNull();
    expect(storedCommit(null)).toBeNull();
  });

  it('links to the reported page in the web app', () => {
    expect(targetLink('lesson', 'l-1', 'sql')).toBe('/lessons/l-1');
    expect(targetLink('exercise', 'x-1', 'sql')).toBe('/exercises/x-1');
    expect(targetLink('track_page', 'setup', 'sql')).toBe('/tracks/sql/setup');
    expect(targetLink('glossary', 'glossary', 'sql')).toBe('/tracks/sql/glossary');
  });
});

describe('issueContent', () => {
  const source = {
    category: 'broken_code' as const,
    description: 'Lệnh `SELECT *` báo lỗi @someone <script>',
    quote: 'SELECT * FORM users',
    targetTitle: 'SELECT cơ bản',
    trackTitle: 'SQL 30 ngày',
    pageUrl: 'https://learn.example/lessons/l-1',
    commitSha: SHA,
    repo: 'hcmute-dsc/learning-hub-track-sql',
  };

  it('has the lesson, category, link, commit, description and quote', () => {
    const { title, body } = issueContent(source);
    expect(title).toBe('[Báo lỗi] SELECT cơ bản: Lệnh hoặc code không chạy');
    expect(body).toContain('[SELECT cơ bản](https://learn.example/lessons/l-1) (SQL 30 ngày)');
    expect(body).toContain(
      `[\`aaaaaaa\`](https://github.com/hcmute-dsc/learning-hub-track-sql/tree/${SHA})`,
    );
    expect(body).toContain('~~~text\nSELECT * FORM users\n~~~');
    expect(body).toContain('HCMUTE DSC');
  });

  it('fences the member text, so mentions and HTML stay plain text', () => {
    const { body } = issueContent(source);
    expect(body).toContain('~~~text\nLệnh `SELECT *` báo lỗi @someone <script>\n~~~');
  });

  it('never names the reporter, and leaves out what is missing', () => {
    const { body } = issueContent({ ...source, quote: null, commitSha: null });
    expect(body).not.toContain('Đoạn trích');
    expect(body).not.toContain('Commit');
    expect(body).not.toMatch(/người báo|reporter/i);
  });

  it('uses a fence longer than any ~ run in the text', () => {
    expect(quoted('a ~~~~ b')).toBe('~~~~~text\na ~~~~ b\n~~~~~');
    expect(quoted('plain')).toBe('~~~text\nplain\n~~~');
  });
});
