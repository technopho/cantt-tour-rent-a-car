/**
 * Fleet catalog loader (build time).
 *
 * Source order:
 *  1. CATALOG_URL (import.meta.env or process.env): the JSON the control panel publishes to R2.
 *  2. src/data/catalog.sample.json (sample fleet with placeholder prices).
 *
 * Set CATALOG_REQUIRED=true in production builds to fail the build instead of falling back.
 * The result is validated with zod and memoised for the whole build:
 *  - an invalid envelope, an unreachable URL or zero valid models -> sample fallback (or build error when required)
 *  - an individual invalid model -> skipped with a warning (or build error when required)
 *  - em/en dashes in staff-written text are replaced (copy rule), see stripDashes()
 *
 * Usage in .astro frontmatter:
 *   import { getModels, getModel, getFeaturedModels, cheapestFrom } from "@/lib/catalog";
 *   const models = await getModels();
 *
 * Do not import this module from Svelte islands: pass the data you need as props instead, and use
 * "@/lib/estimate" + "@/lib/catalog-types" on the client.
 * No Node-only APIs here, so it also works in the workerd runtime (on-demand routes) if needed.
 */
import { z } from "astro/zod";
import sampleCatalog from "@/data/catalog.sample.json";
import type { Catalog, CatalogCategory, CatalogModel } from "./catalog-types";

export type * from "./catalog-types";
export { estimateQuote, rentalDays, dailyRateFor, ESTIMATE_DISCLAIMER } from "./estimate";
export type { EstimateInput, EstimateLine, QuoteEstimate, EstimatableModel } from "./estimate";

/* ------------------------------------------------------------------------------------------ */
/* Schema (mirrors ARCHITECTURE.md section 6)                                                   */
/* ------------------------------------------------------------------------------------------ */

/** Integer PKR rupees. Shown prices must be > 0 ("from Rs 0/day" would be a bug). */
const money = z.number().int().positive();
const nullableMoney = money.nullable();

const imageSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  srcset: z.string(),
});

const modelSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  make: z.string().min(1),
  model: z.string().min(1),
  variant: z.string().nullable(),
  category: z.string().min(1),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  seats: z.number().int().positive(),
  luggage: z.number().int().nonnegative().nullable(),
  transmission: z.enum(["automatic", "manual"]),
  fuel: z.enum(["petrol", "hybrid", "diesel", "electric"]),
  engineCc: z.number().int().positive().nullable(),
  features: z.array(z.string()),
  suitableFor: z.array(z.string()),
  shortDescription: z.string(),
  description: z.string(),
  images: z.array(imageSchema),
  rates: z
    .object({
      withDriver: z
        .object({
          daily: money,
          outstationDaily: nullableMoney,
          monthly: nullableMoney,
          overtimeHourly: nullableMoney,
        })
        .nullable(),
      selfDrive: z
        .object({
          daily: money,
          weekly: nullableMoney,
          monthly: nullableMoney,
          securityDeposit: nullableMoney,
          kmPerDay: z.number().int().positive().nullable(),
        })
        .nullable(),
      driverNightAllowance: nullableMoney,
      fromPrice: money,
    })
    .refine((r) => r.withDriver !== null || r.selfDrive !== null, "a model needs withDriver or selfDrive rates"),
  units: z.number().int().nonnegative(),
  featured: z.boolean(),
  sortOrder: z.number(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  updatedAt: z.string(),
});

const catalogSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  currency: z.literal("PKR"),
  categories: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      description: z.string(),
    }),
  ),
  models: z.array(modelSchema),
  sample: z.boolean().optional(),
});

/** Catalog envelope: models are validated one by one (see parseCatalog) so one bad row cannot sink the whole fleet. */
const envelopeSchema = catalogSchema.extend({ models: z.array(z.unknown()) });

// Compile-time guard: the schema output must stay assignable to the hand-written contract types.
type _SchemaMatchesContract = z.infer<typeof catalogSchema> extends Catalog ? true : never;
const _schemaCheck: _SchemaMatchesContract = true;
void _schemaCheck;

/* ------------------------------------------------------------------------------------------ */
/* Copy rule: no em/en dashes in visible text (DESIGN.md). Staff-written catalog text is       */
/* cleaned here so every page, JSON-LD block and llms.txt line inherits the rule.               */
/* ------------------------------------------------------------------------------------------ */

/** Keys whose string values are identifiers or URLs, never visible copy. */
const NON_COPY_KEYS = new Set(["slug", "category", "src", "srcset", "updatedAt", "generatedAt", "currency"]);

/** "2021–2025" -> "2021-2025"; "Spacious — ideal for families" -> "Spacious, ideal for families". */
export function stripDashes(text: string): string {
  return text.replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2").replace(/\s*[–—]\s*/g, ", ");
}

function stripDashesDeep<T>(value: T, key = ""): T {
  if (typeof value === "string") return (NON_COPY_KEYS.has(key) ? value : stripDashes(value)) as T;
  if (Array.isArray(value)) return value.map((v) => stripDashesDeep(v, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripDashesDeep(v, k)])) as T;
  }
  return value;
}

