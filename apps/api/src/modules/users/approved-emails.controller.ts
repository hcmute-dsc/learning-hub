import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ApprovedEmailsService } from './approved-emails.service';

const updateSchema = z
  .object({
    emails: z.array(z.string().trim().email()).min(1).max(5000),
    /** `append` (default) adds to the list; `replace` makes this the whole list */
    mode: z.enum(['append', 'replace']).default('append'),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

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
    @Body(new ZodPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return this.approvedEmails
      .update(actor.id, body.emails, body.mode, body.note)
      .then((data) => ({ data }));
  }
}
