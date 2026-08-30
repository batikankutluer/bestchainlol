import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.setGlobalPrefix('api', {
    // Prometheus scrapes a bare /metrics; health stays reachable for compose healthchecks.
    exclude: ['metrics', 'health'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const origins = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean) as string[];
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });

  app.enableShutdownHooks();

  // 3100, not 3000: :3000 is the most contested port in JS development and a
  // second project holding it makes this fail to bind while the frontends come
  // up fine. The same fallback appears in docker-compose.yml and both vite
  // configs — setting BACKEND_PORT overrides all of them at once.
  const port = Number(process.env.BACKEND_PORT ?? 3100);
  try {
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    // Bun renders the throw site for an uncaught listen error, which buries the
    // one fact that matters under fifty lines of framework source. The usual
    // cause is a previous dev server that did not exit — `bun --watch` leaves
    // the child behind when its parent is killed.
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      logger.error(
        `port ${port} is already in use.\n` +
          `  Usually a previous dev server that did not exit.\n` +
          `  Find it:      lsof -ti tcp:${port}\n` +
          `  Stop it:      kill $(lsof -ti tcp:${port})\n` +
          `  Or move this: BACKEND_PORT=<other> bun run dev`,
      );
      process.exit(1);
    }
    throw error;
  }

  logger.log(`backend listening on :${port} (cors: ${origins.join(', ') || 'any'})`);
}

void bootstrap();
