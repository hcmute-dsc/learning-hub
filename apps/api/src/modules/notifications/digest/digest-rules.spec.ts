import {
  buildDigestEmail,
  DIGEST_MAX_ITEMS,
  digestWindowStart,
  escapeHtml,
  isDigestDue,
} from './digest-rules';

// 08:00 in Vietnam (UTC+7) is 01:00 UTC.
describe('digest schedule', () => {
  it('starts the window at the latest 08:00 Vietnam time', () => {
    expect(digestWindowStart(new Date('2026-11-18T05:00:00Z'))).toEqual(
      new Date('2026-11-18T01:00:00Z'),
    );
    // 07:30 in Vietnam: still yesterday's window
    expect(digestWindowStart(new Date('2026-11-18T00:30:00Z'))).toEqual(
      new Date('2026-11-17T01:00:00Z'),
    );
    // 23:00 UTC is 06:00 next day in Vietnam: window from 08:00 of the Vietnamese "today - 1"
    expect(digestWindowStart(new Date('2026-11-18T23:00:00Z'))).toEqual(
      new Date('2026-11-18T01:00:00Z'),
    );
  });

  it('is due once per day after 08:00', () => {
    const morning = new Date('2026-11-18T01:30:00Z');
    expect(isDigestDue(morning, null)).toBe(true);
    expect(isDigestDue(morning, new Date('2026-11-17T01:30:00Z'))).toBe(true);
    expect(isDigestDue(morning, new Date('2026-11-18T01:05:00Z'))).toBe(false);
    // enabled yesterday evening: first digest this morning
    expect(isDigestDue(morning, new Date('2026-11-17T13:00:00Z'))).toBe(true);
  });
});

describe('buildDigestEmail', () => {
  const base = {
    displayName: 'An',
    webOrigin: 'https://learn.example.org/',
    unsubscribeUrl: 'https://learn.example.org/unsubscribe?token=abc',
  };

  it('sends nothing when there is nothing unread', () => {
    expect(buildDigestEmail({ ...base, items: [] })).toBeNull();
  });

  it('lists each notification with an absolute link and an unsubscribe link', () => {
    const email = buildDigestEmail({
      ...base,
      items: [{ title: 'Bài "Todo" đã đạt', body: 'Backend', link: '/exercises/1' }],
    });
    expect(email?.subject).toBe('Learning Hub: 1 thông báo mới');
    expect(email?.text).toContain('trên HCMUTE DSC Learning Hub:');
    expect(email?.text).toContain('https://learn.example.org/exercises/1');
    expect(email?.text).toContain('Tắt email này: https://learn.example.org/unsubscribe?token=abc');
    expect(email?.html).toContain('href="https://learn.example.org/exercises/1"');
    expect(email?.html).toContain('unsubscribe?token=abc');
  });

  it('escapes titles from content repos in the HTML part', () => {
    const email = buildDigestEmail({
      ...base,
      displayName: '<b>x</b>',
      items: [{ title: '<script>alert(1)</script>', body: null, link: '/x' }],
    });
    expect(email?.html).not.toContain('<script>');
    expect(email?.html).toContain('&lt;script&gt;');
    expect(email?.html).not.toContain('<b>x</b>');
  });

  it(`lists at most ${DIGEST_MAX_ITEMS} and counts the rest`, () => {
    const items = Array.from({ length: DIGEST_MAX_ITEMS + 5 }, (_, i) => ({
      title: `n${i}`,
      body: null,
      link: `/x/${i}`,
    }));
    const email = buildDigestEmail({ ...base, items });
    expect(email?.text).toContain('… và 5 thông báo khác');
    expect(email?.text.match(/^- /gm)).toHaveLength(DIGEST_MAX_ITEMS);
  });

  it('escapes every HTML special character', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
