import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainError } from '../../common/errors';
import type { Clock } from '../../infrastructure/clock';
import type { CatalogReader } from '../catalog/catalog.reader';
import type { CompletedTracksReader } from '../learning/completed-tracks.reader';
import type { PeopleReader } from '../users/people.reader';
import type { UsersService } from '../users/users.service';
import type { CertificateRow } from './certificate-rules';
import { CertificateEvents } from './certificates.events';
import { CertificatesListener } from './certificates.listener';
import type {
  CertificatesRepository,
  InsertResult,
  NewCertificate,
} from './certificates.repository';
import { CertificatesService } from './certificates.service';

const USER = '0190a000-0000-7000-8000-0000000000aa';
const OTHER = '0190a000-0000-7000-8000-0000000000ab';
const ADMIN = '0190a000-0000-7000-8000-0000000000ad';
const TRACK = '0190a000-0000-7000-8000-0000000000bb';
const NOW = new Date('2026-11-18T10:00:00Z');
const COMPLETED = new Date('2026-11-10T08:00:00Z');

/** In-memory stand-in for the certificates table, with its two unique keys. */
class FakeRepository {
  rows: CertificateRow[] = [];
  /** codes that collide once, to test drawing a new code */
  takenCodes = new Set<string>();

  findByCode = async (code: string) => this.rows.find((r) => r.code === code) ?? null;
  findFor = async (userId: string, trackId: string) =>
    this.rows.find((r) => r.userId === userId && r.trackId === trackId) ?? null;
  listByUser = async (userId: string) => this.rows.filter((r) => r.userId === userId);
  listRecent = async (limit: number) => this.rows.slice(0, limit);

  insert = async (data: NewCertificate): Promise<InsertResult> => {
    if (this.takenCodes.delete(data.code)) return { kind: 'code_taken' };
    if (this.rows.some((r) => r.userId === data.userId && r.trackId === data.trackId)) {
      return { kind: 'owner_taken' };
    }
    const row: CertificateRow = {
      ...data,
      issuedAt: NOW,
      hidden: false,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    };
    this.rows.push(row);
    return { kind: 'issued', row };
  };

  setHidden = async (userId: string, code: string, hidden: boolean) => {
    const row = this.rows.find((r) => r.code === code && r.userId === userId);
    if (!row) return null;
    row.hidden = hidden;
    return row;
  };

  revoke = async (id: string, actorId: string, reason: string, at: Date) => {
    const row = this.rows.find((r) => r.id === id && !r.revokedAt);
    if (!row) return false;
    Object.assign(row, { revokedAt: at, revokedBy: actorId, revokeReason: reason });
    return true;
  };
}

/** Lets a test choose the codes the service draws; random ones once the list is empty. */
class TestService extends CertificatesService {
  codes: string[] = [];
  protected override newCode(): string {
    return this.codes.shift() ?? super.newCode();
  }
}

const PEOPLE = new Map([
  [USER, { id: USER, githubLogin: 'vana', displayName: 'Nguyễn Văn A', avatarUrl: null }],
  [OTHER, { id: OTHER, githubLogin: 'thib', displayName: 'Trần Thị B', avatarUrl: null }],
]);

function setup() {
  const repo = new FakeRepository();
  const events = new EventEmitter2({ wildcard: true });
  const emitted: { name: string; payload: unknown }[] = [];
  events.onAny((name, payload) => {
    emitted.push({ name: String(name), payload });
  });

  const catalog = {
    trackSource: jest.fn(async (id: string) => ({
      id,
      slug: 'sql-30-days',
      title: 'SQL 30 ngày',
      source: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: 'ABCDEF'.padEnd(40, '0') },
    })),
  } as unknown as CatalogReader;
  const completedTracks = {
    forUser: jest.fn(async (): Promise<{ trackId: string; completedAt: Date }[]> => []),
  };
  const people = {
    byIds: jest.fn(
      async (ids: string[]) =>
        new Map(ids.filter((id) => PEOPLE.has(id)).map((id) => [id, PEOPLE.get(id)])),
    ),
  } as unknown as PeopleReader;
  const users = {
    findActiveByLogin: jest.fn(async (login: string) =>
      login === 'vana' ? { id: USER } : login === 'thib' ? { id: OTHER } : null,
    ),
  } as unknown as UsersService;
  const clock: Clock = { now: () => NOW };

  const service = new TestService(
    repo as unknown as CertificatesRepository,
    catalog,
    completedTracks as unknown as CompletedTracksReader,
    people,
    users,
    clock,
    events,
  );
  return { service, repo, emitted, completedTracks };
}

