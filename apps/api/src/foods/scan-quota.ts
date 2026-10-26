import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { EntitlementsService } from '../billing/entitlements.service';
import { Database, InjectDb } from '../db/db.module';
import { barcodeScans } from '../db/schema';

/** Distinct products a free account can scan with the camera per local day. */
export const FREE_SCANS_PER_DAY = 5;

export interface ScanQuota {
  /** Scans allowed per day; null when the Barcode module makes them unlimited. */
  limit: number | null;
  /** Distinct products scanned on `date`. */
  used: number;
  /** Scans left on `date`; null when unlimited. */
  remaining: number | null;
  /** The local date the numbers refer to. */
  date: string;
}

/**
 * Daily camera-scan allowance for accounts without the Barcode module.
 * Scans are counted per distinct barcode per local day, so pointing the camera
 * at the same product twice costs nothing. Only scans that found a food are
 * recorded: an unknown barcode never burns the allowance.
 */
@Injectable()
export class ScanQuotaService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async scannedToday(userId: string, date: string): Promise<string[]> {
    const rows = await this.db
      .select({ code: barcodeScans.code })
      .from(barcodeScans)
      .where(and(eq(barcodeScans.userId, userId), eq(barcodeScans.date, date)));
    return rows.map((r) => r.code);
  }

  async status(userId: string, date: string): Promise<ScanQuota> {
    if (await this.entitlements.has(userId, 'barcode')) return { limit: null, used: 0, remaining: null, date };
    const used = (await this.scannedToday(userId, date)).length;
    return { limit: FREE_SCANS_PER_DAY, used, remaining: Math.max(0, FREE_SCANS_PER_DAY - used), date };
  }

  /**
   * Throws 402 `scan_limit_reached` when a free account has used today's scans
   * and `code` is not one of them. Call before the (possibly external) lookup so
   * a blocked scan costs nothing.
   */
  async assertAllowed(userId: string, date: string, code: string): Promise<void> {
    if (await this.entitlements.has(userId, 'barcode')) return;
    const codes = await this.scannedToday(userId, date);
    if (codes.length < FREE_SCANS_PER_DAY || codes.includes(code)) return;
    throw new HttpException(
      {
        statusCode: 402,
        code: 'scan_limit_reached',
        module: 'barcode',
        limit: FREE_SCANS_PER_DAY,
        used: codes.length,
        date,
        message: `You have used today's ${FREE_SCANS_PER_DAY} free scans`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /** Records a successful scan; idempotent per user, day and code. */
  async record(userId: string, date: string, code: string): Promise<void> {
    await this.db.insert(barcodeScans).values({ userId, date, code }).onConflictDoNothing();
  }
}
