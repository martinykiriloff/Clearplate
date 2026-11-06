import { isValidBarcode, normalizePage } from './import-off';

const product = (code: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  code,
  product_name: 'Кисело мляко',
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 3.8, fat_100g: 3.6, carbohydrates_100g: 4.2 },
  ...extra,
});

describe('import-off', () => {
  it('accepts 8, 12, 13 and 14 digit barcodes only', () => {
    expect(['12345678', '123456789012', '3800000000017', '12345678901234'].every(isValidBarcode)).toBe(true);
    expect([undefined, '1234567', '123456789', 'abc12345678', 12345678].some(isValidBarcode)).toBe(false);
  });

  it('keeps complete products and drops bad barcodes and missing macros', () => {
    const rows = normalizePage([
      product('3800000000017'),
      product('bad'),
      product('3800000000024', { nutriments: { 'energy-kcal_100g': 50 } }),
    ]);
    expect(rows.map((r) => r.barcode)).toEqual(['3800000000017']);
  });
});
