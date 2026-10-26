import { Injectable, Logger } from '@nestjs/common';

/** A product normalised to our per-100 g model. */
export interface ExternalFood {
  barcode: string;
  name: string;
  nameBg: string | null;
  brand: string | null;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
  servingG: number | null;
}

export const FOOD_PROVIDER = Symbol('FOOD_PROVIDER');

export interface FoodProvider {
  lookup(barcode: string): Promise<ExternalFood | null>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Open Food Facts (ODbL). Free, community-maintained, strong EU coverage incl.
 * Bulgaria. Data reuse requires attribution and share-alike of the database:
 * the UI credits OFF on every imported product.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
@Injectable()
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly logger = new Logger(OpenFoodFactsProvider.name);
  private readonly base = process.env.OPEN_FOOD_FACTS_URL ?? 'https://world.openfoodfacts.org';

  async lookup(barcode: string): Promise<ExternalFood | null> {
    const fields = 'code,product_name,product_name_en,product_name_bg,brands,nutriments,serving_quantity';
    try {
      const res = await fetch(`${this.base}/api/v2/product/${barcode}?fields=${fields}`, {
        headers: { 'User-Agent': 'Clearplate/0.1 (https://github.com/martinykiriloff/Clearplate)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      if (body.status !== 1 || !body.product) return null;
      return normalizeOff(barcode, body.product);
    } catch (e) {
      this.logger.warn(`Open Food Facts lookup failed for ${barcode}: ${(e as Error).message}`);
      return null;
    }
  }
}

/** Exported for tests. Returns null when energy or macros are missing. */
export function normalizeOff(barcode: string, p: Record<string, unknown>): ExternalFood | null {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? num(n['energy_100g'])! / 4.184 : null);
  const proteinG = num(n['proteins_100g']);
  const fatG = num(n['fat_100g']);
  const carbsG = num(n['carbohydrates_100g']);
  if (kcal == null || proteinG == null || fatG == null || carbsG == null) return null;

  const nameEn = (p.product_name_en as string) || (p.product_name as string) || '';
  const nameBg = (p.product_name_bg as string) || null;
  const name = nameEn.trim() || nameBg?.trim();
  if (!name) return null;
  const sodiumG = num(n['sodium_100g']) ?? (num(n['salt_100g']) != null ? num(n['salt_100g'])! / 2.5 : null);

  return {
    barcode,
    name,
    nameBg: nameBg?.trim() || null,
    brand: ((p.brands as string) || '').split(',')[0]?.trim() || null,
    kcal: Math.round(kcal * 10) / 10,
    proteinG,
    fatG,
    carbsG,
    fiberG: num(n['fiber_100g']),
    sugarG: num(n['sugars_100g']),
    satFatG: num(n['saturated-fat_100g']),
    sodiumMg: sodiumG != null ? Math.round(sodiumG * 1000) : null,
    servingG: num(p.serving_quantity),
  };
}
