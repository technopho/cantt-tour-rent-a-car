/**
 * Build-time data for the home page sections. Business facts come from site.ts, prices and counts
 * from the catalog (passed in), so nothing here invents numbers. Distances and drive times are
 * approximations and are always phrased as such ("about 375 km"). Images come from @/lib/media and
 * every helper copes with them being absent.
 */
import { TERMS } from "@/components/services/terms";
import { site, type AreaServed, type RouteServed } from "@/config/site";
import type { CatalogModel } from "@/lib/catalog-types";
import { formatPKR } from "@/lib/format";
import { captionFor, firstScene, fleetImage, road, still, type Img, type StillName } from "@/lib/media";
import type { FaqItem } from "@/lib/schema";
import { urls } from "@/lib/urls";

/* ------------------------------------------------------------------------------------------ */
/* Catalog facts                                                                                */
/* ------------------------------------------------------------------------------------------ */

export interface FleetFacts {
  models: number;
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
    fromPrice: lowest(models.map((m) => m.rates.fromPrice)),
    driverFrom: lowest(models.map((m) => m.rates.withDriver?.daily)),
    selfDriveFrom: lowest(models.map((m) => m.rates.selfDrive?.daily)),
    depositFrom: lowest(models.map((m) => m.rates.selfDrive?.securityDeposit)),
    monthlyFrom: lowest(models.flatMap((m) => [m.rates.withDriver?.monthly, m.rates.selfDrive?.monthly])),
    selfDriveModels: models.filter((m) => m.rates.selfDrive !== null).length,
    maxSeats: models.length ? Math.max(...models.map((m) => m.seats)) : null,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Images: a real catalog photo always wins over an AI image (DESIGN.md). Everything can be undefined. */
/* ------------------------------------------------------------------------------------------ */

export interface HomeImage {
  img: Img;
  /** An AI image with a vehicle in it (fleet image or scene): its caption is "Representative image". */
  representative: boolean;
  /**
   * The small print the picture owes the reader, from captionFor: "Representative image" on an AI picture with a
   * vehicle in it, "Photo: Name / Unsplash" on a licensed place photo, nothing on a real catalog photo or a
   * no-car still. Every section that shows a HomeImage renders it.
   */
  caption?: string;
  /** CSS object-position that keeps the car in frame. Only AI fleet images have a known composition. */
  position?: string;
}

/** Any manifest picture as a HomeImage, with its small print. */
export function homeImage(img: Img, position?: string): HomeImage {
  const caption = captionFor(img);
  return { img, representative: caption === "Representative image", caption, position };
}

/** Where the front of the car sits in each AI fleet image, for tight portrait crops. */
const FLEET_FOCUS: Record<string, string> = {
  "toyota-land-cruiser": "30% 50%",
  "mercedes-s-class": "26% 50%",
  "toyota-prado": "30% 50%",
  "toyota-fortuner": "34% 50%",
  "honda-civic": "30% 50%",
};

export function modelImage(model: Pick<CatalogModel, "slug" | "images">): HomeImage | undefined {
  const photo = model.images[0];
  if (photo) return { img: photo, representative: false };
  const ai = fleetImage(model.slug);
  return ai ? homeImage(ai, FLEET_FOCUS[model.slug]) : undefined;
}

/** First scene that exists, else the given model's real photo, else its AI fleet image. */
export function sceneOrModel(scenes: string[], slug: string, models: CatalogModel[], position?: string): HomeImage | undefined {
  const mood = firstScene(...scenes);
  if (mood) return homeImage(mood);
  const photo = models.find((m) => m.slug === slug)?.images[0];
  if (photo) return { img: photo, representative: false };
  const ai = fleetImage(slug);
  return ai ? homeImage(ai, position ?? FLEET_FOCUS[slug]) : undefined;
}

/** First scene that exists, else a still with no car in it (trails, terrain). Never undefined. */
export function sceneOrStill(scenes: string[], name: StillName, position?: string): HomeImage {
  const mood = firstScene(...scenes);
  return mood ? homeImage(mood) : homeImage(still(name), position);
}

/* ------------------------------------------------------------------------------------------ */
/* The Collection                                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface CollectionCar {
  model: CatalogModel;
  image: HomeImage;
}

/**
 * Highest daily rate first. Models with an image go in the gallery; the rest stay as quiet links,
 * so the gallery grows by itself as images are added and no model link is ever lost.
 */
export function splitCollection(models: CatalogModel[]): { gallery: CollectionCar[]; rest: CatalogModel[] } {
  const sorted = [...models].sort((a, b) => b.rates.fromPrice - a.rates.fromPrice);
  const gallery: CollectionCar[] = [];
  const rest: CatalogModel[] = [];
  for (const model of sorted) {
    const image = modelImage(model);
    if (image) gallery.push({ model, image });
    else rest.push(model);
  }
  return { gallery, rest };
}

/* ------------------------------------------------------------------------------------------ */
/* Occasions                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface Occasion {
  key: string;
  name: string;
  /** Keyword-rich name for the link's accessible text. */
  fullName: string;
  href: string;
  line: string;
  image: HomeImage | undefined;
}

/** The seven columns. Luxury and vans have their own service pages and are linked under the columns. */
export function occasions(models: CatalogModel[]): Occasion[] {
  const north = road("skardu") ?? road("hunza") ?? road("motorway");
  return [
    {
      key: "wedding",
      name: "Wedding",
      fullName: "Wedding car rental",
      href: urls.service("wedding-car-rental-lahore"),
      line: "For the couple and the guests, from mehndi to walima.",
      image: sceneOrModel(["wedding"], "mercedes-s-class", models),
    },
    {
      key: "chauffeur",
      name: "Chauffeur",
      fullName: "Rent a car with driver",
      href: urls.service("rent-a-car-with-driver-lahore"),
      line: "A clean car and a driver who knows Lahore.",
      // The rear seat, not the chauffeur at the door: the opening has just shown that picture.
      image: sceneOrModel(["luxury", "chauffeur"], "toyota-land-cruiser", models),
    },
    {
      key: "airport",
      name: "Airport",
      fullName: "Airport pick and drop",
      href: urls.service("lahore-airport-car-rental"),
      line: "Allama Iqbal International, timed to your flight.",
      image: sceneOrModel(["airport"], "toyota-fortuner", models),
    },
    {
      key: "corporate",
      name: "Corporate",
      fullName: "Corporate car rental",
      href: urls.service("corporate-car-rental-lahore"),
      line: "Visiting teams, events and staff, billed to your company.",
      image: sceneOrModel(["corporate"], "toyota-prado", models),
    },
    {
      key: "self-drive",
      name: "Self drive",
      fullName: "Self drive car rental",
      href: urls.service("self-drive-car-rental-lahore"),
      line: "Clear terms, a refundable deposit, a quick handover in Cantt.",
      image: sceneOrModel(["selfdrive"], "honda-civic", models),
    },
    {
      key: "long-term",
      name: "Long-term",
      fullName: "Monthly car rental",
      href: urls.service("monthly-car-rental-lahore"),
      line: "A month or longer at a lower daily rate.",
      image: sceneOrModel(["monthly"], "toyota-fortuner", models, "78% 50%"),
    },
    {
      key: "north",
      name: "The north",
      fullName: "Outstation routes from Lahore",
      href: urls.routes(),
      line: "Islamabad to Skardu, with a driver who knows the road.",
      image: north ? homeImage(north) : sceneOrModel([], "toyota-land-cruiser", models, "76% 50%"),
    },
  ];
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