/* ------------------------------------------------------------------------------------------ */
/* Loading                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type CatalogSource = "remote" | "sample";

export interface CatalogMeta {
  source: CatalogSource;
  url: string | null;
  sample: boolean;
  generatedAt: string;
  modelCount: number;
}

interface LoadedCatalog {
  catalog: Catalog;
  meta: CatalogMeta;
}

function env(name: "CATALOG_URL" | "CATALOG_REQUIRED" | "CATALOG_TIMEOUT_MS"): string | undefined {
  // Static references so Vite can inline build-time values; process.env as fallback.
  const fromImportMeta =
    name === "CATALOG_URL"
      ? import.meta.env.CATALOG_URL
      : name === "CATALOG_REQUIRED"
        ? import.meta.env.CATALOG_REQUIRED
        : import.meta.env.CATALOG_TIMEOUT_MS;
  const value = (fromImportMeta as string | undefined) || globalThis.process?.env?.[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function normalise(raw: Catalog): Catalog {
  const seen = new Set<string>();
  const categorySlugs = new Set(raw.categories.map((c) => c.slug));
  const models: CatalogModel[] = [];
  for (const m of raw.models) {
    if (seen.has(m.slug)) {
      console.warn(`[catalog] Duplicate model slug "${m.slug}" ignored.`);
      continue;
    }
    seen.add(m.slug);
    if (!categorySlugs.has(m.category)) {
      console.warn(`[catalog] Model "${m.slug}" uses unknown category "${m.category}".`);
    }
    const r = m.rates;
    const lowestDaily = Math.min(...[r.withDriver?.daily, r.selfDrive?.daily].filter((p): p is number => typeof p === "number"));
    if (r.fromPrice > lowestDaily) {
      console.warn(`[catalog] Model "${m.slug}": fromPrice ${r.fromPrice} is higher than its lowest daily rate ${lowestDaily}.`);
    }
    models.push(m);
  }
  models.sort((a, b) => a.sortOrder - b.sortOrder || `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  return { ...raw, models };
}

function formatIssues(issues: { path: PropertyKey[]; message: string }[], prefix = ""): string {
  return issues
    .slice(0, 8)
    .map((i) => `  - ${[prefix, ...i.path.map(String)].filter(Boolean).join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Validate a catalog. The envelope (version, currency, categories) must be valid. Models are
 * checked one by one: with `strict` any invalid model fails the whole catalog, otherwise invalid
 * models are skipped with a warning. A catalog without a single valid model is rejected.
 */
function parseCatalog(data: unknown, label: string, strict: boolean): Catalog {
  const envelope = envelopeSchema.safeParse(data);
  if (!envelope.success) {
    throw new Error(`[catalog] ${label} failed validation:\n${formatIssues(envelope.error.issues)}`);
  }

  const models: CatalogModel[] = [];
  const rejected: string[] = [];
  envelope.data.models.forEach((raw, index) => {
    const parsed = modelSchema.safeParse(raw);
    if (parsed.success) {
      models.push(parsed.data as CatalogModel);
      return;
    }
    const slug = typeof (raw as { slug?: unknown })?.slug === "string" ? (raw as { slug: string }).slug : `#${index}`;
    rejected.push(`model "${slug}":\n${formatIssues(parsed.error.issues, `models.${index}`)}`);
  });

  if (rejected.length > 0) {
    const report = `[catalog] ${label}: ${rejected.length} invalid model(s)\n${rejected.join("\n")}`;
    if (strict) throw new Error(report);
    console.warn(`${report}\n[catalog] Invalid models were skipped.`);
  }
  if (models.length === 0) throw new Error(`[catalog] ${label} has no valid models.`);

  return normalise(stripDashesDeep({ ...(envelope.data as Omit<Catalog, "models">), models }));
}

