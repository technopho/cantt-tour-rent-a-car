// Build-time helper: turns catalog models into the slim list the TripComposer island needs.
//
//   ---
//   import TripComposer from "@/components/quote/TripComposer.svelte";
//   import { getCategories, getModels } from "@/lib/catalog";
//   import { toComposerModels } from "@/lib/composer";
//   const composerModels = toComposerModels(await getModels(), await getCategories());
//   ---
//   <TripComposer client:visible models={composerModels} defaultModelSlug="toyota-corolla" />
//
// Only what the island needs is kept (it is serialised into the page HTML): no descriptions,
// images or features. Staff-written names are already dash-free (catalog.ts strips them).
import type { CatalogModel, CatalogCategory } from "./catalog-types";
import type { ComposerModel } from "@/components/quote/types";

export function toComposerModels(models: CatalogModel[], categories: CatalogCategory[]): ComposerModel[] {
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  return models.map((m) => ({
    slug: m.slug,
    name: [m.make, m.model, m.variant].filter(Boolean).join(" "),
    category: m.category,
    categoryName: catName.get(m.category) ?? m.category,
    seats: m.seats,
    rates: m.rates,
    suitableFor: m.suitableFor,
  }));
}
