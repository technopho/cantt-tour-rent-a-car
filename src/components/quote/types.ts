import type { CatalogRates, ServiceType, TripType } from "@/lib/catalog-types";

/** Slim model data passed from Astro pages into the TripComposer island (keep it small: it is serialised into HTML). */
export interface ComposerModel {
  slug: string;
  name: string; // "Toyota Corolla Altis"
  category: string; // category slug
  categoryName: string;
  seats: number;
  rates: CatalogRates;
  /**
   * Catalog suitableFor tags ("wedding", "outstation", "airport", ...). Optional for backward
   * compatibility; toComposerModels() fills it. Used to pick a sensible "from" estimate when the
   * visitor chooses "Any suitable car".
   */
  suitableFor?: string[];
}

export interface TripComposerProps {
  models: ComposerModel[];
  defaultModelSlug?: string;
  defaultServiceType?: ServiceType;
  defaultTripType?: TripType;
  /** Prefilled pickup area/location (e.g. on area pages). */
  defaultPickup?: string;
  /** Prefilled destination (e.g. on route pages). */
  defaultDestination?: string;
  /** Smaller layout for bands and sidebars. */
  compact?: boolean;
}

/** Which bracket of the sentence is open. */
export type TokenKey = "car" | "service" | "trip" | "destination" | "from" | "to" | "pickup";

/** Step 1: everything the sentence describes. */
export interface TripState {
  /** "" = any suitable car. */
  modelSlug: string;
  serviceType: ServiceType;
  tripType: TripType;
  /** Epoch ms (UTC), shown in Pakistan time. */
  pickupAt: number;
  returnAt: number;
  pickup: string;
  destination: string;
}

/** Step 2: contact details (strings straight from the inputs). */
export interface DetailsState {
  name: string;
  phone: string;
  email: string;
  passengers: string;
  message: string;
}

/** One option in a sentence listbox. */
export interface ListOption {
  value: string;
  label: string;
  /** Secondary line under the label. */
  hint?: string;
  /** Right-aligned detail (e.g. "from Rs 6,500/day"). */
  meta?: string;
  /** Group heading (options with the same group are rendered together, in order). */
  group?: string;
  disabled?: boolean;
}

/** One suggestion in a place picker. */
export interface PlaceSuggestion {
  label: string;
  hint?: string;
}