async function fetchRemote(url: string, timeoutMs: number): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt === 1) await new Promise((r) => setTimeout(r, 750));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function load(): Promise<LoadedCatalog> {
  const url = env("CATALOG_URL");
  const required = /^(1|true|yes)$/i.test(env("CATALOG_REQUIRED") ?? "");
  const timeoutMs = Number(env("CATALOG_TIMEOUT_MS") ?? 10_000) || 10_000;

  if (url) {
    try {
      const catalog = parseCatalog(await fetchRemote(url, timeoutMs), `Remote catalog (${url})`, required);
      console.info(`[catalog] Using remote catalog ${url} (${catalog.models.length} models, generated ${catalog.generatedAt}).`);
      return {
        catalog,
        meta: { source: "remote", url, sample: Boolean(catalog.sample), generatedAt: catalog.generatedAt, modelCount: catalog.models.length },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (required) throw new Error(`[catalog] CATALOG_REQUIRED is set and the remote catalog could not be loaded: ${message}`);
      console.warn(`[catalog] Remote catalog unavailable (${message}). Falling back to the SAMPLE fleet.`);
    }
  } else if (required) {
    throw new Error("[catalog] CATALOG_REQUIRED is set but CATALOG_URL is empty.");
  }

  const catalog = parseCatalog(sampleCatalog, "src/data/catalog.sample.json", true);
  console.info(
    `[catalog] Using SAMPLE catalog src/data/catalog.sample.json (${catalog.models.length} models)${url ? "" : ": CATALOG_URL is not set"}.`,
  );
  return {
    catalog,
    meta: { source: "sample", url: null, sample: catalog.sample !== false, generatedAt: catalog.generatedAt, modelCount: catalog.models.length },
  };
}

let loading: Promise<LoadedCatalog> | null = null;

function loadOnce(): Promise<LoadedCatalog> {
  loading ??= load();
  return loading;
}

/** The validated catalog (memoised for the build). */
export async function loadCatalog(): Promise<Catalog> {
  return (await loadOnce()).catalog;
}

/** Where the catalog came from (for the "sample fleet" note and build logs). */
export async function getCatalogMeta(): Promise<CatalogMeta> {
  return (await loadOnce()).meta;
}

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** All models, sorted by sortOrder then name. */
export async function getModels(): Promise<CatalogModel[]> {
  return (await loadCatalog()).models;
}

export async function getModel(slug: string): Promise<CatalogModel | undefined> {
  return (await getModels()).find((m) => m.slug === slug);
}

/** Categories in catalog order. By default only categories that have at least one model. */
export async function getCategories(options: { includeEmpty?: boolean } = {}): Promise<CatalogCategory[]> {
  const catalog = await loadCatalog();
  if (options.includeEmpty) return catalog.categories;
  const used = new Set(catalog.models.map((m) => m.category));
  return catalog.categories.filter((c) => used.has(c.slug));
}

export async function getCategory(slug: string): Promise<CatalogCategory | undefined> {
  return (await loadCatalog()).categories.find((c) => c.slug === slug);
}

export async function getModelsByCategory(categorySlug: string): Promise<CatalogModel[]> {
  return (await getModels()).filter((m) => m.category === categorySlug);
}

/** Featured models (sorted). Falls back to the first models if none are flagged. */
export async function getFeaturedModels(limit?: number): Promise<CatalogModel[]> {
  const models = await getModels();
  const featured = models.filter((m) => m.featured);
  const list = featured.length > 0 ? featured : models;
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

/** Models tagged with a suitableFor value ("wedding", "outstation", "self_drive", ...). */
export async function getModelsSuitableFor(tag: string): Promise<CatalogModel[]> {
  return (await getModels()).filter((m) => m.suitableFor.includes(tag));
}

/** Resolve content-collection model slugs (recommendedModels, popularModels) in order; warns on unknown slugs. */
export async function resolveModels(slugs: readonly string[]): Promise<CatalogModel[]> {
  const models = await getModels();
  const out: CatalogModel[] = [];
  for (const slug of slugs) {
    const found = models.find((m) => m.slug === slug);
    if (found) out.push(found);
    else console.warn(`[catalog] Unknown model slug "${slug}" referenced in content (skipped).`);
  }
  return out;
}

/** Lowest "from" price across the given models (PKR), or null for an empty list. */
export function cheapestFrom(models: readonly CatalogModel[]): number | null {
  if (models.length === 0) return null;
  return models.reduce((min, m) => Math.min(min, m.rates.fromPrice), Number.POSITIVE_INFINITY);
}

/** Min and max "from" prices across the whole fleet (for priceRange in JSON-LD). */
export async function getPriceRange(): Promise<{ min: number; max: number } | null> {
  const models = await getModels();
  if (models.length === 0) return null;
  const prices = models.map((m) => m.rates.fromPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** "Toyota Corolla Altis" */
export function modelName(model: Pick<CatalogModel, "make" | "model">): string {
  return `${model.make} ${model.model}`;
}

/** "Toyota Corolla Altis 1.6" (adds the variant when present). */
export function modelFullName(model: Pick<CatalogModel, "make" | "model" | "variant">): string {
  return model.variant ? `${model.make} ${model.model} ${model.variant}` : modelName(model);
}

/** "2021 to 2025", "2022 onwards", or null. No dashes (copy rule). */
export function modelYears(model: Pick<CatalogModel, "yearFrom" | "yearTo">): string | null {
  const { yearFrom, yearTo } = model;
  if (yearFrom && yearTo) return yearFrom === yearTo ? String(yearFrom) : `${yearFrom} to ${yearTo}`;
  if (yearFrom) return `${yearFrom} onwards`;
  if (yearTo) return `up to ${yearTo}`;
  return null;
}

const TRANSMISSION_LABEL = { automatic: "Automatic", manual: "Manual" } as const;
const FUEL_LABEL = { petrol: "Petrol", hybrid: "Hybrid", diesel: "Diesel", electric: "Electric" } as const;

export function transmissionLabel(t: CatalogModel["transmission"]): string {
  return TRANSMISSION_LABEL[t];
}
export function fuelLabel(f: CatalogModel["fuel"]): string {
  return FUEL_LABEL[f];
}
