import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { EntitlementsService } from '../billing/entitlements.service';
import { Database, InjectDb } from '../db/db.module';
import { barcodeScans } from '../db/schema';

/** Distinct products a free account can look up by barcode per local day. */
export const FREE_SCANS_PER_DAY = 5;

export interface ScanQuota {
  /** Lookups allowed per day; null when the Barcode module makes them unlimited. */
  limit: number | null;
  /** Distinct products looked up on `date`. */
  used: number;
  /** Lookups left on `date`; null when unlimited. */
  remaining: number | null;
  /** The local date the numbers refer to. */
  date: string;
}

/** A reserved lookup. `scanId` is null when no new slot was consumed (unlimited account or repeat product). */
export interface ScanCharge {
  userId: string;
  scanId: string | null;
}

/**
 * Daily barcode-lookup allowance for accounts without the Barcode module.
 * Lookups (camera or typed) are counted per distinct barcode per local day, so
 * the same product twice costs nothing. A slot is reserved before the lookup
 * and refunded when no food was found, so an unknown barcode never counts.
 */
@Injectable()
export class ScanQuotaService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * The day to charge for a free account, or null when the account is unlimited.
   * The client's local date may be a day ahead of or behind the server's, so it
   * is accepted, but it never moves backwards: once a later day has been charged
   * it stays the bucket. That stops a client from replaying yesterday after
   * tomorrow; spending the window in ascending order can still yield one extra
   * allowance on the first day, which is an accepted trade-off against a rolling
   * window that would break "resets at your midnight".
   */
  private async freeBucket(userId: string, today: string): Promise<string | null> {
    const [unlimited, [row]] = await Promise.all([
      this.entitlements.has(userId, 'barcode'),
      this.db
        .select({ latest: sql<string | null>`max(${barcodeScans.date})` })
        .from(barcodeScans)
        .where(and(eq(barcodeScans.userId, userId), gt(barcodeScans.date, today))),
    ]);
    return unlimited ? null : (row?.latest ?? today);
  }

  /** Distinct lookups on `date`, and whether `code` is one of them. Runs on the database or inside a transaction. */
  private async usage(executor: Pick<Database, 'select'>, userId: string, date: string, code: string | null): Promise<{ used: number; hasCode: boolean }> {
    const [row] = await executor
      .select({ used: sql<number>`count(*)::int`, hasCode: sql<boolean>`coalesce(bool_or(${barcodeScans.code} = ${code}), false)` })
      .from(barcodeScans)
      .where(and(eq(barcodeScans.userId, userId), eq(barcodeScans.date, date)));
    return { used: row?.used ?? 0, hasCode: row?.hasCode ?? false };
  }

  async status(userId: string, today: string): Promise<ScanQuota> {
    const date = await this.freeBucket(userId, today);
    if (date === null) return { limit: null, used: 0, remaining: null, date: today };
    const { used } = await this.usage(this.db, userId, date, null);
    return { limit: FREE_SCANS_PER_DAY, used, remaining: Math.max(0, FREE_SCANS_PER_DAY - used), date };
  }

  /**
   * Reserves a slot for `code` before the lookup. The check and the insert run
   * under a per-user advisory lock, so concurrent requests are serialised: with
   * one slot left exactly one wins and the rest get the 402. A blocked request
   * writes nothing. Throws 402 `scan_limit_reached` when the day is used up.
   */
  async charge(userId: string, today: string, code: string): Promise<ScanCharge> {
    const date = await this.freeBucket(userId, today);
    if (date === null) return { userId, scanId: null };
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`barcode-scan:${userId}`}))`);
      const { used, hasCode } = await this.usage(tx, userId, date, code);
      if (hasCode) return { userId, scanId: null };
      if (used >= FREE_SCANS_PER_DAY) {
        throw new HttpException(
          { statusCode: HttpStatus.PAYMENT_REQUIRED, code: 'scan_limit_reached', module: 'barcode', limit: FREE_SCANS_PER_DAY, used, date, message: `You have used today's ${FREE_SCANS_PER_DAY} free barcode lookups` },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const [inserted] = await tx.insert(barcodeScans).values({ userId, date, code }).returning({ id: barcodeScans.id });
      return { userId, scanId: inserted.id };
    });
  }

  /** Gives a reserved slot back, e.g. when the barcode matched nothing. */
  async refund(charge: ScanCharge): Promise<void> {
    if (!charge.scanId) return;
    await this.db.delete(barcodeScans).where(and(eq(barcodeScans.userId, charge.userId), eq(barcodeScans.id, charge.scanId)));
  }
}
