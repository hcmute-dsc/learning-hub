import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ENV, type Env } from './infrastructure/config/env';

// Prisma returns BigInt for github_id; JSON has no BigInt.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('HCMUTE DSC Learning Hub API')
        .setVersion('v1')
        .addCookieAuth('sid')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(env.API_PORT);
}

void bootstrap();