describe('CertificatesService.issue', () => {
  it('issues one certificate with the name, track and content commit of that day', async () => {
    const { service, emitted } = setup();
    service.codes = ['abcdefghijklmnopqrstuvwx'];

    const row = await service.issue(USER, TRACK, COMPLETED);

    expect(row).toMatchObject({
      code: 'abcdefghijklmnopqrstuvwx',
      userId: USER,
      trackId: TRACK,
      recipientName: 'Nguyễn Văn A',
      trackSlug: 'sql-30-days',
      trackTitle: 'SQL 30 ngày',
      contentRepo: 'hcmute-dsc/learning-hub-track-sql',
      commitSha: 'abcdef'.padEnd(40, '0'), // stored lower-case
      completedAt: COMPLETED,
    });
    expect(emitted).toEqual([
      {
        name: CertificateEvents.Issued,
        payload: { certificateId: row.id, code: row.code, userId: USER, trackId: TRACK },
      },
    ]);
  });

  it('issues only once: a second call returns the same certificate and emits nothing', async () => {
    const { service, repo, emitted } = setup();
    const first = await service.issue(USER, TRACK, COMPLETED);
    emitted.length = 0;

    const second = await service.issue(USER, TRACK, new Date());

    expect(second.id).toBe(first.id);
    expect(repo.rows).toHaveLength(1);
    expect(emitted).toEqual([]);
  });

  it('returns the winner when a parallel request inserted first', async () => {
    const { service, repo } = setup();
    const findFor = repo.findFor;
    let calls = 0;
    // the first lookup misses, as it would while the other request is still inserting
    repo.findFor = async (u, t) => (calls++ === 0 ? null : findFor(u, t));
    await repo.insert({
      id: 'winner',
      code: 'zzzzzzzzzzzzzzzzzzzzzzzz',
      userId: USER,
      trackId: TRACK,
      recipientName: 'x',
      trackSlug: 's',
      trackTitle: 't',
      contentRepo: 'r',
      commitSha: 'a'.repeat(40),
      completedAt: COMPLETED,
    });

    const row = await service.issue(USER, TRACK, COMPLETED);

    expect(row.id).toBe('winner');
    expect(repo.rows).toHaveLength(1);
  });

  it('draws a new code when the first one is taken', async () => {
    const { service, repo } = setup();
    repo.takenCodes.add('aaaaaaaaaaaaaaaaaaaaaaaa');
    service.codes = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];

    const row = await service.issue(USER, TRACK, COMPLETED);

    expect(row.code).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
  });

  it('draws random codes in the shared format by default', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    expect(row.code).toMatch(/^[a-z2-7]{24}$/);
  });
});

describe('CertificatesListener', () => {
  it('issues on learning.track_completed with the stored completion date', async () => {
    const { service, repo } = setup();
    const listener = new CertificatesListener(service);

    await listener.onTrackCompleted({
      enrollmentId: 'e1',
      userId: USER,
      trackId: TRACK,
      completedAt: COMPLETED.toISOString(),
    });

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].completedAt).toEqual(COMPLETED);
  });

  it('only logs a failure, so completing the track never fails', async () => {
    const { service, repo } = setup();
    const listener = new CertificatesListener(service);
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(
      listener.onTrackCompleted({
        enrollmentId: 'e2',
        userId: '0190a000-0000-7000-8000-000000000999', // unknown user
        trackId: TRACK,
        completedAt: COMPLETED.toISOString(),
      }),
    ).resolves.toBeUndefined();
    expect(repo.rows).toHaveLength(0);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});

