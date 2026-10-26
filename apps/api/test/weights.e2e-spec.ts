import { INestApplication } from '@nestjs/common';
import { createApp, signedInAgent } from './app';

describe('weights', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('logs one weigh-in per day, smooths the trend and reports the 7-day change', async () => {
    const { agent } = await signedInAgent(app);
    const days = ['2026-10-10', '2026-10-12', '2026-10-14', '2026-10-17', '2026-10-19', '2026-10-21'];
    const kgs = [113.4, 113.9, 112.8, 112.9, 112.2, 112.4];
    for (let i = 0; i < days.length; i++) await agent.put('/api/weights').send({ date: days[i], weightKg: kgs[i] }).expect(200);
    await agent.put('/api/weights').send({ date: '2026-10-21', weightKg: 112.0 }).expect(200);

    const res = await agent.get('/api/weights?from=2026-10-01&to=2026-10-26').expect(200);
    expect(res.body.points).toHaveLength(6);
    expect(res.body.points[5].weightKg).toBe(112);
    expect(res.body.summary.trendKg).toBeGreaterThan(112);
    expect(res.body.summary.change7dKg).toBeLessThan(0);
  });

  it('deletes a weigh-in', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/weights').send({ date: '2026-10-20', weightKg: 90 }).expect(200);
    await agent.delete('/api/weights/2026-10-20').expect(204);
    await agent.delete('/api/weights/2026-10-20').expect(404);
  });
});
