import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import Stripe from 'stripe';
import { Database, InjectDb } from '../db/db.module';
import { entitlements, PaidModule, users } from '../db/schema';

export type PlanId = 'barcode' | 'all';
export type Interval = 'month' | 'year';

/** Sellable plans and the module each one unlocks. Prices live in Stripe. */
export const PLANS: Record<PlanId, { module: PaidModule; intervals: Interval[] }> = {
  barcode: { module: 'barcode', intervals: ['month', 'year'] },
  all: { module: 'all', intervals: ['month', 'year'] },
};

/**
 * Stripe Checkout + Billing Portal + webhooks. Entirely optional: without
 * STRIPE_SECRET_KEY the app runs and paid access comes only from grants.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and one price id per plan and
 * interval, e.g. STRIPE_PRICE_BARCODE_MONTH, STRIPE_PRICE_ALL_YEAR.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  readonly client: Stripe | null;
  private readonly prices = new Map<string, { plan: PlanId; interval: Interval }>();

  constructor(
    private readonly config: ConfigService,
    @InjectDb() private readonly db: Database,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.client = key ? new Stripe(key) : null;
    for (const plan of Object.keys(PLANS) as PlanId[]) {
      for (const interval of PLANS[plan].intervals) {
        const price = this.priceId(plan, interval);
        if (price) this.prices.set(price, { plan, interval });
      }
    }
  }

  get enabled() {
    return !!this.client;
  }

  priceId(plan: PlanId, interval: Interval): string | undefined {
    return this.config.get<string>(`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`) || undefined;
  }

  /** Which plans can be bought right now (configured price ids). */
  availablePlans() {
    return (Object.keys(PLANS) as PlanId[]).map((plan) => ({
      plan,
      module: PLANS[plan].module,
      intervals: PLANS[plan].intervals.filter((i) => this.enabled && !!this.priceId(plan, i)),
    }));
  }

  private requireClient(): Stripe {
    if (!this.client) throw new ServiceUnavailableException('Payments are not configured');
    return this.client;
  }

  private async customerFor(userId: string): Promise<string> {
    const stripe = this.requireClient();
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId } });
    await this.db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
    return customer.id;
  }

  async checkout(userId: string, plan: PlanId, interval: Interval, returnUrl: string): Promise<string> {
    const stripe = this.requireClient();
    const price = this.priceId(plan, interval);
    if (!price) throw new BadRequestException('This plan is not available');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: await this.customerFor(userId),
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
      automatic_tax: { enabled: this.config.get('STRIPE_AUTOMATIC_TAX') === 'true' },
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancel`,
    });
    if (!session.url) throw new ServiceUnavailableException('Stripe did not return a checkout URL');
    return session.url;
  }

  async portal(userId: string, returnUrl: string): Promise<string> {
    const stripe = this.requireClient();
    const session = await stripe.billingPortal.sessions.create({ customer: await this.customerFor(userId), return_url: returnUrl });
    return session.url;
  }

  /** Verifies the signature; throws on tampering. */
  parseEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const stripe = this.requireClient();
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret || !signature) throw new BadRequestException('Missing webhook signature');
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          await this.syncSubscription(await this.requireClient().subscriptions.retrieve(session.subscription));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  }

  /** Mirrors one Stripe subscription into entitlement rows (idempotent). */
  async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
    const userId = user?.id ?? sub.metadata?.userId;
    if (!userId) {
      this.logger.warn(`Subscription ${sub.id}: no matching user`);
      return;
    }
    const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled';

    const modules: PaidModule[] = [];
    for (const item of sub.items.data) {
      const known = this.prices.get(item.price.id);
      if (!known) continue;
      modules.push(PLANS[known.plan].module);
      const periodEnd = (item as unknown as { current_period_end?: number }).current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
      await this.db
        .insert(entitlements)
        .values({
          userId,
          module: PLANS[known.plan].module,
          source: 'stripe',
          status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        })
        .onConflictDoUpdate({
          target: [entitlements.stripeSubscriptionId, entitlements.module],
          targetWhere: isNotNull(entitlements.stripeSubscriptionId),
          set: { status, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null },
        });
    }
    // Items removed from the subscription lose access.
    const stale = await this.db
      .select({ id: entitlements.id, module: entitlements.module })
      .from(entitlements)
      .where(eq(entitlements.stripeSubscriptionId, sub.id));
    const removed = stale.filter((r) => !modules.includes(r.module)).map((r) => r.id);
    if (removed.length) await this.db.update(entitlements).set({ status: 'canceled' }).where(and(inArray(entitlements.id, removed)));
  }
}
