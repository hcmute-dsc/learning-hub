import {
  oneLine,
  readPayload,
  reviewCompletedNotice,
  reviewRequestedNotice,
  trackPublishedNotice,
} from './inbox-messages';

describe('bell notification text', () => {
  it('tells the member the review outcome and links the exercise', () => {
    const base = { exerciseId: 'ex-1', exerciseTitle: 'Todo API', trackTitle: 'Backend' };
    const approved = reviewCompletedNotice({ ...base, outcome: 'approved' });
    expect(approved.type).toBe('review_completed');
    expect(approved.payload.title).toBe('Bài "Todo API" đã đạt');
    expect(approved.payload.link).toBe('/exercises/ex-1');
    const changes = reviewCompletedNotice({ ...base, outcome: 'changes_requested' });
    expect(changes.payload.title).toContain('cần sửa');
    expect(changes.payload.body).toContain('Backend');
  });

  it('links mentors to the review page without naming the member', () => {
    const n = reviewRequestedNotice({
      submissionId: 'sub-1',
      exerciseTitle: 'Todo API',
      trackTitle: 'Backend',
    });
    expect(n.type).toBe('review_requested');
    expect(n.payload).toEqual({
      title: 'Bài chờ review: Todo API',
      body: 'Backend',
      link: '/review/sub-1',
    });
  });

  it('links a new track by slug', () => {
    const n = trackPublishedNotice({ slug: 'git-co-ban', title: 'Git cơ bản' });
    expect(n.payload.title).toBe('Lộ trình mới: Git cơ bản');
    expect(n.payload.link).toBe('/tracks/git-co-ban');
  });

  it('keeps titles on one line and short', () => {
    expect(oneLine('a\n\n  b')).toBe('a b');
    expect(oneLine('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('readPayload', () => {
  it('reads a stored payload', () => {
    expect(readPayload({ title: 't', body: 'b', link: '/x' })).toEqual({
      title: 't',
      body: 'b',
      link: '/x',
    });
  });

  it('never returns a link that leaves the site', () => {
    expect(readPayload({ title: 't', link: 'https://evil.example' }).link).toBe('/dashboard');
    expect(readPayload(null)).toEqual({ title: 'Thông báo', body: null, link: '/dashboard' });
  });
});
