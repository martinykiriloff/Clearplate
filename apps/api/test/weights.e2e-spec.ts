import { INestApplication } from '@nestjs/common';
import { createApp, signedInAgent } from './app';
import { day } from './fixtures';

describe('weights', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('logs one weigh-in per day, smooths the trend and reports the 7-day change', async () => {
    const { agent } = await signedInAgent(app);
    const days = [day(-11), day(-9), day(-7), day(-4), day(-2), day(0)];
    const kgs = [113.4, 113.9, 112.8, 112.9, 112.2, 112.4];
    for (let i = 0; i < days.length; i++) await agent.put('/api/weights').send({ date: days[i], weightKg: kgs[i] }).expect(200);
    await agent.put('/api/weights').send({ date: day(0), weightKg: 112.0 }).expect(200);

    const res = await agent.get(`/api/weights?from=${day(-30)}&to=${day(0)}`).expect(200);
    expect(res.body.points).toHaveLength(6);
    expect(res.body.points[5].weightKg).toBe(112);
    expect(res.body.summary.trendKg).toBeGreaterThan(112);
    expect(res.body.summary.change7dKg).toBeLessThan(0);
  });

  it('reports no 7-day change without a week of history', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/weights').send({ date: day(-2), weightKg: 100 }).expect(200);
    await agent.put('/api/weights').send({ date: day(0), weightKg: 99 }).expect(200);
    const res = await agent.get('/api/weights').expect(200);
    expect(res.body.summary.change7dKg).toBeNull();
  });

  it('deletes a weigh-in', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/weights').send({ date: day(-1), weightKg: 90 }).expect(200);
    await agent.delete(`/api/weights/${day(-1)}`).expect(204);
    await agent.delete(`/api/weights/${day(-1)}`).expect(404);
  });
});