describe('CertificatesService.issueMissing', () => {
  it('issues certificates for completions stored before certificates existed', async () => {
    const { service, repo, completedTracks } = setup();
    await service.issue(USER, 'track-old', COMPLETED);
    completedTracks.forUser.mockResolvedValue([
      { trackId: 'track-old', completedAt: COMPLETED },
      { trackId: TRACK, completedAt: COMPLETED },
    ]);

    const mine = await service.listMine(USER);

    expect(repo.rows.map((r) => r.trackId).sort()).toEqual([TRACK, 'track-old'].sort());
    expect(mine).toHaveLength(2);
  });

  it('never issues again for a revoked certificate', async () => {
    const { service, repo, completedTracks } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    await service.revoke(ADMIN, row.code, 'copied solutions');
    completedTracks.forUser.mockResolvedValue([{ trackId: TRACK, completedAt: COMPLETED }]);

    await service.listMine(USER);

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].revokedAt).toEqual(NOW);
  });
});

describe('CertificatesService.verify (public page)', () => {
  it('returns the public view for a valid code', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    const view = await service.verify(row.code);
    expect(view).toMatchObject({ recipientName: 'Nguyễn Văn A', status: 'valid' });
    expect(view).not.toHaveProperty('userId');
  });

  it('is a 404 for an unknown code and for a malformed one (without a lookup)', async () => {
    const { service, repo } = setup();
    const lookup = jest.spyOn(repo, 'findByCode');
    await expect(service.verify('a'.repeat(24))).rejects.toMatchObject({ status: 404 });
    await expect(service.verify('not-a-code')).rejects.toBeInstanceOf(DomainError);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('still answers for a revoked certificate, marked revoked', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    await service.revoke(ADMIN, row.code, 'copied solutions');
    await expect(service.verify(row.code)).resolves.toMatchObject({
      status: 'revoked',
      revokedAt: NOW.toISOString(),
    });
  });
});

describe('CertificatesService hide from profile', () => {
  it('lets the owner hide it from the profile; the public link keeps working', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);

    await expect(service.setHidden(USER, row.code, true)).resolves.toMatchObject({ hidden: true });
    await expect(service.forProfile(OTHER, 'vana')).resolves.toEqual([]);
    await expect(service.verify(row.code)).resolves.toMatchObject({ status: 'valid' });

    await service.setHidden(USER, row.code, false);
    await expect(service.forProfile(OTHER, 'vana')).resolves.toHaveLength(1);
  });

  it('treats a certificate of someone else as not found', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    await expect(service.setHidden(OTHER, row.code, true)).rejects.toMatchObject({ status: 404 });
  });

  it('is a 404 for an unknown member', async () => {
    const { service } = setup();
    await expect(service.forProfile(USER, 'ghost')).rejects.toMatchObject({ status: 404 });
  });
});

describe('CertificatesService.revoke', () => {
  it('stores who, when and why, and emits the audit event', async () => {
    const { service, emitted } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    emitted.length = 0;

    const result = await service.revoke(ADMIN, row.code, 'copied solutions');

    expect(result).toMatchObject({
      status: 'revoked',
      revokedAt: NOW.toISOString(),
      revokeReason: 'copied solutions',
      githubLogin: 'vana',
    });
    expect(emitted).toEqual([
      {
        name: CertificateEvents.Revoked,
        payload: {
          actorId: ADMIN,
          certificateId: row.id,
          userId: USER,
          trackSlug: 'sql-30-days',
          reason: 'copied solutions',
        },
      },
    ]);
  });

  it('hides a revoked certificate from the profile', async () => {
    const { service } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    await service.revoke(ADMIN, row.code, 'copied solutions');
    await expect(service.forProfile(OTHER, 'vana')).resolves.toEqual([]);
  });

  it('refuses a second revoke with 409 and writes no second audit event', async () => {
    const { service, emitted } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    await service.revoke(ADMIN, row.code, 'copied solutions');
    emitted.length = 0;

    await expect(service.revoke(ADMIN, row.code, 'again')).rejects.toMatchObject({ status: 409 });
    expect(emitted).toEqual([]);
  });

  it('is a 409 when another admin revoked it between the read and the write', async () => {
    const { service, repo, emitted } = setup();
    const row = await service.issue(USER, TRACK, COMPLETED);
    emitted.length = 0;
    repo.revoke = async () => false;

    await expect(service.revoke(ADMIN, row.code, 'x y z')).rejects.toMatchObject({ status: 409 });
    expect(emitted).toEqual([]);
  });

  it('is a 404 for an unknown code', async () => {
    const { service } = setup();
    await expect(service.revoke(ADMIN, 'b'.repeat(24), 'reason')).rejects.toMatchObject({
      status: 404,
    });
  });
});
