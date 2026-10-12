/**
 * Per-service page data that does not fit the services content schema (src/content.config.ts):
 * which catalog models to recommend, which rate columns to show, the signature "journey"
 * timeline, documents, related routes and services, WhatsApp prefill and composer defaults.
 *
 * Long-form copy lives in src/content/services/<slug>.md. Prices NEVER live here: every amount
 * is read from the catalog at build time through the column getters below.
 */
import type { CatalogModel } from "@/lib/catalog-types";
import type { PriceUnit } from "@/lib/format";
import { site, type ServiceType, type TripType } from "@/config/site";
import { TERMS } from "./terms";

export type ServiceSlug =
  | "rent-a-car-with-driver-lahore"
  | "self-drive-car-rental-lahore"
  | "monthly-car-rental-lahore"
  | "lahore-airport-car-rental"
  | "wedding-car-rental-lahore"
  | "corporate-car-rental-lahore"
  | "luxury-car-rental-lahore"
  | "van-coaster-rental-lahore";

/** One column of the service rate table. `get` returns a catalog value or null ("Ask us"). */
export interface RateColumn {
  label: string;
  kind: "money" | "number" | "text";
  get: (m: CatalogModel) => number | string | null;
  /** Money: unit suffix ("/day"). Number: text suffix (" km"). */
  unit?: PriceUnit;
  suffix?: string;
}

export interface JourneyStop {
  label: string;
  title: string;
  text: string;
  icon: string;
}

export interface DocumentItem {
  text: string;
  note?: string;
  icon: string;
}

export interface HeroPrice {
  amount: number | null;
  unit: PriceUnit;
  note: string;
}

export interface ServiceExtra {
  /** Breadcrumb label and short name. */
  label: string;
  /** schema.org Service.serviceType. */
  schemaServiceType: string;
  whatsappMessage: string;
  composer: { serviceType: ServiceType; tripType: TripType };
  /** Which catalog models fit this service. */
  select: (m: CatalogModel) => boolean;
  /** Optional ordering (lower first). Default: catalog order. */
  rank?: (m: CatalogModel) => number;
  /** Max cards in the grid. */
  limit: number;
  /** The headline price for the hero panel, computed from the selected models. */
  heroPrice: (models: CatalogModel[]) => HeroPrice;
  /** Lowest per-day price for the Service JSON-LD (unit is DAY in the schema builder). */
  schemaLowPrice: (models: CatalogModel[]) => number | null;
  /** How the service is offered, shown in the hero panel. */
  modeLabel: string;
  cars: { title: string; intro: string };
  rates: { title: string; intro: string; columns: RateColumn[] };
  journey: { title: string; intro: string; stops: JourneyStop[] };
  documents: { title: string; intro: string; items: DocumentItem[] };
  areas: { title: string; intro: string; linkLabel: (areaName: string) => string };
  routes: { title: string; intro: string; slugs: string[] } | null;
  related: ServiceSlug[];
  /**
   * Guide slugs (src/content/guides/<slug>.md) worth reading before booking this service.
   * Resolved against the guides collection at build time: unknown or draft guides are skipped.
   */
  guides: string[];
  /** Van page: show the seat-count guide built from the catalog. */
  groupGuide?: boolean;
}

/* ------------------------------------------------------------------------------------------ */
/* Catalog helpers                                                                              */
/* ------------------------------------------------------------------------------------------ */

const wd = (m: CatalogModel) => m.rates.withDriver;
const sd = (m: CatalogModel) => m.rates.selfDrive;

function minOf(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && v > 0);
  return nums.length ? Math.min(...nums) : null;
}

const minWithDriverDaily = (models: CatalogModel[]) => minOf(models.map((m) => wd(m)?.daily));
const minSelfDriveDaily = (models: CatalogModel[]) => minOf(models.map((m) => sd(m)?.daily));

/** Column presets (labels are plain English, units come from the catalog field). */
const col = {
  seats: { label: "Seats", kind: "number", get: (m) => m.seats } as RateColumn,
  luggage: { label: "Large bags", kind: "number", get: (m) => m.luggage } as RateColumn,
  gearbox: { label: "Gearbox", kind: "text", get: (m) => (m.transmission === "automatic" ? "Automatic" : "Manual") } as RateColumn,
  cityDay: { label: "City day with driver", kind: "money", unit: "day", get: (m) => wd(m)?.daily ?? null } as RateColumn,
  outstationDay: { label: "Outstation day", kind: "money", unit: "day", get: (m) => wd(m)?.outstationDaily ?? null } as RateColumn,
  overtime: { label: "Overtime", kind: "money", unit: "hour", get: (m) => wd(m)?.overtimeHourly ?? null } as RateColumn,
  nightAllowance: { label: "Driver night stay", kind: "money", unit: "night", get: (m) => m.rates.driverNightAllowance } as RateColumn,
  driverMonthly: { label: "With driver", kind: "money", unit: "month", get: (m) => wd(m)?.monthly ?? null } as RateColumn,
  selfDaily: { label: "Self drive", kind: "money", unit: "day", get: (m) => sd(m)?.daily ?? null } as RateColumn,
  selfWeekly: { label: "Per week", kind: "money", unit: "week", get: (m) => sd(m)?.weekly ?? null } as RateColumn,
  selfMonthly: { label: "Self drive", kind: "money", unit: "month", get: (m) => sd(m)?.monthly ?? null } as RateColumn,
  deposit: { label: "Refundable deposit", kind: "money", get: (m) => sd(m)?.securityDeposit ?? null } as RateColumn,
  km: { label: "Km per day", kind: "number", suffix: " km", get: (m) => sd(m)?.kmPerDay ?? null } as RateColumn,
} satisfies Record<string, RateColumn>;

