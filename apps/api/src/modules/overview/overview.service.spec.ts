import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import type { Clock } from '../../infrastructure/clock';
import type { Env } from '../../infrastructure/config/env';
import type { AuditReader } from '../audit/audit.reader';
import type { ContentService } from '../content/content.service';
import type { SubmissionReviewService } from '../submissions/submission-review.service';
import type { UsersService } from '../users/users.service';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

const now = new Date('2026-11-18T12:00:00Z');
const weekAgo = new Date('2026-11-11T12:00:00Z');

function setup() {
  const users = {
    countByStatus: jest.fn().mockResolvedValue({ pending: 1, active: 9, suspended: 0 }),
    countSignedInSince: jest.fn().mockResolvedValue(4),
  };
  const content = {
    overviewCounts: jest.fn().mockResolvedValue({ published: null, drafts: 1 }),
  };
  const submissions = {
    reviewBacklog: jest.fn().mockResolvedValue({ waiting: 0, oldestSubmittedAt: null }),
    countSubmittedSince: jest.fn().mockResolvedValue(6),
  };
  const audit = { countSince: jest.fn().mockResolvedValue(2) };
  const service = new OverviewService(
    users as unknown as UsersService,
    content as unknown as ContentService,
    submissions as unknown as SubmissionReviewService,
    audit as unknown as AuditReader,
    { now: () => now } as Clock,
    { REVIEW_TARGET_HOURS: 48 } as Env,
  );
  return { service, users, submissions, audit };
}

describe('OverviewService', () => {
  it('asks every owning module for its counts over the same 7-day window', async () => {
    const { service, users, submissions, audit } = setup();
    const o = await service.get();

    expect(users.countSignedInSince).toHaveBeenCalledWith(weekAgo);
    expect(submissions.countSubmittedSince).toHaveBeenCalledWith(weekAgo);
    expect(audit.countSince).toHaveBeenCalledWith(weekAgo);
    expect(o).toEqual({
      members: { pending: 1, active: 9, suspended: 0 },
      content: { published: null, drafts: 1 },
      reviews: { waiting: 0, oldest: null, targetHours: 48 },
      activity: { days: 7, signedIn: 4, submissions: 6, adminActions: 2 },
    });
  });

  it('returns counts only, never an email', async () => {
    const { service } = setup();
    expect(JSON.stringify(await service.get())).not.toMatch(/email|@/i);
  });
});

describe('OverviewController', () => {
  it('is admin only (SECURITY §11)', () => {
    expect(new Reflector().get(REQUIRED_ROLES, OverviewController)).toEqual(['admin']);
  });
});
