import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditController } from './audit.controller';
import { AuditListener } from './audit.listener';
import { AuditReader } from './audit.reader';

/** Writes audit_logs from events (listener) and reads them for admins (reader). */
@Module({
  imports: [UsersModule],
  controllers: [AuditController],
  providers: [AuditListener, AuditReader],
})
export class AuditModule {}
