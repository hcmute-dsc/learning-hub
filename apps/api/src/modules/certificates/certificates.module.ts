import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LearningModule } from '../learning/learning.module';
import { UsersModule } from '../users/users.module';
import {
  AdminCertificatesController,
  MemberCertificatesController,
  MyCertificatesController,
  PublicCertificatesController,
} from './certificates.controller';
import { CertificatesListener } from './certificates.listener';
import { CertificatesRepository } from './certificates.repository';
import { CertificatesService } from './certificates.service';

/**
 * F19 track completion certificates. Listens to learning's TrackCompleted event and
 * reads completed tracks from learning; learning never imports this module.
 * Admin revokes are written to audit_logs by AuditListener (certificate.revoked).
 */
@Module({
  imports: [CatalogModule, LearningModule, UsersModule],
  controllers: [
    PublicCertificatesController,
    MyCertificatesController,
    MemberCertificatesController,
    AdminCertificatesController,
  ],
  providers: [CertificatesRepository, CertificatesService, CertificatesListener],
})
export class CertificatesModule {}
