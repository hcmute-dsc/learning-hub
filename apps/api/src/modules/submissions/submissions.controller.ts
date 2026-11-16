import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { SubmissionsService } from './submissions.service';

/** Malformed ids are a 422 like every other validation error (BACKEND-DESIGN §3.4). */
const idPipe = new ZodPipe(z.string().uuid());

const mySubmissionsQuerySchema = z.object({ exerciseId: z.string().uuid().optional() }).strict();

/** Reading submissions back: the member's own list, and one submission by id. */
@ApiTags('submissions')
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get('me/submissions')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(mySubmissionsQuerySchema)) query: z.infer<typeof mySubmissionsQuerySchema>,
  ) {
    return this.submissions.listMine(user.id, query.exerciseId).then((data) => ({ data }));
  }

  /** Owner, mentor or admin; anyone else gets 404 (SECURITY §2, IDOR). */
  @Get('submissions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.submissions.get(user, id).then((data) => ({ data }));
  }
}
