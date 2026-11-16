import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { lessonProgressSchema, type LessonProgressInput } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { LessonService } from './lesson.service';

/**
 * Ids are UUIDs. Validated with Zod like every other input, so a malformed id is a 422
 * (BACKEND-DESIGN §3.4) and the web can treat it as "not found".
 */
const idPipe = new ZodPipe(z.string().uuid());

/** Lesson page and lesson progress; signed-in active members only (global guard). */
@ApiTags('learning')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonService) {}

  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.lessons.view(user.id, id).then((data) => ({ data }));
  }

  @Put(':id/progress')
  setProgress(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(lessonProgressSchema)) body: LessonProgressInput,
  ) {
    return this.lessons.setProgress(user.id, id, body).then((data) => ({ data }));
  }
}