const isCategory =
  (...slugs: string[]) =>
  (m: CatalogModel) =>
    slugs.includes(m.category);
const suits = (tag: string) => (m: CatalogModel) => m.suitableFor.includes(tag);

/** Every outstation route with its own page (site.ts), in the same order as the footer. */
const ALL_ROUTES = site.routes.map((r) => r.slug);

/* ------------------------------------------------------------------------------------------ */
/* The eight services                                                                           */
/* ------------------------------------------------------------------------------------------ */

export const SERVICE_EXTRAS: Record<ServiceSlug, ServiceExtra> = {
  "rent-a-car-with-driver-lahore": {
    label: "Rent a car with driver",
    schemaServiceType: "Car rental with driver",
    whatsappMessage: "Assalam o Alaikum! I need a car with driver in Lahore.",
    composer: { serviceType: "with_driver", tripType: "within_city" },
    select: (m) => Boolean(wd(m)) && isCategory("hatchback", "sedan", "suv")(m),
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with driver, city day" }),
    schemaLowPrice: minWithDriverDaily,
    modeLabel: "With driver",
    cars: {
      title: "Cars you can book with a driver",
      intro: "Everyday sedans for the city, SUVs and 7 seaters for families. Every price below is the current rate for a city day with a driver.",
    },
    rates: {
      title: "With driver rates in Lahore",
      intro: "City day, outstation day, overtime and the driver's night allowance for each car, straight from our current rate list.",
      columns: [col.seats, col.cityDay, col.outstationDay, col.overtime, col.nightAllowance],
    },
    journey: {
      title: `A ${TERMS.cityDayHours} hour city day, mapped out`,
      intro: `Most families and business visitors book a full city day: ${TERMS.cityDayHours} hours of duty, for example ${TERMS.cityDayWindow}. Here is what that can look like.`,
      stops: [
        {
          label: "Morning",
          title: "Pickup at your gate",
          text: "The driver arrives a few minutes early and messages you from outside. In DHA, Askari or Bahria Town, share the gate and block so security lets him in quickly.",
          icon: "ph:house-line",
        },
        {
          label: "Mid morning",
          title: "School and office drops",
          text: "Children to school on Sarwar Road, then the office on Main Boulevard Gulberg. The driver knows the drop lanes and the one-way loops.",
          icon: "ph:graduation-cap",
        },
        {
          label: "Afternoon",
          title: "Errands while he waits",
          text: "A bank visit on The Mall, a check-up at a hospital, shopping at Liberty Market. The driver waits with the car and handles parking.",
          icon: "ph:shopping-bag",
        },
        {
          label: "Evening",
          title: "Family plans",
          text: "Pick up from work, visit relatives in Model Town, dinner on MM Alam Road. Evening traffic on Canal Road is his problem, not yours.",
          icon: "ph:fork-knife",
        },
        {
          label: `Hour ${TERMS.cityDayHours}`,
          title: "Home, or overtime",
          text: "The day ends when the duty hours are up. Running late at a function? Overtime is billed per hour at the rate shown for your car.",
          icon: "ph:moon-stars",
        },
      ],
    },
    documents: {
      title: "What we need from you",
      intro: "Booking a car with a driver needs very little paperwork.",
      items: [
        { text: "Your CNIC, or passport for overseas visitors", icon: "ph:identification-card" },
        { text: "A mobile number on WhatsApp", note: "for the driver's details and arrival message", icon: "simple-icons:whatsapp" },
        { text: "Pickup address or a Google Maps pin", note: "plus the gate or block in a housing society", icon: "ph:map-pin" },
        { text: "Your rough plan for the day", note: "and the route and nights away for outstation trips", icon: "ph:map-trifold" },
      ],
    },
    areas: {
      title: "Pickup anywhere in Lahore",
      intro: "Our drivers start from Lahore Cantt and cover every part of the city. Area guides with drive times and pickup notes:",
      linkLabel: (name) => `Car with driver in ${name}`,
    },
    routes: {
      title: "Take the same car out of the city",
      intro: "Outstation trips use the outstation daily rate plus a night allowance when the driver stays over.",
      slugs: ALL_ROUTES,
    },
    related: ["lahore-airport-car-rental", "wedding-car-rental-lahore", "van-coaster-rental-lahore", "luxury-car-rental-lahore"],
    guides: ["self-drive-vs-car-with-driver-lahore", "cost-to-rent-a-car-in-lahore", "renting-a-car-in-lahore-overseas-pakistanis"],
  },

  "self-drive-car-rental-lahore": {
    label: "Self drive car rental",
    schemaServiceType: "Self drive car rental",
    whatsappMessage: "Assalam o Alaikum! I want a self drive car in Lahore.",
    composer: { serviceType: "self_drive", tripType: "within_city" },
    select: (m) => Boolean(sd(m)),
    rank: (m) => sd(m)?.daily ?? Number.MAX_SAFE_INTEGER,
    limit: 6,
    heroPrice: (models) => ({ amount: minSelfDriveDaily(models), unit: "day", note: "self drive day rate, deposit refundable" }),
    schemaLowPrice: minSelfDriveDaily,
    modeLabel: "Self drive",
    cars: {
      title: "Cars available for self drive",
      intro: "Hatchbacks for city errands, sedans for comfort and SUVs for family trips. Prices shown are the current self drive day rates.",
    },
    rates: {
      title: "Self drive rates, deposits and km",
      intro: "Day, week and month prices, the refundable security deposit and the daily kilometre allowance for every self drive car.",
      columns: [col.gearbox, col.selfDaily, col.selfWeekly, col.selfMonthly, col.deposit, col.km],
    },
    journey: {
      title: "From booking to handback",
      intro: "Self drive is simple when every step is written down. This is how a rental runs with us.",
      stops: [
        {
          label: "Step 1",
          title: "Send your documents",
          text: "Photos of your CNIC and driving licence on WhatsApp. We verify them before the day so handover is quick.",
          icon: "ph:identification-card",
        },
        {
          label: "Step 2",
          title: "Walk around the car",
          text: `Handover ${TERMS.selfDriveHandover}. We photograph the car together and note the fuel level and the odometer.`,
          icon: "ph:camera",
        },
        {
          label: "Step 3",
          title: "Deposit and agreement",
          text: "Pay the refundable deposit shown for your car and sign a short agreement with the km allowance and return time.",
          icon: "ph:file-text",
        },
        {
          label: "Step 4",
          title: "Drive",
          text: "Stay inside Lahore unless we have approved an outstation trip. Call us any time if the car needs attention.",
          icon: "ph:steering-wheel",
        },
        {
          label: "Step 5",
          title: "Return and refund",
          text: `Same fuel level, same condition. The deposit comes back within ${TERMS.depositRefundDays} days, after the Safe City e-challan check.`,
          icon: "ph:hand-coins",
        },
      ],
    },
    documents: {
      title: "Documents for self drive",
      intro: "Bring the originals to handover. Sending photos in advance saves time on the day.",
      items: [
        { text: "Original CNIC", note: "overseas Pakistanis: NICOP or passport", icon: "ph:identification-card" },
        { text: "Valid driving licence", note: "foreign visitors: home licence plus an international driving permit", icon: "ph:identification-badge" },
        { text: "Passport with a valid visa", note: "foreign nationals only", icon: "ph:globe-hemisphere-east" },
        { text: "A recent utility bill or a local reference", note: "we may ask, depending on the car and the duration", icon: "ph:file-text" },
        { text: "The refundable security deposit", note: "cash or bank transfer at handover", icon: "ph:wallet" },
        { text: `Minimum age ${TERMS.selfDriveMinAge}`, note: "high value cars may need more driving experience", icon: "ph:user-check" },
      ],
    },
    areas: {
      title: "Pickup in Cantt, delivery across Lahore",
      intro: `Self drive cars are handed over and returned ${TERMS.selfDriveHandover}. Area guides:`,
      linkLabel: (name) => `Self drive pickup in ${name}`,
    },
    routes: {
      title: "Motorway trips with approval",
      intro: `Self drive cars can leave Lahore ${TERMS.selfDriveOutstation}. These motorway routes are the usual ones:`,
      slugs: ["lahore-to-islamabad", "lahore-to-sialkot", "lahore-to-faisalabad", "lahore-to-multan"],
    },
    related: ["monthly-car-rental-lahore", "rent-a-car-with-driver-lahore", "lahore-airport-car-rental", "corporate-car-rental-lahore"],
    guides: ["documents-to-rent-a-car-in-pakistan", "self-drive-vs-car-with-driver-lahore", "cost-to-rent-a-car-in-lahore"],
  },

  "monthly-car-rental-lahore": {
    label: "Monthly car rental",
    schemaServiceType: "Monthly car rental",
    whatsappMessage: "Assalam o Alaikum! I need a car on monthly rent in Lahore.",
    composer: { serviceType: "self_drive", tripType: "monthly" },
    select: (m) => Boolean(wd(m)?.monthly || sd(m)?.monthly) || suits("monthly")(m),
    rank: (m) => minOf([sd(m)?.monthly, wd(m)?.monthly]) ?? Number.MAX_SAFE_INTEGER,
    limit: 6,
    heroPrice: (models) => ({
      amount: minOf(models.flatMap((m) => [sd(m)?.monthly, wd(m)?.monthly])),
      unit: "month",
      note: "self drive or with driver",
    }),
    schemaLowPrice: (models) => minOf(models.flatMap((m) => [sd(m)?.daily, wd(m)?.daily])),
    modeLabel: "With driver or self drive",
    cars: {
      title: "Cars on monthly rent",
      intro: "The cars below have a monthly price with a driver, for self drive, or both. Monthly prices are in the table further down.",
    },
    rates: {
      title: "Monthly rates in Lahore",
      intro: "Price per month with a driver and for self drive, and the refundable deposit for self drive. Fuel is extra.",
      columns: [col.seats, col.selfMonthly, col.driverMonthly, col.deposit],
    },
    journey: {
      title: "What a month with us looks like",
      intro: "A monthly car should feel like your own car, minus the workshop visits and the renewals.",
      stops: [
        {
          label: "Day 1",
          title: "Delivered and documented",
          text: "The car arrives at your home or office, checked, washed and photographed, with the papers in the glovebox.",
          icon: "ph:key",
        },
        {
          label: "Every service",
          title: "Maintenance on us",
          text: "Oil changes, filters, tyres and AC service on schedule. We collect the car or swap it for the day.",
          icon: "ph:wrench",
        },
        {
          label: "If it breaks",
          title: "A replacement car",
          text: `Workshop visit needed? A replacement is usually with you within ${TERMS.replacementHours} hours in Lahore.`,
          icon: "ph:arrows-clockwise",
        },
        {
          label: "Month end",
          title: "One clear statement",
          text: "Rent, extra kilometres and any challans on one statement. Company invoices on request.",
          icon: "ph:receipt",
        },
        {
          label: "Next month",
          title: "Renew, swap or return",
          text: "Keep the same car, move up or down a size, or hand it back. Tell us a few days before the month ends.",
          icon: "ph:calendar-check",
        },
      ],
    },
    documents: {
      title: "Documents for a monthly rental",
      intro: "Long rentals need a little more paperwork than a day booking, mostly for self drive.",
      items: [
        { text: "CNIC, or passport with a valid visa", icon: "ph:identification-card" },
        { text: "Valid driving licence for self drive", note: "foreign licence plus an international driving permit", icon: "ph:identification-badge" },
        { text: "Proof of address or an employer letter", note: "company letterhead works for staff on a posting", icon: "ph:buildings" },
        { text: "Refundable deposit or first month in advance", note: "as set in your agreement", icon: "ph:wallet" },
      ],
    },
    areas: {
      title: "Monthly cars delivered across Lahore",
      intro: "We deliver monthly cars to homes and offices in every part of the city. Area guides:",
      linkLabel: (name) => `Monthly car in ${name}`,
    },
    routes: null,
    related: ["corporate-car-rental-lahore", "self-drive-car-rental-lahore", "rent-a-car-with-driver-lahore", "lahore-airport-car-rental"],
    guides: ["cost-to-rent-a-car-in-lahore", "renting-a-car-in-lahore-overseas-pakistanis", "documents-to-rent-a-car-in-pakistan"],
  },

  "lahore-airport-car-rental": {
    label: "Airport pick and drop",
    schemaServiceType: "Airport transfer with driver",
    whatsappMessage: "Assalam o Alaikum! I need a pickup from Allama Iqbal International Airport, Lahore. Flight number:",
    composer: { serviceType: "with_driver", tripType: "airport" },
    select: (m) => Boolean(wd(m)) && suits("airport")(m),
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with driver, full day" }),
    schemaLowPrice: minWithDriverDaily,
    modeLabel: "With driver",
    cars: {
      title: "Cars for airport runs",
      intro: "Sedans for one or two travellers, SUVs and vans for families coming home with a lot of luggage.",
    },
    rates: {
      title: "Airport car rates and luggage space",
      intro: "Single transfers are quoted per trip on WhatsApp. If you keep the car for the day, the day rate below applies.",
      columns: [col.seats, col.luggage, col.cityDay, col.overtime],
    },
    journey: {
      title: "Your arrival at LHE, step by step",
      intro: "Allama Iqbal International Airport sits on the east side of Lahore, next to Cantt. This is how a pickup runs.",
      stops: [
        {
          label: "Before you fly",
          title: "Send the flight number",
          text: "We confirm the driver's name, number and the car's registration on WhatsApp before you board.",
          icon: "ph:airplane-tilt",
        },
        {
          label: "In the air",
          title: "We track the flight",
          text: "Early or delayed, the driver plans for the actual landing time, not the time on your ticket.",
          icon: "ph:airplane-landing",
        },
        {
          label: "On the ground",
          title: "Immigration and bags",
          text: `Free waiting of ${TERMS.airportFreeWaitMinutes} minutes starts at landing, enough for immigration, baggage and customs on most flights.`,
          icon: "ph:suitcase-rolling",
        },
        {
          label: "Arrivals exit",
          title: "Your name on a board",
          text: "The driver waits outside the arrivals hall, helps with the trolley and walks you to the car.",
          icon: "ph:identification-card",
        },
        {
          label: "Home",
          title: "Straight to your door",
          text: "About 15 to 25 minutes to Cantt or DHA late at night. Longer at rush hour to Johar Town or Bahria Town.",
          icon: "ph:house-line",
        },
      ],
    },
    documents: {
      title: "What to send us",
      intro: "No paperwork for an airport transfer, just the details that make the pickup smooth.",
      items: [
        { text: "Flight number and date", note: "we track the actual landing time", icon: "ph:airplane-tilt" },
        { text: "Name for the board", note: "and the number of passengers", icon: "ph:identification-card" },
        { text: "Number of large bags", note: "so we send a car that fits them", icon: "ph:suitcase-rolling" },
        { text: "A number that works on arrival", note: "WhatsApp on airport Wi-Fi is fine", icon: "simple-icons:whatsapp" },
        { text: "Drop address in Lahore", note: "or the city, for transfers beyond Lahore", icon: "ph:map-pin" },
      ],
    },
    areas: {
      title: "Airport transfers to every part of Lahore",
      intro: "Drop-offs and pickups between LHE and any address in the city. Area guides with drive times:",
      linkLabel: (name) => `Airport transfers for ${name}`,
    },
    routes: {
      title: "Straight from the airport to another city",
      intro: "Landing in Lahore but heading elsewhere? We drive arrivals directly to these cities, priced as outstation.",
      slugs: ["lahore-to-sialkot", "lahore-to-faisalabad", "lahore-to-islamabad", "lahore-to-multan"],
    },
    related: ["rent-a-car-with-driver-lahore", "van-coaster-rental-lahore", "luxury-car-rental-lahore", "corporate-car-rental-lahore"],
    guides: ["renting-a-car-in-lahore-overseas-pakistanis", "cost-to-rent-a-car-in-lahore"],
  },

  "wedding-car-rental-lahore": {
    label: "Wedding car rental",
    schemaServiceType: "Wedding car rental with driver",
    whatsappMessage: "Assalam o Alaikum! I need wedding cars in Lahore. Function date:",
    composer: { serviceType: "with_driver", tripType: "wedding" },
    select: (m) => Boolean(wd(m)) && (suits("wedding")(m) || isCategory("wedding")(m)),
    rank: (m) => -(wd(m)?.daily ?? 0),
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with chauffeur, per function day" }),
    schemaLowPrice: minWithDriverDaily,
    modeLabel: "With chauffeur",
    cars: {
      title: "Wedding cars and guest cars",
      intro: "A statement car for the couple, matching sedans for family, and vans for the guests. Day rates with a chauffeur shown.",
    },
    rates: {
      title: "Wedding car rates in Lahore",
      intro: "Per function day with a chauffeur. Decoration is priced separately and agreed with you before the day.",
      columns: [col.seats, col.cityDay, col.overtime, col.outstationDay],
    },
    journey: {
      title: "One wedding, four moments",
      intro: "Most Lahore weddings run across several functions. We plan the cars for each one, not just the baraat.",
      stops: [
        {
          label: "Mehndi",
          title: "Guests, music and late nights",
          text: "Guest cars and vans between homes, hotels and the venue, often a farmhouse on Bedian Road or Barki Road.",
          icon: "ph:music-notes",
        },
        {
          label: "Baraat",
          title: "The convoy",
          text: "The dulha's decorated car leads, guest cars follow in order. Timings are worked back from the hall's slot.",
          icon: "ph:path",
        },
        {
          label: "Rukhsati",
          title: "The couple's car",
          text: "Ready at the hall door, decoration intact, for the drive home with the bride.",
          icon: "ph:heart",
        },
        {
          label: "Walima",
          title: "Same care, next day",
          text: "The same chauffeur and car if you want continuity, or a different look for the reception.",
          icon: "ph:confetti",
        },
      ],
    },
    documents: {
      title: "What we need to plan your wedding cars",
      intro: "The more we know in advance, the calmer the day.",
      items: [
        { text: "CNIC of the person booking", icon: "ph:identification-card" },
        { text: "Function dates, venues and hall timings", note: "mehndi, baraat, walima", icon: "ph:calendar-dots" },
        { text: "Convoy plan", note: "how many cars, who rides where, pickup addresses", icon: "ph:list-numbers" },
        { text: "Decoration preference", note: "fresh flowers, ribbons or none", icon: "ph:flower-lotus" },
        { text: "A contact person on the day", note: "not the groom", icon: "ph:phone" },
      ],
    },
    areas: {
      title: "Wedding cars across Lahore",
      intro: "Halls and marquees on Canal Road, Raiwind Road, in DHA, Johar Town and beyond. Area guides:",
      linkLabel: (name) => `Wedding cars in ${name}`,
    },
    routes: {
      title: "Baraat to another city",
      intro: "Convoys travel together on the motorway or GT Road, priced at the outstation rate.",
      slugs: ["lahore-to-sialkot", "lahore-to-faisalabad", "lahore-to-islamabad", "lahore-to-multan"],
    },
    related: ["luxury-car-rental-lahore", "van-coaster-rental-lahore", "rent-a-car-with-driver-lahore", "lahore-airport-car-rental"],
    guides: ["cost-to-rent-a-car-in-lahore", "renting-a-car-in-lahore-overseas-pakistanis"],
  },

  "corporate-car-rental-lahore": {
    label: "Corporate car rental",
    schemaServiceType: "Corporate car rental",
    whatsappMessage: "Assalam o Alaikum! We need cars for our company in Lahore.",
    composer: { serviceType: "with_driver", tripType: "corporate" },
    select: suits("corporate"),
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with driver, per day" }),
    schemaLowPrice: (models) => minOf(models.flatMap((m) => [wd(m)?.daily, sd(m)?.daily])),
    modeLabel: "With driver or self drive",
    cars: {
      title: "Cars companies book most",
      intro: "Sedans for managers and visitors, SUVs for executives, vans and coasters for staff transport and events.",
    },
    rates: {
      title: "Corporate rates per day and per month",
      intro: "Standard rates per car. Contract rates for regular use are agreed in writing with your company.",
      columns: [col.seats, col.cityDay, col.driverMonthly, col.selfMonthly],
    },
    journey: {
      title: "How a company account works",
      intro: "Set up once, then your team books in a message and finance gets one invoice a month.",
      stops: [
        {
          label: "Week 1",
          title: "Tell us the pattern",
          text: "Daily pickups, a visiting team for a week, an event at the Expo Centre or a car for each manager.",
          icon: "ph:chat-circle-text",
        },
        {
          label: "Setup",
          title: "Account and bookers",
          text: "Company name, NTN, billing address and the names of staff who are allowed to book.",
          icon: "ph:address-book",
        },
        {
          label: "Every trip",
          title: "Booked with a reference",
          text: "Authorised staff book on WhatsApp or email. Each trip gets a reference and the driver's details.",
          icon: "ph:clipboard-text",
        },
        {
          label: "Month end",
          title: "One invoice",
          text: "Trips, overtime and extras on one invoice in your company's name, with the trip references listed.",
          icon: "ph:receipt",
        },
        {
          label: "Ongoing",
          title: "Review and adjust",
          text: "A short monthly check on timings and drivers. Add cars for busy months, drop them when it is quiet.",
          icon: "ph:chart-line-up",
        },
      ],
    },
    documents: {
      title: "Documents for a company account",
      intro: "Send these once. After that, bookings are a message.",
      items: [
        { text: "Request on company letterhead or official email", icon: "ph:buildings" },
        { text: "NTN and billing address", note: "and a purchase order number if your finance team uses them", icon: "ph:file-text" },
        { text: "List of authorised bookers", note: "names, numbers and email addresses", icon: "ph:users-three" },
        { text: "For self drive pool cars", note: "CNIC and licence of every employee who will drive", icon: "ph:identification-badge" },
      ],
    },
    areas: {
      title: "Offices and factories we serve",
      intro: "From Gulberg and DHA offices to industrial estates on Raiwind Road and Multan Road. Area guides:",
      linkLabel: (name) => `Company cars in ${name}`,
    },
    routes: {
      title: "Business trips beyond Lahore",
      intro: "Meetings in Islamabad, factory visits in Faisalabad and Sialkot, all billed to the same account.",
      slugs: ["lahore-to-islamabad", "lahore-to-faisalabad", "lahore-to-sialkot", "lahore-to-multan"],
    },
    related: ["monthly-car-rental-lahore", "luxury-car-rental-lahore", "lahore-airport-car-rental", "van-coaster-rental-lahore"],
    guides: ["cost-to-rent-a-car-in-lahore", "documents-to-rent-a-car-in-pakistan"],
  },

  "luxury-car-rental-lahore": {
    label: "Luxury car rental",
    schemaServiceType: "Luxury car rental with chauffeur",
    whatsappMessage: "Assalam o Alaikum! I need a luxury car with driver in Lahore.",
    composer: { serviceType: "with_driver", tripType: "within_city" },
    select: (m) => Boolean(wd(m)) && isCategory("luxury", "wedding")(m),
    rank: (m) => -(wd(m)?.daily ?? 0),
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with chauffeur, per day" }),
    schemaLowPrice: minWithDriverDaily,
    modeLabel: "With chauffeur",
    cars: {
      title: "The luxury range",
      intro: "Full size SUVs and executive sedans, always with a senior chauffeur. Current day rates shown.",
    },
    rates: {
      title: "Luxury car rates in Lahore",
      intro: "Per day with a chauffeur inside Lahore, outstation where offered, and overtime per hour.",
      columns: [col.seats, col.cityDay, col.outstationDay, col.overtime],
    },
    journey: {
      title: "Protocol movement, planned in detail",
      intro: "For delegations, board visits and VIP guests, the car is only half the job. The other half is planning.",
      stops: [
        {
          label: "Brief",
          title: "Who, where, when",
          text: "Guest names, flights, venues, timings and dress code from your protocol officer or PA.",
          icon: "ph:clipboard-text",
        },
        {
          label: "Recce",
          title: "Routes and drop points",
          text: "We check porches, gates and parking at venues such as hotels on The Mall or the Expo Centre in advance.",
          icon: "ph:map-trifold",
        },
        {
          label: "Assign",
          title: "Senior chauffeurs",
          text: "Experienced drivers in formal dress, briefed on the schedule and on discretion.",
          icon: "ph:identification-badge",
        },
        {
          label: "On the day",
          title: "Lead and follow",
          text: "Cars run in a set order with one coordinator on WhatsApp, keeping together through Lahore traffic.",
          icon: "ph:flag-checkered",
        },
      ],
    },
    documents: {
      title: "Details for a luxury booking",
      intro: "A few details let us plan the car, the chauffeur and the route properly.",
      items: [
        { text: "CNIC of the booker or a company letter", icon: "ph:identification-card" },
        { text: "Guest names and flight numbers", note: "for airport arrivals and gate passes", icon: "ph:airplane-tilt" },
        { text: "Venues and timings", note: "hotel, meetings, dinners, events", icon: "ph:calendar-dots" },
        { text: "Dress code and special requests", note: "and a contact for your security team, if any", icon: "ph:clipboard-text" },
      ],
    },
    areas: {
      title: "Luxury cars across Lahore",
      intro: "Hotels, offices and homes in every part of the city. Area guides:",
      linkLabel: (name) => `Luxury cars in ${name}`,
    },
    routes: {
      title: "Luxury cars for outstation trips",
      intro: "With the chauffeur, on the motorway. Islamabad meetings and Murree weekends are the usual requests.",
      slugs: ["lahore-to-islamabad", "lahore-to-murree"],
    },
    related: ["wedding-car-rental-lahore", "corporate-car-rental-lahore", "lahore-airport-car-rental", "van-coaster-rental-lahore"],
    guides: ["cost-to-rent-a-car-in-lahore", "renting-a-car-in-lahore-overseas-pakistanis"],
  },

  "van-coaster-rental-lahore": {
    label: "Van and coaster rental",
    schemaServiceType: "Van and coaster rental with driver",
    whatsappMessage: "Assalam o Alaikum! I need a van or coaster with driver in Lahore.",
    composer: { serviceType: "with_driver", tripType: "outstation" },
    select: (m) => Boolean(wd(m)) && (isCategory("van", "coaster")(m) || m.seats >= 8),
    rank: (m) => m.seats,
    limit: 6,
    heroPrice: (models) => ({ amount: minWithDriverDaily(models), unit: "day", note: "with driver, city day" }),
    schemaLowPrice: minWithDriverDaily,
    modeLabel: "With driver",
    groupGuide: true,
    cars: {
      title: "Vans and coasters",
      intro: "Every vehicle comes with an experienced driver. Seat counts and current day rates are shown on each card.",
    },
    rates: {
      title: "Van and coaster rates",
      intro: "City day, outstation day and the driver's night allowance for overnight tours.",
      columns: [col.seats, col.luggage, col.cityDay, col.outstationDay, col.nightAllowance],
    },
    journey: {
      title: "A group tour to Naran, the way we plan it",
      intro: "Northern tours are the most common van and coaster booking. This is a typical first day from Lahore.",
      stops: [
        {
          label: "Before dawn",
          title: "Leave Lahore early",
          text: "Pickups from homes or a school gate around 4 to 5 am, so the group clears the M-2 before the day traffic.",
          icon: "ph:sun-horizon",
        },
        {
          label: "M-2",
          title: "Breakfast stop",
          text: "Tea and breakfast at a motorway service area such as Bhera, with a proper rest for the driver.",
          icon: "ph:coffee",
        },
        {
          label: "Hazara Motorway",
          title: "Into the hills",
          text: "Past Islamabad and Abbottabad towards Mansehra and Balakot, where the road starts to climb.",
          icon: "ph:mountains",
        },
        {
          label: "Before dark",
          title: "Arrive in Naran",
          text: "About 12 to 14 hours with stops. We plan the day so the mountain section is driven in daylight.",
          icon: "ph:moon-stars",
        },
      ],
    },
    documents: {
      title: "What we need for a group booking",
      intro: "Group trips are about numbers and timings. Send these and we suggest the right vehicles.",
      items: [
        { text: "CNIC of the organiser", icon: "ph:identification-card" },
        { text: "Passenger count and luggage", note: "children count as seats", icon: "ph:users-three" },
        { text: "Itinerary with night stops", note: "hotel names if booked", icon: "ph:map-trifold" },
        { text: "School or company letter", note: "for school trips and staff tours", icon: "ph:buildings" },
      ],
    },
    areas: {
      title: "Group pickups across Lahore",
      intro: "Homes, schools, offices and hotels in every part of the city. Area guides:",
      linkLabel: (name) => `Vans and coasters in ${name}`,
    },
    routes: {
      title: "Popular group routes",
      intro: "Tours to the north and family trips to other cities, with drive times and road advice:",
      slugs: ["lahore-to-naran-kaghan", "lahore-to-hunza", "lahore-to-skardu", "lahore-to-swat", "lahore-to-murree", "lahore-to-islamabad"],
    },
    related: ["wedding-car-rental-lahore", "corporate-car-rental-lahore", "rent-a-car-with-driver-lahore", "lahore-airport-car-rental"],
    guides: ["lahore-to-northern-areas-road-trip-guide", "cost-to-rent-a-car-in-lahore"],
  },
};

