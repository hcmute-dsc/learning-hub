import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Clock } from '../../infrastructure/clock';
import type { Env } from '../../infrastructure/config/env';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MenteeMentorsService } from './mentee-mentors.service';
import { MentorshipEvents } from './mentorship.events';

const NOW = new Date('2026-11-27T02:00:00Z');
const ADMIN = '00000000-0000-4000-8000-000000000001';
const MENTOR = '00000000-0000-4000-8000-000000000002';
const MENTEE = '00000000-0000-4000-8000-000000000003';
const OTHER = '00000000-0000-4000-8000-000000000004';

function setup({ open = null as unknown, activeCount = 0 } = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    mentorAssignment: {
      findFirst: jest.fn().mockResolvedValue(open),
      count: jest.fn().mockResolvedValue(activeCount),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const users: Record<string, unknown> = {
    [MENTEE]: { githubLogin: 'mentee1', deletedAt: null },
    [MENTOR]: {
      githubLogin: 'mentor1',
      status: 'active',
      deletedAt: null,
      roles: [{ role: { code: 'mentor' } }],
    },
  };
  const prisma = {
    track: {
      findFirst: jest.fn().mockResolvedValue({ id: 'track-1', slug: 'git', title: 'Git' }),
    },
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(users[where.id] ?? null),
      ),
    },
    enrollment: { findUnique: jest.fn().mockResolvedValue({ status: 'active' }) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => Promise.resolve().then(() => fn(tx))),
  };
  const events = { emit: jest.fn() };
  const clock: Clock = { now: () => NOW };
  const service = new MenteeMentorsService(
    prisma as unknown as PrismaService,
    clock,
    events as unknown as EventEmitter2,
    { MENTOR_MAX_MENTEES: 5 } as Env,
  );
  return { service, prisma, tx, events };
}

describe('MenteeMentorsService.set', () => {
  it('gives a mentor to a mentee who has none, under the mentor lock', async () => {
    const { service, tx, events } = setup();
    await service.set(ADMIN, MENTEE, 'git', MENTOR);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.mentorAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        menteeId: MENTEE,
        mentorId: MENTOR,
        trackId: 'track-1',
        status: 'active',
        decidedBy: ADMIN,
        startedAt: NOW,
      }),
    });
    expect(events.emit).toHaveBeenCalledWith(
      MentorshipEvents.MenteeMentorChanged,
      expect.objectContaining({
        menteeLogin: 'mentee1',
        mentorLogin: 'mentor1',
        previousMentorLogin: null,
      }),
    );
  });

  it('ends the old assignment and starts a new one when the mentor changes', async () => {
    const open = { id: 'old', status: 'active', mentorId: OTHER, mentor: { githubLogin: 'old1' } };
    const { service, tx, events } = setup({ open });
    await service.set(ADMIN, MENTEE, 'git', MENTOR);

    expect(tx.mentorAssignment.update).toHaveBeenCalledWith({
      where: { id: 'old' },
      data: { status: 'ended', decidedBy: undefined, endedAt: NOW },
    });
    expect(tx.mentorAssignment.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      MentorshipEvents.MenteeMentorChanged,
      expect.objectContaining({ previousMentorLogin: 'old1' }),
    );
  });

  it('removes the mentor without counting anyone’s room', async () => {
    const open = {
      id: 'a1',
      status: 'active',
      mentorId: MENTOR,
      mentor: { githubLogin: 'mentor1' },
    };
    const { service, prisma, tx, events } = setup({ open });
    await service.set(ADMIN, MENTEE, 'git', null);

    expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    expect(tx.mentorAssignment.count).not.toHaveBeenCalled();
    expect(tx.mentorAssignment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'ended', decidedBy: undefined, endedAt: NOW },
    });
    expect(tx.mentorAssignment.create).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      MentorshipEvents.MenteeMentorChanged,
      expect.objectContaining({ mentorId: null, assignmentId: 'a1' }),
    );
  });

  it('fulfils a member request in place', async () => {
    const open = { id: 'r1', status: 'requested', mentorId: null, mentor: null };
    const { service, tx } = setup({ open });
    await service.set(ADMIN, MENTEE, 'git', MENTOR);

    expect(tx.mentorAssignment.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'active', mentorId: MENTOR, decidedBy: ADMIN, startedAt: NOW },
    });
    expect(tx.mentorAssignment.create).not.toHaveBeenCalled();
  });

  it('does nothing, and emits nothing, when the mentor is already the same', async () => {
    const open = {
      id: 'a1',
      status: 'active',
      mentorId: MENTOR,
      mentor: { githubLogin: 'mentor1' },
    };
    const { service, tx, events } = setup({ open });
    await service.set(ADMIN, MENTEE, 'git', MENTOR);
    expect(tx.mentorAssignment.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses a full mentor (409) and writes nothing', async () => {
    const { service, tx, events } = setup({ activeCount: 5 });
    await expect(service.set(ADMIN, MENTEE, 'git', MENTOR)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.mentorAssignment.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses a member who is not enrolled in the track', async () => {
    const { service, prisma, tx } = setup();
    prisma.enrollment.findUnique.mockResolvedValue(null);
    await expect(service.set(ADMIN, MENTEE, 'git', MENTOR)).rejects.toMatchObject({
      status: 409,
      message: 'Thành viên này chưa ghi danh track này.',
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('refuses picking yourself as your own mentor', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({
      githubLogin: 'mentor1',
      status: 'active',
      deletedAt: null,
      roles: [{ role: { code: 'mentor' } }],
    });
    await expect(service.set(ADMIN, MENTOR, 'git', MENTOR)).rejects.toMatchObject({
      status: 409,
      message: 'Không thể tự làm mentor của chính mình.',
    });
  });

  it('turns a unique violation into a 409', async () => {
    const { service, tx } = setup();
    tx.mentorAssignment.create.mockRejectedValue({ code: 'P2002', meta: {} });
    await expect(service.set(ADMIN, MENTEE, 'git', MENTOR)).rejects.toMatchObject({
      status: 409,
    });
  });
});
