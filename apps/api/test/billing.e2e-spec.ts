import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import request from 'supertest';
import { DB, Database } from '../src/db/db.module';
import { users } from '../src/db/schema';
import { createApp, signedInAgent } from './app';

describe('billing & entitlements', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  it('free users have no paid modules and a limited daily scan allowance', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.get('/api/billing').expect(200);
    expect(res.body.modules).toEqual({ barcode: false, insights: false, recipes: false, data: false });
    expect(res.body.payments).toBe(true);
    expect(res.body.plans).toEqual(
      expect.arrayContaining([
        { plan: 'barcode', module: 'barcode', intervals: ['month'] },
        { plan: 'all', module: 'all', intervals: ['year'] },
      ]),
    );
    const quota = await agent.get('/api/foods/scan/quota').expect(200);
    expect(quota.body).toMatchObject({ limit: 5, used: 0, remaining: 5 });
  });

  it('applies ENTITLEMENT_GRANTS at sign-up ("all" unlocks every module)', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/register').send({ email: 'Paid@Example.com', password: 'correct-horse-battery' }).expect(201);
    const res = await agent.get('/api/billing').expect(200);
    expect(res.body.modules).toEqual({ barcode: true, insights: true, recipes: true, data: true });
    expect(res.body.entitlements[0]).toMatchObject({ module: 'all', source: 'grant', status: 'active' });
  });

  it('rejects webhooks with a bad signature', async () => {
    await request(app.getHttpServer()).post('/api/billing/webhook').set('stripe-signature', 't=1,v1=bad').send({}).expect(400);
  });

  it('turns a signed subscription webhook into access, and cancellation removes it', async () => {
    const { agent, email } = await signedInAgent(app);
    const db = app.get<Database>(DB);
    await db.update(users).set({ stripeCustomerId: 'cus_test_1' }).where(eq(users.email, email));

    const stripe = new Stripe('sk_test_dummy_for_signature_checks_only');
    const send = async (status: string) => {
      const payload = JSON.stringify({
        id: 'evt_1',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            object: 'subscription',
            customer: 'cus_test_1',
            status,
            metadata: {},
            items: { data: [{ id: 'si_1', price: { id: 'price_barcode_month' }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
          },
        },
      });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
      await request(app.getHttpServer()).post('/api/billing/webhook').set('stripe-signature', header).set('content-type', 'application/json').send(payload).expect(200);
    };

    await send('active');
    expect((await agent.get('/api/billing')).body.modules.barcode).toBe(true);
    await send('canceled');
    expect((await agent.get('/api/billing')).body.modules.barcode).toBe(false);
  });
});