/**
 * Pick the models for a service: catalog models that pass `select`, with the content's
 * recommendedModels slugs first (silently skipped when the live catalog does not have them),
 * then by `rank` or catalog order.
 *
 * A small range is shown as it is (the van page may honestly have only a Hiace and a Coaster):
 * padding it with unrelated cars would put hatchbacks under a "Vans and coasters" heading.
 * Only when NOTHING matches (e.g. a live catalog with different category slugs) does it fall back
 * to every model offering the right service type, with a build warning, so the page is never empty.
 */
export function pickModels(
  all: CatalogModel[],
  extra: ServiceExtra,
  preferred: readonly string[] = [],
  limit: number = extra.limit,
): CatalogModel[] {
  let pool = all.filter(extra.select);
  if (pool.length === 0) {
    const wantsSelf = extra.composer.serviceType === "self_drive";
    pool = all.filter((m) => (wantsSelf ? sd(m) : wd(m)));
    console.warn(`[services] No catalog model matches "${extra.label}". Showing all ${wantsSelf ? "self drive" : "with driver"} models instead.`);
  }
  const rank = extra.rank;
  const sorted = rank ? [...pool].sort((a, b) => rank(a) - rank(b)) : pool;
  const pinned = preferred.map((slug) => sorted.find((m) => m.slug === slug)).filter((m): m is CatalogModel => Boolean(m));
  const rest = sorted.filter((m) => !pinned.includes(m));
  return [...pinned, ...rest].slice(0, limit);
}

