import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FOOD_PROVIDER, FoodProvider } from '../src/foods/open-food-facts';
import { configureApp } from '../src/setup';

/** A stand-in for Open Food Facts: knows exactly one product. */
export const fakeFoodProvider: FoodProvider = {
  async lookup(barcode) {
    if (barcode !== '3800123456789') return null;
    return {
      barcode,
      name: 'Test protein pudding',
      nameBg: 'Тестов протеинов пудинг',
      brand: 'Acme',
      kcal: 80,
      proteinG: 10,
      fatG: 1.5,
      carbsG: 6,
      fiberG: 0.5,
      sugarG: 4,
      satFatG: 1,
      sodiumMg: 120,
      micros: { calcium: 150 },
      servingG: 200,
    };
  },
};

export async function createApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://clearplate:clearplate@localhost:5432/clearplate_test';
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FOOD_PROVIDER)
    .useValue(fakeFoodProvider)
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
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
