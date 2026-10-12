/**
 * Catalog JSON contract (catalog/v1.json), exactly per ARCHITECTURE.md section 6.
 * Types only (zero runtime), so Svelte islands and src/lib/estimate.ts can import them freely.
 * Runtime validation lives in src/lib/catalog.ts.
 */

export type Transmission = "automatic" | "manual";
export type Fuel = "petrol" | "hybrid" | "diesel" | "electric";
/** Known values: "wedding" | "outstation" | "airport" | "corporate" | "monthly" | "self_drive" | "family". */
export type SuitableFor = string;

export interface CatalogCategory {
  slug: string; // sedan, suv, hatchback, luxury, van, coaster, wedding ...
  name: string;
  description: string;
}

export interface CatalogImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Pre-generated widths from R2, e.g. "https://media/.../x-480.webp 480w, ...960w, ...1600w". */
  srcset: string;
}

export interface WithDriverRates {
  daily: number;
  outstationDaily: number | null;
  monthly: number | null;
  overtimeHourly: number | null;
}

export interface SelfDriveRates {
  daily: number;
  weekly: number | null;
  monthly: number | null;
  securityDeposit: number | null;
  kmPerDay: number | null;
}

export interface CatalogRates {
  withDriver: WithDriverRates | null;
  selfDrive: SelfDriveRates | null;
  driverNightAllowance: number | null;
  /** Lowest daily price shown as "from Rs X/day". */
  fromPrice: number;
}

export interface CatalogModel {
  slug: string; // "toyota-corolla" -> /cars/toyota-corolla/
  make: string;
  model: string;
  variant: string | null;
  category: string; // categories[].slug
  yearFrom: number | null;
  yearTo: number | null;
  seats: number;
  luggage: number | null;
  transmission: Transmission;
  fuel: Fuel;
  engineCc: number | null;
  features: string[];
  suitableFor: SuitableFor[];
  shortDescription: string; // <= 160 chars
  description: string; // markdown, written by staff
  images: CatalogImage[]; // first = cover
  rates: CatalogRates;
  units: number;
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface Catalog {
  version: 1;
  generatedAt: string; // ISO
  currency: "PKR";
  categories: CatalogCategory[];
  models: CatalogModel[];
  /** Only present in src/data/catalog.sample.json. Pages may show a discreet "sample fleet" note. */
  sample?: boolean;
}

export type ServiceType = "with_driver" | "self_drive";
export type TripType = "within_city" | "outstation" | "airport" | "wedding" | "monthly" | "corporate";
