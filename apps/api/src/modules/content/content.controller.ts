import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { ZodPipe } from '../../common/zod';
import { ContentService } from './content.service';

const syncSchema = z
  .object({
    commitSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
  })
  .strict()
  .default({});

/** Admin content pipeline (BACKEND-DESIGN §2 content). UI: web /admin/content. */
@ApiTags('admin')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  /** 201 new draft · 200 already synced · 422 invalid content (version kept as `rejected`) */
  @Post('sync')
  @Roles('content_maintainer')
  async sync(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(syncSchema)) body: z.infer<typeof syncSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { version, created } = await this.content.sync(user.id, body.commitSha);
    if (version.status === 'rejected') {
      const summary = version.summary as { issues?: { path: string; message: string }[] };
      throw new DomainError(
        'VALIDATION_FAILED',
        422,
        `Content at ${version.commitSha.slice(0, 7)} is invalid (version ${version.id})`,
        summary.issues ?? [],
      );
    }
    res.status(created ? 201 : 200);
    return { data: version };
  }

  @Get('versions')
  @Roles('content_maintainer')
  list() {
    return this.content.list().then((data) => ({ data }));
  }

  @Get('versions/:id')
  @Roles('content_maintainer')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.get(id).then((data) => ({ data }));
  }

  @Post('versions/:id/publish')
  @Roles('admin')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.publish(user.id, id).then((data) => ({ data }));
  }

  @Post('versions/:id/reject')
  @Roles('admin')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.reject(user.id, id).then((data) => ({ data }));
  }
}
