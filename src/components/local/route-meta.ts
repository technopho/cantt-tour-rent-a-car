/**
 * Extra per-route data that the routes content schema does not carry (build time only).
 * Slugs match site.routes and src/content/routes/*.md. No prices here: prices come from the catalog.
 */
import type { TripType } from "@/lib/catalog-types";

export type RouteRegion = "north" | "punjab";

export interface RouteMeta {
  slug: string;
  /** Short station code for the trip ticket (a label, not an airport claim). */
  code: string;
  /** Short destination label for maps and lists. */
  short: string;
  /** Typical trip length in 24-hour days, used for the worked price example. */
  typicalDays: number;
  /** Quote composer trip type. Wagah is a Lahore city trip, everything else is outstation. */
  tripType: TripType;
  region: RouteRegion;
  /** Season in a few words for the hub list. */
  season: string;
  /** Extra note next to the drive time (long northern drives are split over days). */
  timeNote?: string;
  /**
   * Clean place names for the TouristTrip itinerary JSON-LD, from Lahore (excluded) to the
   * destination (last item). The content `stops` are written for people ("Babusar Top, June to
   * October") and stay on the page; these are the machine-readable Place names.
   */
  places: string[];
  /** Hero intro override, for routes where the generated "about X km via Y" line would mislead. */
  intro?: string;
  /** Intro for the "Which car" section, when the generic motorway/mountain line does not fit. */
  carsIntro?: string;
}

export const ROUTE_META: RouteMeta[] = [
  {
    slug: "lahore-to-islamabad",
    code: "ISB",
    short: "Islamabad",
    typicalDays: 2,
    tripType: "outstation",
    region: "punjab",
    season: "All year",
    places: ["Sheikhupura", "Bhera", "Kallar Kahar", "Islamabad"],
  },
  {
    slug: "lahore-to-murree",
    code: "MRE",
    short: "Murree",
    typicalDays: 3,
    tripType: "outstation",
    region: "north",
    season: "All year, snow in winter",
    places: ["Bhera", "Kallar Kahar", "Islamabad", "Murree"],
  },
  {
    slug: "lahore-to-naran-kaghan",
    code: "NRN",
    short: "Naran",
    typicalDays: 5,
    tripType: "outstation",
    region: "north",
    season: "May to October",
    timeNote: "one long day",
    places: ["Islamabad", "Mansehra", "Balakot", "Kaghan", "Naran"],
  },
  {
    slug: "lahore-to-hunza",
    code: "HZA",
    short: "Hunza",
    typicalDays: 8,
    tripType: "outstation",
    region: "north",
    season: "April to October",
    timeNote: "over two days",
    places: ["Islamabad", "Mansehra", "Chilas", "Gilgit", "Karimabad, Hunza"],
  },
  {
    slug: "lahore-to-skardu",
    code: "KDU",
    short: "Skardu",
    typicalDays: 8,
    tripType: "outstation",
    region: "north",
    season: "May to October",
    timeNote: "over two days",
    places: ["Islamabad", "Mansehra", "Chilas", "Jaglot", "Skardu"],
  },
  {
    slug: "lahore-to-swat",
    code: "SWT",
    short: "Swat",
    typicalDays: 4,
    tripType: "outstation",
    region: "north",
    season: "All year, Kalam in summer",
    places: ["Chakdara", "Mingora, Swat"],
  },
  {
    slug: "lahore-to-sialkot",
    code: "SKT",
    short: "Sialkot",
    typicalDays: 1,
    tripType: "outstation",
    region: "punjab",
    season: "All year",
    places: ["Kala Shah Kaku", "Sambrial", "Sialkot"],
  },
  {
    slug: "lahore-to-faisalabad",
    code: "LYP",
    short: "Faisalabad",
    typicalDays: 1,
    tripType: "outstation",
    region: "punjab",
    season: "All year",
    places: ["Sheikhupura", "Pindi Bhattian", "Faisalabad"],
  },
  {
    slug: "lahore-to-multan",
    code: "MUX",
    short: "Multan",
    typicalDays: 2,
    tripType: "outstation",
    region: "punjab",
    season: "October to March",
    places: ["Abdul Hakeem", "Khanewal", "Multan"],
  },
  {
    slug: "lahore-to-kartarpur-nankana-sahib",
    code: "KTP",
    short: "Kartarpur",
    typicalDays: 1,
    tripType: "outstation",
    region: "punjab",
    season: "All year",
    places: ["Sheikhupura", "Nankana Sahib", "Lahore", "Narowal", "Kartarpur"],
    intro:
      "Kartarpur is about 125 km north-east of Lahore through Narowal, and Nankana Sahib about 85 km west, past Sheikhupura. Each is a comfortable day trip with a driver who knows the way and the gurdwara timings.",
    carsIntro:
      "Comfortable cars for a long day on Punjab's country roads, from a sedan for a small family to vans and coasters for yatra groups, with live rates from our fleet.",
  },
  {
    slug: "lahore-to-wagah-border",
    code: "WGH",
    short: "Wagah",
    typicalDays: 1,
    tripType: "within_city",
    region: "punjab",
    season: "All year",
    places: ["Shalimar Gardens", "Batapur", "Wagah Border"],
    carsIntro:
      "A short evening run on the GT Road. These cars suit families, elders and groups, shown with their Lahore day rate with a driver.",
  },
];

export function routeMeta(slug: string): RouteMeta {
  const meta = ROUTE_META.find((r) => r.slug === slug);
  if (!meta) throw new Error(`[routes] No ROUTE_META entry for "${slug}" (src/components/local/route-meta.ts).`);
  return meta;
}

/** Drive time in words for prose: 4.5 -> "4 hours 30 minutes", 0.75 -> "45 minutes", 19 -> "19 hours". */
export function driveTimeWords(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hPart = h === 0 ? "" : `${h} ${h === 1 ? "hour" : "hours"}`;
  const mPart = m === 0 ? "" : `${m} minutes`;
  return [hPart, mPart].filter(Boolean).join(" ") || "under an hour";
}
