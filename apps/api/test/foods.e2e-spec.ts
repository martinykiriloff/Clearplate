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
  });

  it('validates custom food input', async () => {
    const { agent } = await signedInAgent(app);
    await agent.post('/api/foods').send({ name: 'Bad', kcal: 100, proteinG: 120, fatG: 0, carbsG: 0 }).expect(400);
    await agent.post('/api/foods').send({ name: 'Bad', barcode: '123', kcal: 100, proteinG: 1, fatG: 0, carbsG: 0 }).expect(400);
  });
});
