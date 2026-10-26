import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

export async function createApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://clearplate:clearplate@localhost:5432/clearplate_test';
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

let counter = 0;
/** Registers a fresh user and returns an agent that carries the session cookie. */
export async function signedInAgent(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());
  const email = `user${Date.now()}${counter++}@example.com`;
  await agent.post('/api/auth/register').send({ email, password: 'correct-horse-battery' }).expect(201);
  return { agent, email };
}
