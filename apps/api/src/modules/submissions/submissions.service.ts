import { Injectable } from '@nestjs/common';
import type { LinkSubmissionInput, SubmissionView } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader, type ExerciseContext } from '../catalog/catalog.reader';
import { ExerciseStateService } from './exercise-state.service';
import { codeSpec, projectSpec } from './exercise-spec';
import { parseSubmissionUrl, type SubmissionSource } from './submission-url';
import { SubmissionWriter } from './submission-writer';
import { SUBMISSION_ROW_SELECT, toSubmissionView } from './submission-view';
import {
  acceptedUrlFor,
  assertEndpointFits,
  assertOpen,
  assertSameRequest,
  canViewSubmission,
  linkSubmissionStatus,
} from './submit-rules';

/** GET /me/submissions returns at most this many, newest first (no paging yet). */
const MY_SUBMISSIONS_LIMIT = 50;

/** Result of a link submission: `replayed` = an earlier request with the same key (→ 200). */
export interface LinkSubmissionResult {
  replayed: boolean;
  submission: SubmissionView;
}

/**
 * Link submissions for code and project exercises (BACKEND-DESIGN §3.7: idempotent by
 * Idempotency-Key) and reading submissions back.
 */
@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly states: ExerciseStateService,
    private readonly writer: SubmissionWriter,
  ) {}

  async submitLink(
    user: AuthUser,
    exerciseId: string,
    input: LinkSubmissionInput,
    idempotencyKey: string,
  ): Promise<LinkSubmissionResult> {
    const exercise = await this.catalog.exercise(exerciseId);
    assertEndpointFits(exercise.type, ['code', 'project']);
    // user.githubLogin is loaded from `users` by the session guard on every request.
    const source = parseSubmissionUrl(input.url, this.acceptedUrl(exercise), user.githubLogin);

    // A retry is answered before the state rules: after the first request the exercise
    // may look different (e.g. in review), but the client must still get its submission.
    const replay = await this.findReplay(user.id, idempotencyKey, exercise.id, source);
    if (replay) return { replayed: true, submission: replay };

    assertOpen(await this.states.stateOf(user.id, exercise.id));
    const type = exercise.type as 'code' | 'project';
    try {
      const row = await this.writer.create({
        userId: user.id,
        exerciseId: exercise.id,
        contentVersionId: exercise.contentVersionId,
        status: linkSubmissionStatus(type),
        note: input.note ?? null,
        idempotencyKey,
        ...source,
      });
      return { replayed: false, submission: toSubmissionView(row) };
    } catch (err) {
      // Two parallel requests with the same key: the partial unique index
      // (user_id, idempotency_key) lets one in; the other replays it.
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.findReplay(user.id, idempotencyKey, exercise.id, source);
      if (!raced) throw err;
      return { replayed: true, submission: raced };
    }
  }

  async listMine(userId: string, exerciseId?: string): Promise<SubmissionView[]> {
    const rows = await this.prisma.submission.findMany({
      where: { userId, ...(exerciseId ? { exerciseId } : {}) },
      orderBy: [{ submittedAt: 'desc' }, { attempt: 'desc' }],
      take: MY_SUBMISSIONS_LIMIT,
      select: SUBMISSION_ROW_SELECT,
    });
    return rows.map(toSubmissionView);
  }

  async get(viewer: AuthUser, submissionId: string): Promise<SubmissionView> {
    const row = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { ...SUBMISSION_ROW_SELECT, userId: true },
    });
    if (!row || !canViewSubmission(viewer, row.userId)) throw DomainError.notFound('Submission');
    return toSubmissionView(row);
  }

  private acceptedUrl(exercise: ExerciseContext) {
    return exercise.type === 'code'
      ? acceptedUrlFor({ type: 'code', spec: codeSpec(exercise.spec) })
      : acceptedUrlFor({ type: 'project', spec: projectSpec(exercise.spec) });
  }

  /** The submission already stored under this key, after checking it is the same request. */
  private async findReplay(
    userId: string,
    idempotencyKey: string,
    exerciseId: string,
    source: SubmissionSource,
  ): Promise<SubmissionView | null> {
    const existing = await this.prisma.submission.findFirst({
      where: { userId, idempotencyKey },
      select: SUBMISSION_ROW_SELECT,
    });
    if (!existing) return null;
    assertSameRequest(existing, { exerciseId, sourceUrl: source.sourceUrl });
    return toSubmissionView(existing);
  }
}
