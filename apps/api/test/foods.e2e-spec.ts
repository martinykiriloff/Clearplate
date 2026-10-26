import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, signedInAgent } from './app';
import { day, TODAY } from './fixtures';

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

  it('searches Bulgarian names too, typo tolerant', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.get(`/api/foods?q=${encodeURIComponent('сьомга')}`).expect(200);
    expect(res.body[0].nameBg.toLowerCase().startsWith('сьомга')).toBe(true);
    expect(res.body[0].name).toMatch(/Salmon/);
    const typo = await agent.get(`/api/foods?q=${encodeURIComponent('кашкавл')}`).expect(200);
    expect(typo.body.some((f: { nameBg: string }) => f.nameBg === 'Кашкавал')).toBe(true);
  });

  describe('camera scans', () => {
    /** Five private foods with barcodes, so scans resolve without Open Food Facts. */
    async function ownFoods(agent: request.Agent, n: number) {
      const codes: string[] = [];
      for (let i = 0; i < n; i++) {
        const barcode = `59000000000${i}`;
        await agent.post('/api/foods').send({ name: `Scan test ${i}`, barcode, kcal: 100, proteinG: 5, fatG: 5, carbsG: 10 }).expect(201);
        codes.push(barcode);
      }
      return codes;
    }

    it('gives free accounts 5 distinct scans a day, then answers 402 scan_limit_reached', async () => {
      const { agent } = await signedInAgent(app);
      const codes = await ownFoods(agent, 6);

      for (const [i, code] of codes.slice(0, 5).entries()) {
        await agent.get(`/api/foods/scan/${code}?today=${TODAY}`).expect(200);
        const quota = await agent.get(`/api/foods/scan/quota?today=${TODAY}`).expect(200);
        expect(quota.body).toMatchObject({ limit: 5, used: i + 1, remaining: 4 - i, date: TODAY });
      }

      const blocked = await agent.get(`/api/foods/scan/${codes[5]}?today=${TODAY}`).expect(402);
      expect(blocked.body).toMatchObject({ code: 'scan_limit_reached', module: 'barcode', limit: 5, used: 5 });

      // Re-scanning a product already scanned today is free; the allowance stays used up.
      await agent.get(`/api/foods/scan/${codes[0]}?today=${TODAY}`).expect(200);
      expect((await agent.get(`/api/foods/scan/quota?today=${TODAY}`)).body).toMatchObject({ used: 5, remaining: 0 });

      // Typing the number under the barcode stays free and unlimited.
      await agent.get(`/api/foods/barcode/${codes[5]}`).expect(200);

      // A new local day starts a fresh allowance.
      await agent.get(`/api/foods/scan/${codes[5]}?today=${day(1)}`).expect(200);
      expect((await agent.get(`/api/foods/scan/quota?today=${day(1)}`)).body).toMatchObject({ used: 1, remaining: 4 });
    });

    it('does not charge a scan for an unknown barcode', async () => {
      const { agent } = await signedInAgent(app);
      await agent.get('/api/foods/scan/59009999999999').expect(404);
      expect((await agent.get('/api/foods/scan/quota')).body).toMatchObject({ used: 0, remaining: 5 });
      // The Open Food Facts stand-in knows this one: it counts, and is cached in the catalogue.
      await agent.get('/api/foods/scan/3800123456789').expect(200);
      expect((await agent.get('/api/foods/scan/quota')).body).toMatchObject({ used: 1, remaining: 4 });
    });

    it('rejects a client date that is not today', async () => {
      const { agent } = await signedInAgent(app);
      await agent.get(`/api/foods/scan/quota?today=${day(-5)}`).expect(400);
      await agent.get(`/api/foods/scan/4006381333931?today=2020-01-01`).expect(400);
    });

    it('is unlimited with the Barcode module', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send({ email: 'unlimited@example.com', password: 'correct-horse-battery' }).expect(201);
      expect((await agent.get('/api/foods/scan/quota')).body).toEqual({ limit: null, used: 0, remaining: null, date: expect.any(String) });
      const codes = await ownFoods(agent, 6);
      for (const code of codes) await agent.get(`/api/foods/scan/${code}`).expect(200);
      expect((await agent.get('/api/foods/scan/quota')).body).toMatchObject({ limit: null, remaining: null });
    });
  });

  it('validates custom food input', async () => {
    const { agent } = await signedInAgent(app);
    await agent.post('/api/foods').send({ name: 'Bad', kcal: 100, proteinG: 120, fatG: 0, carbsG: 0 }).expect(400);
    await agent.post('/api/foods').send({ name: 'Bad', barcode: '123', kcal: 100, proteinG: 1, fatG: 0, carbsG: 0 }).expect(400);
  });
});
