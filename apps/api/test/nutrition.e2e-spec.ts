import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { normalizeOff } from '../src/foods/open-food-facts';
import { createApp, signedInAgent } from './app';
import { day, onboarding, TODAY } from './fixtures';

describe('barcode, nutrients and copy', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  async function scanner() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/register').send({ email: `scanner@example.com`, password: 'correct-horse-battery' }).expect(201);
    await agent.put('/api/profile').send(onboarding).expect(200);
    return agent;
  }

  it('imports an unknown barcode from Open Food Facts once and caches it for everyone', async () => {
    const agent = await scanner();
    const scanned = await agent.get('/api/foods/scan/3800123456789').expect(200);
    expect(scanned.body).toMatchObject({ name: 'Test protein pudding', nameBg: 'Тестов протеинов пудинг', source: 'open_food_facts', sodiumMg: 120 });
    // Free number lookup and other users get the cached product.
    const other = await signedInAgent(app);
    const typed = await other.agent.get('/api/foods/barcode/3800123456789').expect(200);
    expect(typed.body.id).toBe(scanned.body.id);
    await agent.get('/api/foods/scan/3800000000000').expect(404);
  });

  it('snapshots fiber, sugar, saturated fat and sodium, and reports coverage', async () => {
    const agent = await (async () => {
      const { agent } = await signedInAgent(app);
      await agent.put('/api/profile').send(onboarding).expect(200);
      return agent;
    })();
    const [apple] = (await agent.get('/api/foods?q=apple').expect(200)).body;
    const entry = (await agent.post('/api/diary').send({ date: TODAY, meal: 'snack', foodId: apple.id, grams: 200 }).expect(201)).body;
    expect(entry).toMatchObject({ fiberG: 4.8, sugarG: 20.8, sodiumMg: 2 });
    await agent.post('/api/diary').send({ date: TODAY, meal: 'lunch', quick: { label: 'Burger', kcal: 600 } }).expect(201);

    const t = (await agent.get(`/api/today?date=${TODAY}`).expect(200)).body;
    expect(t.nutrients.fiberG).toBe(4.8);
    expect(t.nutrients.coveragePct).toBe(Math.round((104 / 704) * 100));
    expect(t.nutrientGoals).toMatchObject({ sodiumMaxMg: 2300 });
    expect(t.split.eaten.protein + t.split.eaten.fat + t.split.eaten.carbs).toBe(100);
    expect(t.split.target.protein).toBeGreaterThan(20);
  });

  it('tracks vitamins and minerals against DRI targets for sex and age', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/profile').send(onboarding).expect(200);
    const [salmon] = (await agent.get('/api/foods?q=salmon, atlantic, raw').expect(200)).body;
    expect(salmon.micros.vitaminD).toBeGreaterThan(5);
    const entry = (await agent.post('/api/diary').send({ date: TODAY, meal: 'dinner', foodId: salmon.id, grams: 200 }).expect(201)).body;
    expect(entry.micros.vitaminD).toBeCloseTo(salmon.micros.vitaminD * 2, 2);
    await agent.post('/api/diary').send({ date: TODAY, meal: 'lunch', quick: { label: 'Burger', kcal: 600 } }).expect(201);

    const t = (await agent.get(`/api/today?date=${TODAY}`).expect(200)).body;
    expect(t.nutrients.micros.vitaminD).toBeCloseTo(entry.micros.vitaminD, 1);
    expect(t.nutrients.micros.selenium).toBeGreaterThan(0);
    expect(t.nutrients.microCoveragePct).toBe(Math.round((entry.kcal / (entry.kcal + 600)) * 100));
    expect(t.microTargets.vitaminD).toEqual({ amount: 15, kind: 'RDA' });
    expect(t.microTargets.potassium.kind).toBe('AI');
    expect(Object.keys(t.microTargets)).toHaveLength(22);
  });

  it('carries micronutrients from recipes', async () => {
    const { agent } = await signedInAgent(app);
    const [r] = (await agent.get('/api/recipes?q=baked salmon').expect(200)).body;
    expect(r.micros?.vitaminD ?? 0).toBeGreaterThan(5);
  });

  it('copies a meal from yesterday into today', async () => {
    const { agent } = await signedInAgent(app);
    const [egg] = (await agent.get('/api/foods?q=egg, hard').expect(200)).body;
    await agent.post('/api/diary').send({ date: day(-1), meal: 'breakfast', foodId: egg.id, grams: 100 }).expect(201);
    await agent.post('/api/diary').send({ date: day(-1), meal: 'dinner', quick: { label: 'Pizza', kcal: 900 } }).expect(201);
    const res = await agent.post('/api/diary/copy').send({ fromDate: day(-1), toDate: TODAY, meal: 'breakfast' }).expect(201);
    expect(res.body.copied).toBe(1);
    const today = (await agent.get(`/api/diary?date=${TODAY}`).expect(200)).body;
    expect(today.totals.calories).toBe(155);
  });

  it('normalises Open Food Facts payloads (kJ only, salt only)', () => {
    const f = normalizeOff('123', { product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 1, fat_100g: 2, carbohydrates_100g: 3, salt_100g: 1 } });
    expect(f).toMatchObject({ kcal: 100, sodiumMg: 400 });
    expect(normalizeOff('123', { product_name: 'Y', nutriments: { proteins_100g: 1 } })).toBeNull();
  });
});
