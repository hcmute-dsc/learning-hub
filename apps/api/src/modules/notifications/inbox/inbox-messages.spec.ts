import {
  contentReportClosedNotice,
  mentorAssignmentNotices,
  oneLine,
  readPayload,
  reviewCompletedNotice,
  reviewMessageNotice,
  reviewRequestedNotice,
  reviewThanksNotice,
  trackPublishedNotice,
} from './inbox-messages';

describe('bell notification text', () => {
  it('tells the reporter their content report was fixed or kept, and links the page', () => {
    const base = { targetTitle: 'SELECT cơ bản', targetLink: '/lessons/l-1' };
    const fixed = contentReportClosedNotice({ ...base, status: 'resolved' });
    expect(fixed.type).toBe('content_report');
    expect(fixed.payload.title).toBe('Lỗi bạn báo ở "SELECT cơ bản" đã được sửa');
    expect(fixed.payload.link).toBe('/lessons/l-1');
    const kept = contentReportClosedNotice({ ...base, status: 'dismissed' });
    expect(kept.payload.title).toContain('đã xem');
    expect(kept.payload.body).toContain('giữ nguyên');
  });

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

  it('never copies a private message into the bell (learning-hub#41)', () => {
    const base = { exerciseId: 'ex-1', submissionId: 'sub-1', exerciseTitle: 'Todo API' };
    const toMember = reviewMessageNotice({ ...base, forMember: true });
    expect(toMember.type).toBe('review_message');
    expect(toMember.payload.title).toBe('Mentor trả lời về bài "Todo API"');
    expect(toMember.payload.link).toBe('/exercises/ex-1#review-sub-1');
    const toMentor = reviewMessageNotice({ ...base, forMember: false });
    expect(toMentor.payload.title).toBe('Thành viên hỏi lại về bài "Todo API"');
    expect(toMentor.payload.link).toBe('/review/sub-1');
    const thanks = reviewThanksNotice(base);
    expect(thanks.type).toBe('review_thanks');
    expect(thanks.payload.link).toBe('/review/sub-1');
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
    expect(readPayload({ title: 't', link: '//evil.example/x' }).link).toBe('/dashboard');
    expect(readPayload(null)).toEqual({ title: 'Thông báo', body: null, link: '/dashboard' });
  });
});

describe('mentorAssignmentNotices (#131)', () => {
  const an = { id: 'an', login: 'an-dev', name: 'Nguyễn An' };
  const binh = { id: 'binh', login: 'binh', name: 'Trần Bình' };
  const chau = { id: 'chau', login: 'chau', name: 'Lê Châu' };
  const base = { actorId: 'admin', trackSlug: 'sql-30-days', trackTitle: '30 ngày học SQL' };
  const to = (list: { userId: string }[]) => list.map((n) => n.userId);

  it('tells the mentee and the new mentor about a first mentor', () => {
    const list = mentorAssignmentNotices({
      ...base,
      mentee: an,
      mentor: binh,
      previousMentor: null,
    });
    expect(to(list)).toEqual(['an', 'binh']);
    expect(list[0].notice).toEqual({
      type: 'mentor_assignment',
      payload: {
        title: 'Bạn có mentor ở "30 ngày học SQL": Trần Bình',
        body: expect.stringContaining('theo dõi tiến độ'),
        link: '/u/binh',
      },
    });
    expect(list[1].notice.payload).toMatchObject({
      title: 'Bạn kèm thêm Nguyễn An ở "30 ngày học SQL"',
      link: '/review?track=sql-30-days&mentee=an-dev',
    });
  });

  it('also tells the previous mentor when the mentor changes', () => {
    const list = mentorAssignmentNotices({
      ...base,
      mentee: an,
      mentor: chau,
      previousMentor: binh,
    });
    expect(to(list)).toEqual(['an', 'chau', 'binh']);
    expect(list[0].notice.payload.title).toBe(
      'Mentor của bạn ở "30 ngày học SQL" đổi thành Lê Châu',
    );
    expect(list[2].notice.payload).toMatchObject({
      title: 'Nguyễn An không còn là mentee của bạn ở "30 ngày học SQL"',
      link: '/tracks/sql-30-days',
    });
  });

  it('tells the mentee and the previous mentor when the mentor is removed', () => {
    const list = mentorAssignmentNotices({
      ...base,
      mentee: an,
      mentor: null,
      previousMentor: binh,
    });
    expect(to(list)).toEqual(['an', 'binh']);
    expect(list[0].notice.payload.title).toBe('Bạn tạm chưa có mentor ở "30 ngày học SQL"');
  });

  it('never notifies the admin who made the change', () => {
    const list = mentorAssignmentNotices({
      ...base,
      actorId: 'binh',
      mentee: an,
      mentor: binh,
      previousMentor: null,
    });
    expect(to(list)).toEqual(['an']);
  });
});
