/**
 * Build-time data for the home page sections. Business facts come from site.ts, prices and counts
 * from the catalog (passed in), so nothing here invents numbers. Distances and drive times are
 * approximations and are always phrased as such ("about 375 km").
 */
import { TERMS } from "@/components/services/terms";
import { site, type AreaServed, type RouteServed } from "@/config/site";
import type { CatalogModel } from "@/lib/catalog-types";
import { formatPKR } from "@/lib/format";
import type { FaqItem } from "@/lib/schema";

/* ------------------------------------------------------------------------------------------ */
/* Catalog facts                                                                                */
/* ------------------------------------------------------------------------------------------ */

export interface FleetFacts {
  models: number;
  units: number;
  fromPrice: number | null;
  driverFrom: number | null;
  selfDriveFrom: number | null;
  /** Lowest self drive security deposit in the catalog. */
  depositFrom: number | null;
  /** Lowest monthly rate (with driver or self drive). */
  monthlyFrom: number | null;
  selfDriveModels: number;
  maxSeats: number | null;
}

function lowest(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && v > 0);
  return nums.length ? Math.min(...nums) : null;
}

export function fleetFacts(models: CatalogModel[]): FleetFacts {
  return {
    models: models.length,
    units: models.reduce((sum, m) => sum + m.units, 0),
    fromPrice: lowest(models.map((m) => m.rates.fromPrice)),
    driverFrom: lowest(models.map((m) => m.rates.withDriver?.daily)),
    selfDriveFrom: lowest(models.map((m) => m.rates.selfDrive?.daily)),
    depositFrom: lowest(models.map((m) => m.rates.selfDrive?.securityDeposit)),
    monthlyFrom: lowest(models.flatMap((m) => [m.rates.withDriver?.monthly, m.rates.selfDrive?.monthly])),
    selfDriveModels: models.filter((m) => m.rates.selfDrive !== null).length,
    maxSeats: models.length ? Math.max(...models.map((m) => m.seats)) : null,
  };
}

/** Lowest "from" price among models of the given categories or suitableFor tags. */
export function fromPriceFor(models: CatalogModel[], match: { categories?: string[]; tags?: string[] }): number | null {
  return lowest(
    models
      .filter((m) => (match.categories ?? []).includes(m.category) || (match.tags ?? []).some((t) => m.suitableFor.includes(t)))
      .map((m) => m.rates.fromPrice),
  );
}

/**
 * Lowest with-driver daily rate among the models a driver-only service uses. Weddings, luxury,
 * airport and vans are always quoted with a driver, so a self drive "from" price would understate
 * them. Mirrors the model selection of the service pages (src/components/services/service-data.ts).
 */
export function withDriverFrom(models: CatalogModel[], select: (m: CatalogModel) => boolean): number | null {
  return lowest(models.filter((m) => m.rates.withDriver !== null && select(m)).map((m) => m.rates.withDriver?.daily));
}

/* ------------------------------------------------------------------------------------------ */
/* Outstation routes (approximate, used when the route page has no content entry yet)          */
/* ------------------------------------------------------------------------------------------ */

export interface RouteFacts {
  km: number;
  hours: number;
  /** Main roads, for the route list. */
  via: string;
}

/**
 * Approximate road distance and driving time from Lahore Cantt, normal traffic, no long stops.
 * Route content entries (src/content/routes) override these when they exist.
 */
export const ROUTE_FALLBACKS: Record<string, RouteFacts> = {
  "lahore-to-islamabad": { km: 375, hours: 4.5, via: "M-2 motorway" },
  "lahore-to-murree": { km: 435, hours: 6, via: "M-2, then the Murree Expressway" },
  "lahore-to-naran-kaghan": { km: 645, hours: 10.5, via: "M-2, Hazara Motorway and the Kaghan Valley road" },
  "lahore-to-hunza": { km: 1000, hours: 19, via: "Babusar Pass in summer or the Karakoram Highway, over two days" },
  "lahore-to-skardu": { km: 1040, hours: 21, via: "Karakoram Highway and the Jaglot to Skardu road, two days or more" },
  "lahore-to-swat": { km: 540, hours: 7.5, via: "M-2, M-1 and the Swat Expressway" },
  "lahore-to-sialkot": { km: 135, hours: 1.75, via: "Ring Road and the M-11 Sialkot Motorway" },
  "lahore-to-faisalabad": { km: 185, hours: 2.5, via: "M-2 and M-4 motorways" },
  "lahore-to-multan": { km: 340, hours: 4, via: "M-3 and M-4 motorways" },
  "lahore-to-kartarpur-nankana-sahib": { km: 125, hours: 2.75, via: "Narowal road to Kartarpur, Sheikhupura road to Nankana Sahib" },
  "lahore-to-wagah-border": { km: 25, hours: 0.75, via: "GT Road (N-5), east of the city" },
};

export interface RouteEntryLike {
  slug: string;
  distanceKm: number;
  driveHours: number;
  motorways?: string[];
}

export interface HomeRoute extends RouteServed, RouteFacts {}

