import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { OriginGuard } from './common/origin.guard';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadEnv } from './infrastructure/config/env';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuditModule } from './modules/audit/audit.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ContentModule } from './modules/content/content.module';
import { ContentReportsModule } from './modules/content-reports/content-reports.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { LearningModule } from './modules/learning/learning.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OverviewModule } from './modules/overview/overview.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { HealthController } from './modules/health/health.controller';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';

const env = loadEnv();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id =
            typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        transport:
          env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    // business modules
    IdentityModule,
    UsersModule,
    CatalogModule,
    ContentModule,
    SubmissionsModule,
    LearningModule,
    ReviewsModule,
    CertificatesModule,
    AuditModule,
    OverviewModule,
    NotificationsModule,
    LeaderboardModule,
    ReportsModule,
    ContentReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
