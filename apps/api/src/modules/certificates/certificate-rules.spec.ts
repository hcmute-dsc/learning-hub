import { CERTIFICATE_CODE } from '@hub/shared';
import {
  CODE_BYTES,
  certificateCode,
  isCertificateCode,
  missingTrackIds,
  revokeRefusal,
  shownOnProfile,
  toAdminRow,
  toCertificateView,
  type CertificateRow,
} from './certificate-rules';

function certificateRow(over: Partial<CertificateRow> = {}): CertificateRow {
  return {
    id: '0190a000-0000-7000-8000-000000000001',
    code: 'abcdefghijklmnopqrstuvwx',
    userId: '0190a000-0000-7000-8000-0000000000aa',
    trackId: '0190a000-0000-7000-8000-0000000000bb',
    recipientName: 'Nguyễn Văn A',
    trackSlug: 'sql-30-days',
    trackTitle: 'SQL 30 ngày',
    contentRepo: 'hcmute-dsc/learning-hub-track-sql',
    commitSha: 'a'.repeat(40),
    completedAt: new Date('2026-11-10T08:00:00Z'),
    issuedAt: new Date('2026-11-10T08:00:01Z'),
    hidden: false,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    ...over,
  };
}

describe('certificateCode', () => {
  it('turns 15 bytes into 24 lower-case base32 characters', () => {
    expect(certificateCode(new Uint8Array(CODE_BYTES))).toBe('a'.repeat(24));
    expect(certificateCode(new Uint8Array(CODE_BYTES).fill(255))).toBe('7'.repeat(24));
  });

  it('encodes the bits in order (RFC 4648 alphabet)', () => {
    const bytes = new Uint8Array(CODE_BYTES);
    bytes[0] = 0b00001_000; // first 5 bits = 1 → "b"
    expect(certificateCode(bytes).startsWith('ba')).toBe(true);
  });

  it('always matches the shared pattern for random input', () => {
    for (let i = 0; i < 50; i++) {
      const bytes = Uint8Array.from({ length: CODE_BYTES }, () => Math.floor(Math.random() * 256));
      expect(certificateCode(bytes)).toMatch(CERTIFICATE_CODE);
    }
  });

  it('refuses a wrong number of bytes', () => {
    expect(() => certificateCode(new Uint8Array(8))).toThrow();
  });
});

describe('isCertificateCode', () => {
  it.each([
    ['abcdefghijklmnopqrstuvwx', true],
    ['ABCDEFGHIJKLMNOPQRSTUVWX', false],
    ['abcdefghijklmnopqrstuvw1', false],
    ['abc', false],
    ['../../admin/certificates', false],
  ])('%s → %s', (code, ok) => {
    expect(isCertificateCode(code)).toBe(ok);
  });
});

describe('toCertificateView (public page)', () => {
  it('shows name, track, dates and commit, and nothing that identifies the account', () => {
    const view = toCertificateView(certificateRow());
    expect(view).toEqual({
      code: 'abcdefghijklmnopqrstuvwx',
      recipientName: 'Nguyễn Văn A',
      track: { slug: 'sql-30-days', title: 'SQL 30 ngày' },
      completedAt: '2026-11-10T08:00:00.000Z',
      issuedAt: '2026-11-10T08:00:01.000Z',
      content: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: 'a'.repeat(40) },
      status: 'valid',
      revokedAt: null,
    });
    const text = JSON.stringify(view);
    expect(text).not.toContain('0190a000'); // no user, track or certificate id
    expect(text).not.toContain('@');
  });

  it('says revoked, with the date but without the admin reason', () => {
    const view = toCertificateView(
      certificateRow({
        revokedAt: new Date('2026-11-12T00:00:00Z'),
        revokedBy: '0190a000-0000-7000-8000-0000000000cc',
        revokeReason: 'copied solutions',
      }),
    );
    expect(view.status).toBe('revoked');
    expect(view.revokedAt).toBe('2026-11-12T00:00:00.000Z');
    expect(JSON.stringify(view)).not.toContain('copied');
  });

  it('keeps the hidden flag out of the public view', () => {
    expect(toCertificateView(certificateRow({ hidden: true }))).not.toHaveProperty('hidden');
  });
});

describe('toAdminRow', () => {
  it('adds the login, the hidden flag and the revoke reason', () => {
    const row = toAdminRow(certificateRow({ hidden: true, revokeReason: null }), 'vana');
    expect(row).toMatchObject({ githubLogin: 'vana', hidden: true, revokeReason: null });
  });
});

describe('shownOnProfile', () => {
  it('hides certificates the member hid or an admin revoked', () => {
    expect(shownOnProfile(certificateRow())).toBe(true);
    expect(shownOnProfile(certificateRow({ hidden: true }))).toBe(false);
    expect(shownOnProfile(certificateRow({ revokedAt: new Date() }))).toBe(false);
  });
});

describe('revokeRefusal', () => {
  it('allows the first revoke and refuses a second one', () => {
    expect(revokeRefusal(certificateRow())).toBeNull();
    expect(revokeRefusal(certificateRow({ revokedAt: new Date() }))).toMatch(/already/);
  });
});

describe('missingTrackIds', () => {
  it('lists completed tracks without a certificate, once each', () => {
    expect(missingTrackIds(['t1', 't2', 't2', 't3'], ['t1'])).toEqual(['t2', 't3']);
  });

  it('counts a revoked certificate as issued, so it is never issued again', () => {
    // listByUser returns revoked rows too; their track ids are passed as issued
    expect(missingTrackIds(['t1'], ['t1'])).toEqual([]);
  });
});
