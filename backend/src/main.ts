import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const logger = new Logger('Bootstrap');

  app.disable('x-powered-by');
  app.use(helmet());
  app.useBodyParser('json', { limit: '16kb' });
  app.useBodyParser('urlencoded', { limit: '16kb', extended: false });
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    methods: ['GET', 'POST', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });
  await app.listen(port, host);

  logger.log(`DocuMind AI backend listening on http://${host}:${port}`);
  for (const address of lanAddresses()) {
    logger.log(
      `  Phone/Expo Go URL -> EXPO_PUBLIC_BACKEND_URL=http://${address}:${port}`,
    );
  }
}

void bootstrap();
