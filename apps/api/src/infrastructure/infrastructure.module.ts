import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './config/env';
import { PrismaService } from './prisma/prisma.service';
import { Clock, SystemClock } from './clock';

/** Cross-cutting infrastructure available to every module. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    PrismaService,
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [ENV, PrismaService, Clock],
})
export class InfrastructureModule {}
