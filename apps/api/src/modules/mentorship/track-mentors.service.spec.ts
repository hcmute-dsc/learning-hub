import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Clock } from '../../infrastructure/clock';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MentorshipEvents } from './mentorship.events';
import { TrackMentorsService } from './track-mentors.service';

const NOW = new Date('2026-11-26T02:00:00Z');
const ADMIN = '00000000-0000-4000-8000-000000000001';
const MENTOR = '00000000-0000-4000-8000-000000000002';

function setup(overrides: Record<string, unknown> = {}) {
  const prisma = {
    track: { findFirst: jest.fn().mockResolvedValue({ id: 'track-1' }), findMany: jest.fn() },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        githubLogin: 'mentor1',
        status: 'active',
        deletedAt: null,
        roles: [{ role: { code: 'member' } }, { role: { code: 'mentor' } }],
      }),
      findMany: jest.fn(),
    },
    trackMentor: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({ id: 'row-1', mentor: { githubLogin: 'mentor1' } }),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    mentorAssignment: { groupBy: jest.fn() },
    ...overrides,
  };
  const events = { emit: jest.fn() };
  const clock: Clock = { now: () => NOW };
  const service = new TrackMentorsService(
    prisma as unknown as PrismaService,
    clock,
    events as unknown as EventEmitter2,
  );
  return { service, prisma, events };
}

describe('TrackMentorsService.assign', () => {
  it('opens a row and emits the audit event', async () => {
    const { service, prisma, events } = setup();
    await service.assign(ADMIN, MENTOR, 'git-basics');

    expect(prisma.track.findFirst).toHaveBeenCalledWith({
      where: { slug: 'git-basics', status: 'active' },
      select: { id: true },
    });
    expect(prisma.trackMentor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trackId: 'track-1',
        mentorId: MENTOR,
        assignedBy: ADMIN,
        startedAt: NOW,
      }),
    });
    expect(events.emit).toHaveBeenCalledWith(
      MentorshipEvents.TrackMentorAssigned,
      expect.objectContaining({ actorId: ADMIN, mentorLogin: 'mentor1', trackSlug: 'git-basics' }),
    );
  });

  it('is 404 for an unknown or archived track, before touching the mentor', async () => {
    const { service, prisma } = setup();
    prisma.track.findFirst.mockResolvedValue(null);
    await expect(service.assign(ADMIN, MENTOR, 'old')).rejects.toMatchObject({ status: 404 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an account without the mentor role', async () => {
    const { service, prisma, events } = setup();
    prisma.user.findUnique.mockResolvedValue({
      githubLogin: 'x',
      status: 'active',
      deletedAt: null,
      roles: [{ role: { code: 'member' } }],
    });
    await expect(service.assign(ADMIN, MENTOR, 'git-basics')).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.trackMentor.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('turns the one-open-row unique index into a 409, without an event', async () => {
    const { service, prisma, events } = setup();
    prisma.trackMentor.create.mockRejectedValue({ code: 'P2002', meta: {} });
    await expect(service.assign(ADMIN, MENTOR, 'git-basics')).rejects.toMatchObject({
      status: 409,
      message: 'Mentor này đã phụ trách track này rồi.',
    });
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('TrackMentorsService.end', () => {
  it('closes the open row (kept as history) and emits the audit event', async () => {
    const { service, prisma, events } = setup();
    await service.end(ADMIN, MENTOR, 'git-basics');

    expect(prisma.trackMentor.updateMany).toHaveBeenCalledWith({
      where: { id: 'row-1', endedAt: null },
      data: { endedAt: NOW, endedBy: ADMIN },
    });
    expect(events.emit).toHaveBeenCalledWith(
      MentorshipEvents.TrackMentorEnded,
      expect.objectContaining({ assignmentId: 'row-1', mentorLogin: 'mentor1' }),
    );
  });

  it('is 404 when the mentor is not in charge of the track', async () => {
    const { service, prisma } = setup();
    prisma.trackMentor.findFirst.mockResolvedValue(null);
    await expect(service.end(ADMIN, MENTOR, 'git-basics')).rejects.toMatchObject({ status: 404 });
  });

  it('emits nothing when another admin closed it first', async () => {
    const { service, prisma, events } = setup();
    prisma.trackMentor.updateMany.mockResolvedValue({ count: 0 });
    await service.end(ADMIN, MENTOR, 'git-basics');
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('TrackMentorsService reads', () => {
  it('builds the admin view with mentee counts per mentor', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([
      { id: MENTOR, githubLogin: 'mentor1', displayName: 'Mentor', avatarUrl: null },
    ]);
    prisma.track.findMany.mockResolvedValue([{ slug: 'git-basics', title: 'Git' }]);
    prisma.trackMentor.findMany.mockResolvedValue([
      {
        mentorId: MENTOR,
        startedAt: NOW,
        track: { slug: 'git-basics', title: 'Git', position: 1 },
      },
    ]);
    prisma.mentorAssignment.groupBy.mockResolvedValue([{ mentorId: MENTOR, _count: { _all: 3 } }]);

    const view = await service.adminView();

    expect(view.tracks).toEqual([{ slug: 'git-basics', title: 'Git' }]);
    expect(view.mentors[0]).toMatchObject({
      activeMentees: 3,
      tracks: [{ slug: 'git-basics', since: NOW.toISOString() }],
    });
  });

  it('lists only current mentors of an active track for the track page', async () => {
    const { service, prisma } = setup();
    const mentor = { id: MENTOR, githubLogin: 'mentor1', displayName: 'Mentor', avatarUrl: null };
    prisma.trackMentor.findMany.mockResolvedValue([{ mentor }]);

    await expect(service.forTrack('git-basics')).resolves.toEqual([mentor]);
    expect(prisma.trackMentor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          endedAt: null,
          track: { slug: 'git-basics', status: 'active' },
          mentor: {
            status: 'active',
            deletedAt: null,
            roles: { some: { role: { code: 'mentor' } } },
          },
        },
      }),
    );
  });
});
