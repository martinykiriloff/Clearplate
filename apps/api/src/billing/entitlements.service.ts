import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Database, InjectDb } from '../db/db.module';
import { entitlements, PaidModule, users } from '../db/schema';

export const PAID_MODULES: Exclude<PaidModule, 'all'>[] = ['barcode', 'insights', 'recipes', 'data'];

/**
 * Parses ENTITLEMENT_GRANTS: "a@x.com:all;b@y.com:barcode,insights".
 * Used for access paid outside the app (invoices, early supporters, staff).
 */
export function parseGrants(raw: string | undefined): Map<string, PaidModule[]> {
  const map = new Map<string, PaidModule[]>();
  for (const part of (raw ?? '').split(';')) {
    const [email, modules] = part.split(':').map((s) => s?.trim());
    if (!email || !modules) continue;
    const valid = modules
      .split(',')
      .map((m) => m.trim())
      .filter((m): m is PaidModule => m === 'all' || (PAID_MODULES as string[]).includes(m));
    if (valid.length) map.set(email.toLowerCase(), valid);
  }
  return map;
}

@Injectable()
export class EntitlementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly grants: Map<string, PaidModule[]>;

  constructor(
    @InjectDb() private readonly db: Database,
    config: ConfigService,
  ) {
    this.grants = parseGrants(config.get<string>('ENTITLEMENT_GRANTS'));
  }

  /** Grants for users that already exist; new users get theirs at sign-up. */
  async onApplicationBootstrap() {
    if (!this.grants.size) return;
    const rows = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, [...this.grants.keys()]));
    for (const row of rows) await this.applyGrants(row.id, row.email);
    this.logger.log(`Applied entitlement grants for ${rows.length} user(s)`);
  }

  async applyGrants(userId: string, email: string): Promise<void> {
    const modules = this.grants.get(email.toLowerCase());
    if (!modules) return;
    for (const module of modules) {
      await this.db
        .insert(entitlements)
        .values({ userId, module, source: 'grant', status: 'active', note: 'ENTITLEMENT_GRANTS' })
        .onConflictDoUpdate({
          target: [entitlements.userId, entitlements.module],
          targetWhere: sql`${entitlements.source} = 'grant'`,
          set: { status: 'active', currentPeriodEnd: null },
        });
    }
  }

  /** Modules the user can use right now ('all' expands to every module). */
  async activeModules(userId: string): Promise<Set<Exclude<PaidModule, 'all'>>> {
    const rows = await this.db
      .select({ module: entitlements.module })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          // past_due keeps access while Stripe retries the payment
          inArray(entitlements.status, ['active', 'past_due']),
          sql`(${entitlements.currentPeriodEnd} is null or ${entitlements.currentPeriodEnd} > now())`,
        ),
      );
    const out = new Set<Exclude<PaidModule, 'all'>>();
    for (const { module } of rows) {
      if (module === 'all') PAID_MODULES.forEach((m) => out.add(m));
      else out.add(module);
    }
    return out;
  }

  async has(userId: string, module: Exclude<PaidModule, 'all'>): Promise<boolean> {
    return (await this.activeModules(userId)).has(module);
  }

  async list(userId: string) {
    return this.db
      .select({
        module: entitlements.module,
        source: entitlements.source,
        status: entitlements.status,
        currentPeriodEnd: entitlements.currentPeriodEnd,
      })
      .from(entitlements)
      .where(eq(entitlements.userId, userId));
  }
}