export function homeRoutes(entries: RouteEntryLike[]): HomeRoute[] {
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  return site.routes.flatMap((route) => {
    const entry = bySlug.get(route.slug);
    const fallback = ROUTE_FALLBACKS[route.slug];
    if (entry) {
      return [
        {
          ...route,
          km: entry.distanceKm,
          hours: entry.driveHours,
          via: fallback?.via ?? joinAnd(entry.motorways ?? []),
        },
      ];
    }
    return fallback ? [{ ...route, ...fallback }] : [];
  });
}

/** "about 4 h 30 min" style, with whole hours for long trips. */
export function driveTimeLabel(hours: number): string {
  if (hours >= 12) return `${Math.round(hours)} h`;
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/* ------------------------------------------------------------------------------------------ */
/* Neighbourhood pickup notes                                                                    */
/* ------------------------------------------------------------------------------------------ */

const AREA_NOTES: Record<string, string> = {
  "lahore-cantt": "Our base. Doorstep pickups from Sarwar Road to Fortress Stadium, often the quickest to reach you.",
  "dha-lahore": "Every DHA phase, from Phase 1 next to Cantt out to the newer phases off Ring Road.",
  gulberg: "Homes, offices and hotels around Main Boulevard, MM Alam Road and Liberty Market.",
  "johar-town": "Pickups near Expo Centre, Emporium Mall and the Canal Road side of Johar Town.",
  "model-town": "Quiet blocks between Ferozepur Road and Model Town Link Road, close to Kalma Chowk.",
  "bahria-town-lahore": "Gate pickups in Bahria Town, close to the Thokar Niaz Baig entry to the M-2.",
  askari: "Askari colonies across Cantt and the airport side of the city, a short run from our base.",
  "wapda-town": "Near Johar Town and Raiwind Road, with quick access to the motorway at Thokar.",
};

export function areaNote(area: AreaServed): string {
  return AREA_NOTES[area.slug] ?? `Doorstep pickups anywhere in ${area.name}, confirmed on WhatsApp.`;
}

/* ------------------------------------------------------------------------------------------ */
/* FAQ                                                                                          */
/* ------------------------------------------------------------------------------------------ */

function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function homeFaqs(facts: FleetFacts): FaqItem[] {
  const priceParts = [
    facts.driverFrom !== null ? `cars with a driver start from ${formatPKR(facts.driverFrom)} per day` : null,
    facts.selfDriveFrom !== null ? `self drive starts from ${formatPKR(facts.selfDriveFrom)} per day` : null,
  ].filter((p): p is string => p !== null);
  const priceLine = priceParts.length
    ? `On our current rates, ${joinAnd(priceParts)}.`
    : "Prices depend on the car and the trip.";
  const areas = joinAnd(site.areasServed.map((a) => a.name));

  return [
    {
      q: "How much does it cost to rent a car in Lahore?",
      a: `${priceLine} The final price depends on the car, the number of days, whether you need a driver and whether the trip leaves Lahore. Every quote lists what is included before you book.`,
    },
    {
      q: "Can I rent a car with a driver in Lahore?",
      a: "Yes. Most of our cars come with a driver who knows Lahore, for city errands, family functions, business days, airport runs and outstation trips. A daily booking covers standard duty hours, and extra hours are billed at the overtime rate for that car.",
    },
    {
      // Not "What documents do I need for a self drive car?": /faq/ and the self drive page already
      // mark that question up, and a repeated Q&A may carry FAQPage markup on one page only.
      q: "What do I need to rent a car in Lahore?",
      a: `With a driver, just your CNIC (or passport for overseas visitors) and a phone number we can reach on WhatsApp. For self drive, your original CNIC (or passport), a valid driving licence and the refundable security deposit shown for your car. Self drive cars are handed over ${TERMS.selfDriveHandover}; we check the documents at handover and refund the deposit when the car comes back in the agreed condition.`,
    },
    {
      q: "Do you do pick and drop at Allama Iqbal International Airport?",
      a: "Yes. Send your flight number and arrival time and the driver is timed to your landing at Allama Iqbal International Airport (LHE). Drops to the airport are planned with enough time for check in and Lahore traffic.",
    },
    {
      q: "Is fuel included in the rent?",
      a: `Not in our published rates. Fuel, motorway tolls and parking are paid separately. With a driver, fuel is ${TERMS.fuelWithDriver}; for self drive, the fuel rule is ${TERMS.fuelSelfDrive}. We tell you exactly what is included before you confirm, so there are no surprises on the day.`,
    },
    {
      q: "Can I take a rented car from Lahore to Islamabad or the northern areas?",
      a: `Yes. Outstation trips with a driver to Islamabad, Murree, Naran, Hunza, Skardu and other cities are booked at the outstation rate, plus a night allowance for the driver when you stay overnight. For the mountains we suggest an SUV or a van with a driver who knows those roads. Self drive cars can leave Lahore too, but ${TERMS.selfDriveOutstation}.`,
    },
    {
      q: "Do you rent wedding cars in Lahore?",
      a: `Yes. We provide a car for the couple and matching cars for guests for mehndi, baraat and walima, with pickups planned around your function timings. Book early in the wedding season, roughly ${TERMS.weddingSeason}, when the best cars go first.`,
    },
    {
      q: "Which areas of Lahore do you pick up from?",
      a: `All of Lahore. We regularly pick up from ${areas}, as well as hotels, hospitals, offices and the airport. Share your address in the quote and we confirm the pickup time on WhatsApp.`,
    },
  ];
}
