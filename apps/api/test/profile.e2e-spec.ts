import { INestApplication } from '@nestjs/common';
import { createApp, signedInAgent } from './app';
import { onboarding } from './fixtures';

describe('profile & targets', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('needs onboarding before a profile exists', async () => {
    const { agent } = await signedInAgent(app);
    await agent.get('/api/profile').expect(404);
    await agent.get('/api/auth/me').expect((r) => expect(r.body.onboarded).toBe(false));
  });

  it('requires explicit health-data consent and adults only', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/profile').send({ ...onboarding, healthDataConsent: false }).expect(400);
    await agent.put('/api/profile').send({ ...onboarding, birthDate: '2010-01-01' }).expect(400);
  });

  it('computes targets, stores the starting weight and marks the user onboarded', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.put('/api/profile').send(onboarding).expect(200);
    expect(res.body.targets).toMatchObject({ source: 'questionnaire', effectiveFrom: '2026-10-26' });
    expect(res.body.targets.calories).toBeLessThan(res.body.targets.tdee);
    expect(res.body.expectedWeeklyChangeKg).toBeLessThan(0);
    expect(res.body.profile.healthDataConsentAt).toBeTruthy();
    await agent.get('/api/auth/me').expect((r) => expect(r.body.onboarded).toBe(true));
  });

  it('accepts manual targets but not below the safety floor', async () => {
    const { agent } = await signedInAgent(app);
    await agent.put('/api/profile').send(onboarding).expect(200);
    await agent.put('/api/profile/targets').send({ calories: 1400, proteinG: 170, fatG: 50, carbsG: 100, today: '2026-10-27' }).expect(400);
    const ok = await agent.put('/api/profile/targets').send({ calories: 2100, proteinG: 180, fatG: 65, carbsG: 195, today: '2026-10-27' }).expect(200);
    expect(ok.body).toMatchObject({ calories: 2100, source: 'manual' });
    const before = await agent.get('/api/profile?date=2026-10-26').expect(200);
    expect(before.body.targets.source).toBe('questionnaire');
  });
});
