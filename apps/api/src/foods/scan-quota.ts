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

/** A reserved lookup. `scanId` is set when this call consumed a new slot. */
export interface ScanCharge {
  date: string;
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
   * The day a lookup is charged to. The client's local date may run one day
   * ahead of or behind the server's, so it is accepted, but it may never move
   * backwards: once a user has been charged for a day, earlier days are closed.
   * A legitimate device only ever moves forward, while a client that juggles
   * yesterday, today and tomorrow to triple its allowance only ever burns the
   * latest one.
   */
  private async bucketFor(userId: string, today: string): Promise<string> {
    const [row] = await this.db
      .select({ latest: sql<string | null>`max(${barcodeScans.date})` })
      .from(barcodeScans)
      .where(and(eq(barcodeScans.userId, userId), gt(barcodeScans.date, today)));
    return row?.latest ?? today;
  }

  private async countFor(userId: string, date: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(barcodeScans)
      .where(and(eq(barcodeScans.userId, userId), eq(barcodeScans.date, date)));
    return row?.n ?? 0;
  }

  async status(userId: string, today: string): Promise<ScanQuota> {
    if (await this.entitlements.has(userId, 'barcode')) return { limit: null, used: 0, remaining: null, date: today };
    const date = await this.bucketFor(userId, today);
    const used = await this.countFor(userId, date);
    return { limit: FREE_SCANS_PER_DAY, used, remaining: Math.max(0, FREE_SCANS_PER_DAY - used), date };
  }

  /**
   * Reserves a slot for `code` before the lookup. Inserting first and counting
   * after makes concurrent requests safe: whichever insert pushes the day over
   * the limit is rolled back, so the user never ends up above it.
   * Throws 402 `scan_limit_reached` when the day is used up.
   */
  async charge(userId: string, today: string, code: string): Promise<ScanCharge> {
    if (await this.entitlements.has(userId, 'barcode')) return { date: today, scanId: null };
    const date = await this.bucketFor(userId, today);
    const [inserted] = await this.db.insert(barcodeScans).values({ userId, date, code }).onConflictDoNothing().returning({ id: barcodeScans.id });
    // Already looked up today: free.
    if (!inserted) return { date, scanId: null };
    const used = await this.countFor(userId, date);
    if (used <= FREE_SCANS_PER_DAY) return { date, scanId: inserted.id };
    await this.refund({ date, scanId: inserted.id });
    throw new HttpException(
      {
        statusCode: 402,
        code: 'scan_limit_reached',
        module: 'barcode',
        limit: FREE_SCANS_PER_DAY,
        used: FREE_SCANS_PER_DAY,
        date,
        message: `You have used today's ${FREE_SCANS_PER_DAY} free barcode lookups`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /** Gives a reserved slot back, e.g. when the barcode matched nothing. */
  async refund(charge: ScanCharge): Promise<void> {
    if (!charge.scanId) return;
    await this.db.delete(barcodeScans).where(eq(barcodeScans.id, charge.scanId));
  }
}
