import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

/** Prefer real LAN Wi‑Fi/Ethernet; skip Hyper‑V, WSL, and VirtualBox host-only IPs. */
function phoneReachableAddresses(): { recommended: string[]; other: string[] } {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);

  const skip = (ip: string) =>
    ip.startsWith('169.254.') ||
    ip === '192.168.56.1' ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.17.');

  const recommended = all.filter(
    (ip) => !skip(ip) && /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
  );
  const other = all.filter((ip) => !recommended.includes(ip));
  return { recommended, other };
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

  const { recommended, other } = phoneReachableAddresses();
  if (recommended.length > 0) {
    logger.log(
      `  Use Wi‑Fi IP in frontend/.env (phone must be on same network):`,
    );
    for (const address of recommended) {
      logger.log(
        `    EXPO_PUBLIC_BACKEND_URL=http://${address}:${port}  ← recommended`,
      );
    }
  } else {
    logger.warn(
      'No typical Wi‑Fi/Ethernet IPv4 found. Run ipconfig and set EXPO_PUBLIC_BACKEND_URL manually.',
    );
  }
  for (const address of other) {
    logger.log(
      `    (virtual/VPN) http://${address}:${port} — usually not reachable from your phone`,
    );
  }
}

void bootstrap();
