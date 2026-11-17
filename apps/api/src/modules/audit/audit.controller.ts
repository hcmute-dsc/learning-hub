import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditQuerySchema, type AuditQuery } from '@hub/shared';
import { Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { AuditReader } from './audit.reader';

/** Audit log, newest first (SECURITY §11: admin only). */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly reader: AuditReader) {}

  @Get()
  list(@Query(new ZodPipe(auditQuerySchema)) query: AuditQuery) {
    return this.reader.list(query);
  }

  @Get('actions')
  actions() {
    return this.reader.actions().then((data) => ({ data }));
  }
}
