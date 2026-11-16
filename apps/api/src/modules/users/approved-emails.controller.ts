import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { approvedEmailsUpdateSchema } from '@hub/shared';
import type { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ApprovedEmailsService } from './approved-emails.service';

/** Club member email list (SECURITY §1). Admin only: it is personal data. */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/approved-emails')
export class ApprovedEmailsController {
  constructor(private readonly approvedEmails: ApprovedEmailsService) {}

  @Get()
  list() {
    return this.approvedEmails.list().then((data) => ({ data }));
  }

  @Put()
  update(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(approvedEmailsUpdateSchema)) body: z.infer<typeof approvedEmailsUpdateSchema>,
  ) {
    return this.approvedEmails
      .update(actor.id, body.emails, body.mode, body.note)
      .then((data) => ({ data }));
  }
}
