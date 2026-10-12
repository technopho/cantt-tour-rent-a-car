/**
 * Catalog price helpers for the local SEO pages (build time only).
 * Every amount comes from the catalog (control panel). Nothing here hard-codes a price.
 */
import { getModels, getModelsSuitableFor, resolveModels, type CatalogModel } from "@/lib/catalog";

/** Per-day outstation price with a driver: outstationDaily, else the city daily rate. */
export function outstationDaily(model: CatalogModel): number | null {
  const r = model.rates.withDriver;
  if (!r) return null;
  return r.outstationDaily ?? r.daily;
}

/** Cheapest outstation day price across models, with the model it belongs to. */
export function cheapestOutstation(models: readonly CatalogModel[]): { price: number; model: CatalogModel } | null {
  let best: { price: number; model: CatalogModel } | null = null;
  for (const m of models) {
    const p = outstationDaily(m);
    if (p !== null && (best === null || p < best.price)) best = { price: p, model: m };
  }
  return best;
}

/** Lowest driver night allowance across models (PKR per night) or null. */
export function lowestNightAllowance(models: readonly CatalogModel[]): number | null {
  const values = models.map((m) => m.rates.driverNightAllowance).filter((v): v is number => typeof v === "number" && v > 0);
  return values.length ? Math.min(...values) : null;
}

/**
 * Resolve content model slugs; if none resolve (a real catalog without those models),
 * fall back to catalog models tagged with `fallbackTag`, then to the first models.
 */
export async function modelsOrFallback(slugs: readonly string[], fallbackTag: string, limit = 4): Promise<CatalogModel[]> {
  const resolved = await resolveModels(slugs);
  if (resolved.length > 0) return resolved.slice(0, limit);
  const tagged = await getModelsSuitableFor(fallbackTag);
  if (tagged.length > 0) return tagged.slice(0, limit);
  return (await getModels()).slice(0, limit);
}

/** Models that can do an outstation trip with a driver (have withDriver rates). */
export function withDriverOnly(models: readonly CatalogModel[]): CatalogModel[] {
  return models.filter((m) => m.rates.withDriver !== null);
}
