import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { runMigrations } from './db/migrate';
import { configureApp } from './setup';

async function bootstrap() {
  if (process.env.RUN_MIGRATIONS === 'true' && process.env.DATABASE_URL) {
    await runMigrations(process.env.DATABASE_URL);
    Logger.log('Database migrations applied', 'Bootstrap');
  }

  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = app.get(ConfigService).get<string>('API_PORT') ?? '4000';
  await app.listen(Number(port), '0.0.0.0');
  Logger.log(`API listening on :${port} (docs at /api/docs)`, 'Bootstrap');
}

void bootstrap();