/**
 * The model as a CarCard should show it on a single-mode service page. CarCard headlines the
 * catalog's overall `fromPrice`, which is usually the self drive rate when a car has both, so the
 * with driver and airport grids would advertise self drive prices under "with driver" copy. For a
 * with driver or self drive page the card's headline becomes that mode's day rate (still a catalog
 * value), and CarCard labels it accordingly. "both" pages keep the catalog fromPrice.
 */
export function cardModelFor(m: CatalogModel, mode: ServiceType | "both"): CatalogModel {
  const daily = mode === "with_driver" ? wd(m)?.daily : mode === "self_drive" ? sd(m)?.daily : undefined;
  if (typeof daily !== "number" || daily === m.rates.fromPrice) return m;
  return { ...m, rates: { ...m.rates, fromPrice: daily } };
}

/** Every model that fits the service (same rules as pickModels, no limit): counts and the rate table. */
export function modelsForService(all: CatalogModel[], extra: ServiceExtra, preferred: readonly string[] = []): CatalogModel[] {
  return pickModels(all, extra, preferred, Number.POSITIVE_INFINITY);
}

export function getServiceExtra(slug: string): ServiceExtra {
  const extra = SERVICE_EXTRAS[slug as ServiceSlug];
  if (!extra) throw new Error(`[services] No service data for "${slug}". Add it to src/components/services/service-data.ts.`);
  return extra;
}
