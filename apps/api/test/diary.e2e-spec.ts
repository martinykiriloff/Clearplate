import { INestApplication } from '@nestjs/common';
import { createApp, signedInAgent } from './app';
import { onboarding } from './fixtures';

const date = '2026-10-26';

async function onboardedAgent(app: INestApplication) {
  const { agent } = await signedInAgent(app);
  await agent.put('/api/profile').send({ ...onboarding, today: '2026-10-20' }).expect(200);
  return agent;
}

describe('diary & today', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('logs food by grams, recipes by servings and quick estimates, and sums the day', async () => {
    const agent = await onboardedAgent(app);
    const [yogurt] = (await agent.get('/api/foods?q=greek yogurt, plain 2').expect(200)).body;
    const [recipe] = (await agent.get('/api/recipes?mealType=lunch&limit=1').expect(200)).body;

    const food = await agent.post('/api/diary').send({ date, meal: 'breakfast', foodId: yogurt.id, grams: 400 }).expect(201);
    expect(food.body).toMatchObject({ grams: 400, kcal: Math.round(yogurt.kcal * 4), isEstimate: false });

    await agent.post('/api/diary').send({ date, meal: 'lunch', recipeId: recipe.id, servings: 1 }).expect(201);
    const quick = await agent.post('/api/diary').send({ date, meal: 'snack', quick: { label: 'Coffee with milk', kcal: 40 } }).expect(201);
    expect(quick.body.isEstimate).toBe(true);

    const day = await agent.get(`/api/diary?date=${date}`).expect(200);
    expect(day.body.totals.calories).toBe(Math.round(yogurt.kcal * 4 + recipe.kcal + 40));
    expect(day.body.meals.map((m: { meal: string }) => m.meal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it('rejects ambiguous entries', async () => {
    const agent = await onboardedAgent(app);
    await agent.post('/api/diary').send({ date, meal: 'lunch' }).expect(400);
    const [food] = (await agent.get('/api/foods?q=apple').expect(200)).body;
    const [recipe] = (await agent.get('/api/recipes?limit=1').expect(200)).body;
    await agent.post('/api/diary').send({ date, meal: 'lunch', foodId: food.id, recipeId: recipe.id }).expect(400);
  });

  it('rescales on edit, and supports delete + undo', async () => {
    const agent = await onboardedAgent(app);
    const [apple] = (await agent.get('/api/foods?q=apple').expect(200)).body;
    const entry = (await agent.post('/api/diary').send({ date, meal: 'snack', foodId: apple.id, isEstimate: true }).expect(201)).body;
    expect(entry.grams).toBe(apple.servingG);

    const edited = (await agent.patch(`/api/diary/${entry.id}`).send({ grams: entry.grams * 2, isEstimate: false }).expect(200)).body;
    expect(edited.kcal).toBe(Math.round(apple.kcal * apple.servingG * 2 / 100));
    expect(edited.isEstimate).toBe(false);

    await agent.delete(`/api/diary/${entry.id}`).expect(204);
    expect((await agent.get(`/api/diary?date=${date}`)).body.totals.calories).toBe(0);
    await agent.post(`/api/diary/${entry.id}/restore`).expect(201);
    expect((await agent.get(`/api/diary?date=${date}`)).body.totals.calories).toBe(edited.kcal);
  });

  it('never exposes another user’s entries', async () => {
    const agent = await onboardedAgent(app);
    const [apple] = (await agent.get('/api/foods?q=apple').expect(200)).body;
    const entry = (await agent.post('/api/diary').send({ date, meal: 'snack', foodId: apple.id }).expect(201)).body;
    const other = await onboardedAgent(app);
    await other.patch(`/api/diary/${entry.id}`).send({ grams: 10 }).expect(404);
    await other.delete(`/api/diary/${entry.id}`).expect(404);
  });

  it('builds the Today view: equation, next best food, weight and streak', async () => {
    const agent = await onboardedAgent(app);
    const [yogurt] = (await agent.get('/api/foods?q=greek yogurt, plain 2').expect(200)).body;
    for (const d of ['2026-10-24', '2026-10-25', date]) {
      await agent.post('/api/diary').send({ date: d, meal: 'breakfast', foodId: yogurt.id, grams: 300 }).expect(201);
    }
    await agent.put('/api/weights').send({ date: '2026-10-26', weightKg: 112.4 }).expect(200);

    const t = (await agent.get(`/api/today?date=${date}`).expect(200)).body;
    expect(t.remaining.calories).toBe(t.targets.calories - t.eaten.calories);
    expect(t.progress).toBe(Math.round((t.eaten.calories / t.targets.calories) * 100));
    expect(t.streak).toBe(3);
    expect(t.weight.weightKg).toBe(112.4);
    expect(t.nextBestFood).toMatchObject({ meal: 'lunch' });
    expect(t.nextBestFood.kcal).toBeLessThanOrEqual(t.remaining.calories);
    expect(t.nextBestFood.reason).toMatch(/protein/);
  });

  it('returns a Today view without targets before onboarding', async () => {
    const { agent } = await signedInAgent(app);
    const t = (await agent.get(`/api/today?date=${date}`).expect(200)).body;
    expect(t).toMatchObject({ targets: null, remaining: null, nextBestFood: null, streak: 0 });
  });
});
