import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Shared by main.ts and e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // The browser reaches the API through a proxy, so rate limits must key on
  // X-Forwarded-For or everyone behind the proxy shares one bucket. Behind the
  // Next.js proxy (and possibly a load balancer) trust it from private networks
  // only. Vercel's edge overwrites any client-sent X-Forwarded-For, so on
  // Vercel it is trusted as-is.
  const trustProxy = process.env.VERCEL ? true : 'loopback, linklocal, uniquelocal';
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set('trust proxy', trustProxy);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get<string>('WEB_URL'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Clearplate API')
    .setDescription('Goal − Food = Left today')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('cp_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
}
