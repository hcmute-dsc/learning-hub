import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Clock } from '../../infrastructure/clock';
import type { CatalogReader, TrackOutline } from '../catalog/catalog.reader';
import type { EnrollmentRepository, EnrollmentRow } from './enrollment.repository';
import { EnrollmentService } from './enrollment.service';
import { LearningEvents } from './learning.events';
import type { ProgressService } from './progress.service';

const outline: TrackOutline = {
  id: 't-1',
  slug: 'sql',
  title: 'SQL',
  items: [{ kind: 'lesson', id: 'l-1', title: 'L1', moduleSlug: 'm' }],
};

/**
 * Listeners of one event run in parallel (emitAsync), so CompletionListener and
 * AchievementListener can both complete the same track at once. The repository only
 * completes an active row, and TrackCompleted must be announced once.
 */
describe('EnrollmentService completion race', () => {
  it('announces TrackCompleted once when two callers complete the same track', async () => {
    let row: EnrollmentRow = {
      id: 'e-1',
      userId: 'u-1',
      trackId: 't-1',
      status: 'active',
      cohort: null,
      enrolledAt: new Date('2026-11-01T00:00:00Z'),
      completedAt: null,
    } as EnrollmentRow;
    const snapshot = { ...row };

    const repo = {
      // both callers read the row before either one writes
      find: async () => snapshot,
      markCompleted: async (_id: string, at: Date) => {
        if (row.status !== 'active') return null;
        row = { ...row, status: 'completed', completedAt: at };
        return row;
      },
    } as unknown as EnrollmentRepository;
    const emit = jest.fn(async (_name: string, _event: unknown) => []);
    const service = new EnrollmentService(
      { trackOutline: async () => outline } as unknown as CatalogReader,
      repo,
      {
        statusesFor: async () => ({
          lessons: new Map([['l-1', 'completed' as const]]),
          exercises: new Map(),
        }),
      } as unknown as ProgressService,
      { now: () => new Date('2026-11-18T03:00:00Z') } as Clock,
      { emitAsync: emit } as unknown as EventEmitter2,
    );

    await Promise.all([
      service.refreshCompletion('u-1', 't-1'),
      service.refreshCompletion('u-1', 't-1'),
    ]);

    const completed = emit.mock.calls.filter((call) => call[0] === LearningEvents.TrackCompleted);
    expect(completed).toHaveLength(1);
  });
});
