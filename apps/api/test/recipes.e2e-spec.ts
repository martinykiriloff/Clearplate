import { INestApplication } from '@nestjs/common';
import { createApp, signedInAgent } from './app';

describe('recipes', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('lists public recipes filtered by meal and calories, protein-dense first', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.get('/api/recipes?mealType=dinner&maxKcal=420').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const r of res.body) {
      expect(r.mealType).toBe('dinner');
      expect(r.kcal).toBeLessThanOrEqual(420);
    }
    const density = res.body.map((r: { proteinG: number; kcal: number }) => r.proteinG / r.kcal);
    expect(density).toEqual([...density].sort((a, b) => b - a));
  });

  it('marks catalogue recipes as authored: no source and no estimate coverage', async () => {
    const { agent } = await signedInAgent(app);
    const [first] = (await agent.get('/api/recipes?limit=1').expect(200)).body;
    expect(first).toMatchObject({ sourceName: null, sourceUrl: null, estimateCoverage: null, cuisine: null });
  });

  it('creates private recipes that only the owner can see or delete', async () => {
    const { agent } = await signedInAgent(app);
    const other = await signedInAgent(app);
    const created = await agent
      .post('/api/recipes')
      .send({ name: 'Mum’s beef stew', mealType: 'dinner', ingredients: 'beef, carrots', method: 'Simmer 2 h', kcal: 520, proteinG: 48, fatG: 22, carbsG: 30 })
      .expect(201);
    await other.agent.get(`/api/recipes/${created.body.id}`).expect(404);
    await other.agent.delete(`/api/recipes/${created.body.id}`).expect(404);
    await agent.delete(`/api/recipes/${created.body.id}`).expect(204);
  });

  it('does not allow deleting catalogue recipes', async () => {
    const { agent } = await signedInAgent(app);
    const [first] = (await agent.get('/api/recipes?limit=1').expect(200)).body;
    await agent.delete(`/api/recipes/${first.id}`).expect(404);
  });
});
