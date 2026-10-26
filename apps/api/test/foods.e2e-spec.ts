import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, signedInAgent } from './app';

describe('foods', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/api/foods?q=salmon').expect(401);
  });

  it('finds foods by prefix first and tolerates typos', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.get('/api/foods?q=salmon').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name.toLowerCase().startsWith('salmon')).toBe(true);
    const typo = await agent.get('/api/foods?q=brocoli').expect(200);
    expect(typo.body.some((f: { name: string }) => f.name.startsWith('Broccoli'))).toBe(true);
  });

  it('creates a custom food with a barcode, finds it by number, and keeps it private', async () => {
    const { agent } = await signedInAgent(app);
    const created = await agent
      .post('/api/foods')
      .send({ name: 'My protein bar', brand: 'Acme', barcode: '4006381333931', kcal: 360, proteinG: 33, fatG: 12, carbsG: 30, servingG: 60, servingName: 'bar' })
      .expect(201);
    expect(created.body).toMatchObject({ source: 'user', verified: false });
    await agent.get('/api/foods/barcode/4006381333931').expect(200);
    await agent.post('/api/foods').send({ name: 'Duplicate', barcode: '4006381333931', kcal: 1, proteinG: 0, fatG: 0, carbsG: 0 }).expect(409);

    const other = await signedInAgent(app);
    await other.agent.get('/api/foods/barcode/4006381333931').expect(404);
    await other.agent.get(`/api/foods/${created.body.id}`).expect(404);
    // Another user can use the same barcode for their own food: no cross-user blocking or leak.
    await other.agent.post('/api/foods').send({ name: 'Their bar', barcode: '4006381333931', kcal: 350, proteinG: 30, fatG: 10, carbsG: 30 }).expect(201);
  });

  it('deletes custom foods with the account instead of publishing them', async () => {
    const { agent } = await signedInAgent(app);
    await agent.post('/api/foods').send({ name: 'Secret family pie', kcal: 300, proteinG: 5, fatG: 15, carbsG: 35 }).expect(201);
    await agent.delete('/api/auth/me').expect(204);
    const other = await signedInAgent(app);
    const res = await other.agent.get('/api/foods?q=secret family pie').expect(200);
    expect(res.body.some((f: { name: string }) => f.name === 'Secret family pie')).toBe(false);
  });

  it('validates custom food input', async () => {
    const { agent } = await signedInAgent(app);
    await agent.post('/api/foods').send({ name: 'Bad', kcal: 100, proteinG: 120, fatG: 0, carbsG: 0 }).expect(400);
    await agent.post('/api/foods').send({ name: 'Bad', barcode: '123', kcal: 100, proteinG: 1, fatG: 0, carbsG: 0 }).expect(400);
  });
});
