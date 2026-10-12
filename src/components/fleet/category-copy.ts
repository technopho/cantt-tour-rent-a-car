/**
 * Unique copy for /cars/<category>/ pages, keyed by the catalog's category slugs
 * (hatchback, sedan, suv, luxury, wedding, van, coaster) with a generic fallback for new ones.
 *
 * Model names, seat counts and prices are computed from the catalog so the copy stays true when
 * staff change the fleet. Distances and drive times are approximate and phrased that way.
 * No em/en dashes (copy guard).
 */
import { TERMS } from "@/components/services/terms";
import type { CatalogCategory, CatalogModel } from "@/lib/catalog-types";
import { formatPKR } from "@/lib/format";
import type { FaqItem } from "@/lib/schema";
import {
  CITY_DAY_HOURS,
  carName,
  fitText,
  goesOutstation,
  hasFourWheelDrive,
  highest,
  joinAnd,
  lowest,
  offersDecoration,
  seatRange,
  singularName,
  softLower,
} from "./fleet-data";

export interface CategoryContent {
  /** Plural noun for UI copy, e.g. "SUVs". */
  noun: string;
  h1: string;
  /** Without the brand, <= 60 chars. */
  metaTitle: string;
  /** <= 155 chars. */
  metaDescription: string;
  intro: string;
  guideTitle: string;
  guide: string[];
  /** Service page slugs (site.services) to link as related services. */
  services: string[];
  /** Route slugs (site.routes) worth linking from this category. */
  routes: string[];
  /** Other category slugs to suggest ("compare with"). */
  compare: string[];
  faqs: FaqItem[];
}

interface Ctx {
  category: CatalogCategory;
  models: CatalogModel[];
  allModels: CatalogModel[];
  /** Short model names, featured first: ["Corolla Altis", "Civic", "City"]. */
  names: string[];
  /** Same order with the make: ["Toyota Corolla Altis", ...]. */
  fullNames: string[];
  from: number | null;
  wdMin: number | null;
  wdMax: number | null;
  sdMin: number | null;
  sdMax: number | null;
  selfDrive: CatalogModel[];
  withDriver: CatalogModel[];
  maxSeats: number;
  seats: string;
  isCheapestInFleet: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const fullNames = (models: readonly CatalogModel[]) => joinAnd(models.map(carName));
const shortNames = (models: readonly CatalogModel[]) => joinAnd(models.map((m) => m.model));
const isAre = (models: readonly CatalogModel[]) => plural(models.length, "is", "are");

/**
 * "Sedans on Rent in Lahore: Corolla Altis, Civic and City", the longest variant that fits 60 chars.
 * Tries more models first, full names (with make) before short ones, and a " with Driver" suffix
 * when every car in the category is driver-only.
 */
function titleWithNames(base: string, ctx: Pick<Ctx, "names" | "fullNames" | "selfDrive">): string {
  const suffix = ctx.selfDrive.length === 0 ? " with Driver" : "";
  const candidates: string[] = [];
  for (let n = Math.min(3, ctx.names.length); n >= 1; n--) {
    const full = joinAnd(ctx.fullNames.slice(0, n));
    const short = joinAnd(ctx.names.slice(0, n));
    if (suffix) candidates.push(`${base}: ${full}${suffix}`);
    candidates.push(`${base}: ${full}`);
    if (suffix) candidates.push(`${base}: ${short}${suffix}`);
    candidates.push(`${base}: ${short}`);
  }
  if (suffix) candidates.push(`${base}${suffix}`);
  candidates.push(base);
  return fitText(candidates, 60);
}

function selfDriveFaq(ctx: Ctx, noun: string): FaqItem {
  const depositFrom = lowest(ctx.selfDrive, (m) => m.rates.selfDrive?.securityDeposit);
  if (ctx.selfDrive.length === 0) {
    return {
      q: `Can I rent ${softLower(noun)} for self drive in Lahore?`,
      a: `Not at the moment. Our ${softLower(noun)} are rented with one of our drivers. If you want to drive yourself, see our self drive cars or ask us on WhatsApp for the closest option.`,
    };
  }
  return {
    q: `Can I rent ${softLower(noun)} for self drive in Lahore?`,
    a: `Yes. The ${fullNames(ctx.selfDrive)} ${isAre(ctx.selfDrive)} available for self drive from ${formatPKR(ctx.sdMin ?? 0)} per day${
      depositFrom ? `, with a refundable security deposit starting at ${formatPKR(depositFrom)}` : ""
    }. You need your CNIC (or passport if you are visiting from abroad) and a valid driving licence.`,
  };
}

function cheapestFaq(ctx: Ctx, singular: string): FaqItem | null {
  const cheapest = [...ctx.models].sort((a, b) => a.rates.fromPrice - b.rates.fromPrice)[0];
  if (!cheapest) return null;
  const basis = cheapest.rates.selfDrive?.daily === cheapest.rates.fromPrice ? " for self drive" : cheapest.rates.withDriver?.daily === cheapest.rates.fromPrice ? " with a driver" : "";
  return {
    q: `Which is the cheapest ${singular} to rent in Lahore?`,
    a: `The ${carName(cheapest)}, from ${formatPKR(cheapest.rates.fromPrice)} per day${basis}. Fuel, tolls and parking are paid separately. Every price is confirmed in writing before you book.`,
  };
}

function priceRangeFaq(ctx: Ctx, noun: string): FaqItem {
  const parts: string[] = [];
  if (ctx.wdMin) {
    parts.push(
      ctx.wdMax && ctx.wdMax !== ctx.wdMin
        ? `With a driver, a ${CITY_DAY_HOURS} hour city day costs ${formatPKR(ctx.wdMin)} to ${formatPKR(ctx.wdMax)}.`
        : `With a driver, a ${CITY_DAY_HOURS} hour city day costs ${formatPKR(ctx.wdMin)}.`,
    );
  }
  if (ctx.sdMin) {
    parts.push(
      ctx.sdMax && ctx.sdMax !== ctx.sdMin
        ? `Self drive costs ${formatPKR(ctx.sdMin)} to ${formatPKR(ctx.sdMax)} per day.`
        : `Self drive costs ${formatPKR(ctx.sdMin)} per day.`,
    );
  }
  return {
    q: `How much does it cost to rent ${softLower(noun)} in Lahore?`,
    a: `${noun} start at ${formatPKR(ctx.from ?? 0)} per day. ${parts.join(" ")} Fuel, motorway tolls and parking are extra.`,
  };
}

/**
 * "From" price for copy that promises a driver: the lowest with-driver day rate, so a self drive
 * rate is never shown next to driver wording. Falls back to the overall "from" price.
 */
function drivenFrom(ctx: Ctx): string {
  return formatPKR(ctx.wdMin ?? ctx.from ?? 0);
}

function buildCtx(category: CatalogCategory, models: CatalogModel[], allModels: CatalogModel[]): Ctx {
  const ordered = [...models].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
  const selfDrive = models.filter((m) => m.rates.selfDrive);
  const withDriver = models.filter((m) => m.rates.withDriver);
  const from = lowest(models, (m) => m.rates.fromPrice);
  const fleetFrom = lowest(allModels, (m) => m.rates.fromPrice);
  return {
    category,
    models,
    allModels,
    names: ordered.map((m) => m.model),
    fullNames: ordered.map(carName),
    from,
    wdMin: lowest(models, (m) => m.rates.withDriver?.daily),
    wdMax: highest(models, (m) => m.rates.withDriver?.daily),
    sdMin: lowest(models, (m) => m.rates.selfDrive?.daily),
    sdMax: highest(models, (m) => m.rates.selfDrive?.daily),
    selfDrive,
    withDriver,
    maxSeats: Math.max(0, ...models.map((m) => m.seats)),
    seats: seatRange(models) ?? "",
    isCheapestInFleet: from !== null && fleetFrom !== null && from <= fleetFrom,
  };
}

const serviceLine = (ctx: Ctx) =>
  ctx.selfDrive.length && ctx.withDriver.length ? "with driver or self drive" : ctx.withDriver.length ? "with a driver" : "for self drive";

/* ------------------------------------------------------------------------------------------ */

function hatchback(ctx: Ctx): CategoryContent {
  const noun = "Hatchbacks";
  const autos = ctx.models.filter((m) => m.transmission === "automatic");
  const from = formatPKR(ctx.from ?? 0);
  return {
    noun,
    h1: "Hatchbacks on rent in Lahore",
    metaTitle: titleWithNames("Hatchbacks on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `Rent a hatchback in Lahore from ${from}/day: ${fullNames(ctx.models)}. Easy to park, light on fuel, ${serviceLine(ctx)}.`,
        `Rent a hatchback in Lahore from ${from}/day. Easy to park, light on fuel, ${serviceLine(ctx)}.`,
      ],
      155,
    ),
    intro: `Small, easy to park and light on fuel. A hatchback is the quickest way through Lahore's stop and go traffic${
      ctx.isCheapestInFleet ? ", and the lowest priced car we rent" : ""
    }.`,
    guideTitle: "Is a hatchback right for your trip?",
    guide: [
      `Hatchbacks suit errands, office commutes and short hops across the city: Cantt to Liberty Market, Model Town to Anarkali, DHA to Packages Mall. They slip into tight parking where a sedan struggles${
        autos.length === ctx.models.length && autos.length > 0
          ? ", and every one we rent has an automatic gearbox, which makes the crawl on Ferozepur Road or Canal Road at rush hour far less tiring"
          : ""
      }.`,
      `Low running costs make them a sensible pick for self drive and monthly rentals.${
        ctx.sdMin ? ` Self drive starts at ${formatPKR(ctx.sdMin)} per day.` : ""
      }`,
      "Where a hatchback is not the best fit: four adults with airport luggage, long motorway days, or the hills beyond Murree. For those, a sedan or SUV gives you more boot space and comfort.",
    ],
    services: ["self-drive-car-rental-lahore", "monthly-car-rental-lahore", "rent-a-car-with-driver-lahore"],
    routes: ["lahore-to-sialkot"],
    compare: ["sedan", "suv"],
    faqs: [
      cheapestFaq(ctx, "hatchback"),
      selfDriveFaq(ctx, noun),
      {
        q: "Is a hatchback fine for a trip to Islamabad?",
        a: "For two or three people with light bags, yes. The M-2 is a smooth motorway, about 375 km and roughly 4 to 5 hours. With four adults and luggage, a sedan is more comfortable on a run that long.",
      },
      {
        q: "Do your hatchbacks have automatic gearboxes?",
        a:
          autos.length === ctx.models.length
            ? `Yes. The ${shortNames(ctx.models)} we rent ${plural(ctx.models.length, "is", "are all")} automatic, which makes stop and go traffic much easier.`
            : autos.length > 0
              ? `The ${shortNames(autos)} ${isAre(autos)} automatic. The others are manual. Tell us your preference when you ask for a quote.`
              : "Our hatchbacks are manual. If you need an automatic, ask us for a sedan.",
      },
    ].filter((f): f is FaqItem => f !== null),
  };
}

function sedan(ctx: Ctx): CategoryContent {
  const noun = "Sedans";
  const byPrice = [...ctx.models].sort((a, b) => a.rates.fromPrice - b.rates.fromPrice);
  const economy = byPrice.slice(0, 2);
  const top = byPrice[byPrice.length - 1];
  const executive = top && byPrice.length > 2 && top.rates.fromPrice >= (byPrice[0]?.rates.fromPrice ?? 0) * 1.4 ? top : null;
  const bags = highest(ctx.models, (m) => m.luggage);
  const airport = ctx.models.filter((m) => m.suitableFor.includes("airport"));
  const outstationFrom = lowest(ctx.models, (m) => m.rates.withDriver?.outstationDaily);
  return {
    noun,
    h1: "Sedans on rent in Lahore",
    metaTitle: titleWithNames("Sedans on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `Rent a sedan in Lahore: ${joinAnd(ctx.names.slice(0, 3))}. From ${formatPKR(ctx.from ?? 0)}/day, ${serviceLine(ctx)}, for airport runs, weddings and motorway trips.`,
        `Rent a sedan in Lahore from ${formatPKR(ctx.from ?? 0)}/day, ${serviceLine(ctx)}, for airport runs, weddings and motorway trips.`,
      ],
      155,
    ),
    intro: "The everyday choice for Lahore: air conditioned, quiet on the motorway and with a boot that takes airport luggage. Book one with a driver for functions and airport runs, or drive it yourself.",
    guideTitle: "Choosing a sedan in Lahore",
    guide: [
      `${economy.length ? `Economy sedans like the ${shortNames(economy)} are the sensible pick for airport runs, hospital visits and office use.` : ""}${
        executive ? ` The ${carName(executive)} adds a more premium cabin for corporate guests and wedding families.` : ""
      }`.trim(),
      `Allama Iqbal International Airport is about 15 minutes from Lahore Cantt and around 30 minutes from Gulberg in normal traffic.${
        bags ? ` A sedan's boot takes about ${bags} large suitcases, which covers most arrivals.` : ""
      }`,
      `On the motorway, a sedan is the most comfortable way to do Lahore to Islamabad (about 375 km, 4 to 5 hours on the M-2) or Sialkot on the M-11.${
        outstationFrom ? ` Outstation days with a driver start at ${formatPKR(outstationFrom)}.` : ""
      }`,
    ].filter(Boolean),
    services: [
      "rent-a-car-with-driver-lahore",
      "lahore-airport-car-rental",
      "self-drive-car-rental-lahore",
      "corporate-car-rental-lahore",
      "wedding-car-rental-lahore",
    ],
    routes: ["lahore-to-islamabad", "lahore-to-sialkot", "lahore-to-faisalabad"],
    compare: ["hatchback", "suv", "luxury"],
    faqs: [
      priceRangeFaq(ctx, noun),
      ...(airport.length
        ? [
            {
              q: "Which sedan is best for an airport pickup?",
              a: `The ${shortNames(airport)} ${isAre(airport)} all good airport cars${bags ? `, with boots that take about ${bags} large suitcases` : ""}. Share your flight number and we time the pickup to your arrival at Allama Iqbal International Airport.`,
            },
          ]
        : []),
      selfDriveFaq(ctx, noun),
      {
        q: "Can I take a sedan to Murree?",
        a: "Yes. Murree is about 6 hours from Lahore via the M-2 and the Murree Expressway, both smooth roads. For Naran, Hunza or Skardu we recommend an SUV for the extra ground clearance.",
      },
    ],
  };
}

function suv(ctx: Ctx): CategoryContent {
  const noun = "SUVs";
  const sevens = ctx.models.filter((m) => m.seats >= 7);
  const fours = ctx.models.filter(hasFourWheelDrive);
  const northern = fours.length ? fours : ctx.models.filter(goesOutstation);
  return {
    noun,
    h1: "SUVs on rent in Lahore",
    metaTitle: titleWithNames("SUVs on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `SUVs on rent in Lahore: ${joinAnd(ctx.names.slice(0, 3))}. ${ctx.seats}, with experienced drivers for Murree, Naran and Hunza. With driver from ${drivenFrom(ctx)}/day.`,
        `SUVs on rent in Lahore with experienced drivers for Murree, Naran and Hunza. ${ctx.seats}. With driver from ${drivenFrom(ctx)}/day.`,
      ],
      155,
    ),
    intro: "Higher seats, more luggage space and, on some models, four wheel drive. The car most families choose for Murree, Naran, Hunza and Skardu, and for arriving at a function in style.",
    guideTitle: "Picking an SUV for your trip",
    guide: [
      sevens.length
        ? `Need room for the whole family? The ${shortNames(sevens)} ${plural(sevens.length, "seats", "seat")} seven, so grandparents and children travel together in one car.`
        : "",
      fours.length
        ? `For the north, the ${shortNames(fours)} ${plural(fours.length, "has", "have")} four or all wheel drive. It helps on the climb past Balakot towards Naran, on wet roads around Murree and on the Karakoram Highway.`
        : "",
      "Lahore to Naran is roughly 10 to 12 hours of driving, and Hunza or Skardu take two days, so most families break the journey in Islamabad or Abbottabad. Our drivers do these routes often and know where to stop for fuel, food and the night.",
      "In the city, an SUV rides over speed breakers and broken patches with ease, which helps on patchy stretches of Raiwind Road and Bedian Road and in the newer housing schemes on the edge of Lahore.",
    ].filter(Boolean),
    services: ["rent-a-car-with-driver-lahore", "corporate-car-rental-lahore", "wedding-car-rental-lahore", "luxury-car-rental-lahore"],
    routes: ["lahore-to-murree", "lahore-to-naran-kaghan", "lahore-to-hunza", "lahore-to-skardu"],
    compare: ["sedan", "luxury", "van"],
    faqs: [
      {
        q: "Which SUV is best for a northern areas trip from Lahore?",
        a: northern.length
          ? `The ${fullNames(northern)}${fours.length ? `, thanks to ${plural(fours.length, "its", "their")} four or all wheel drive and high ground clearance` : ""}. Book with one of our drivers who knows the Karakoram Highway and the Naran valley roads.`
          : "Ask us on WhatsApp with your route and dates and we will suggest the right SUV.",
      },
      {
        q: "Do your SUVs come with a driver?",
        a: `${ctx.withDriver.length ? `The ${shortNames(ctx.withDriver)} ${isAre(ctx.withDriver)} available with a driver.` : ""}${
          ctx.selfDrive.length ? ` The ${shortNames(ctx.selfDrive)} can also be rented for self drive.` : " Our SUVs are rented with a driver only."
        }`.trim(),
      },
      {
        q: "How many people fit in an SUV?",
        a: `Our SUVs have ${ctx.seats}.${sevens.length ? ` The ${shortNames(sevens)} ${plural(sevens.length, "is a", "are")} 7 ${plural(sevens.length, "seater", "seaters")}, good for bigger families.` : ""} For 10 or more people, a van keeps everyone together.`,
      },
      {
        q: "How long does it take to drive from Lahore to Naran?",
        a: "About 10 to 12 hours depending on traffic and stops, via the M-2 to Islamabad and then the Hazara Motorway towards Mansehra and Balakot. Many families stop overnight in Islamabad or Abbottabad.",
      },
    ],
  };
}

function luxury(ctx: Ctx): CategoryContent {
  const noun = "Luxury cars";
  const weddingReady = ctx.models.filter((m) => m.suitableFor.includes("wedding"));
  return {
    noun,
    h1: "Luxury cars on rent in Lahore",
    metaTitle: titleWithNames("Luxury Cars on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `Luxury cars on rent in Lahore with professional drivers: ${joinAnd(ctx.names.slice(0, 3))}. For VIP guests, protocol duty and weddings. From ${drivenFrom(ctx)}/day.`,
        `Luxury cars on rent in Lahore with professional drivers, for VIP guests, protocol duty and weddings. From ${drivenFrom(ctx)}/day.`,
      ],
      155,
    ),
    intro: "Top of the range cars with professional drivers, for VIP guests, protocol duty, visiting delegations and family elders who deserve the most comfortable seat in the house.",
    guideTitle: "When a luxury car makes sense",
    guide: [
      "Arrivals at Allama Iqbal International Airport, transfers to hotels on The Mall and in Gulberg, and movement between meetings: a luxury car with a professional driver sets the right tone for important guests.",
      weddingReady.length
        ? `For weddings, the ${shortNames(weddingReady)} can lead the baraat or carry the couple's parents, and ${plural(weddingReady.length, "it looks", "they look")} right next to a decorated wedding car.`
        : "",
      ctx.selfDrive.length === 0
        ? "Every luxury car is booked with one of our experienced drivers, so you can focus on your guests instead of parking and directions."
        : `The ${shortNames(ctx.selfDrive)} can also be rented for self drive. The rest are booked with a driver.`,
      `Demand peaks in the wedding season from ${TERMS.weddingSeason} and around big events at the Expo Centre in Johar Town, so book early once your dates are fixed.`,
    ].filter(Boolean),
    services: ["luxury-car-rental-lahore", "corporate-car-rental-lahore", "wedding-car-rental-lahore", "lahore-airport-car-rental"],
    routes: ["lahore-to-islamabad", "lahore-to-murree"],
    compare: ["suv", "wedding", "sedan"],
    faqs: [
      {
        q: "How much does a luxury car cost per day in Lahore?",
        a: `From ${formatPKR(ctx.from ?? 0)} per day. ${ctx.models
          .map((m) => `The ${carName(m)} is ${formatPKR(m.rates.withDriver?.daily ?? m.rates.fromPrice)}${m.rates.withDriver ? ` per ${CITY_DAY_HOURS} hour city day with a driver` : " per day"}.`)
          .join(" ")} Overtime and outstation rates are listed on each car's page.`,
      },
      selfDriveFaq(ctx, noun),
      {
        q: "Can a luxury car meet a guest at Lahore airport?",
        a: "Yes. Share the flight number and we time the pickup to the arrival at Allama Iqbal International Airport. The airport is about 15 minutes from Lahore Cantt and about 30 minutes from Gulberg in normal traffic.",
      },
      ...(weddingReady.length
        ? [
            {
              q: "Can I book a luxury car for a wedding?",
              a: `Yes. The ${fullNames(weddingReady)} ${isAre(weddingReady)} popular for the baraat and for carrying close family. Tell us the venue and timings for each function in your quote.`,
            },
          ]
        : []),
    ],
  };
}

function wedding(ctx: Ctx): CategoryContent {
  const noun = "Wedding cars";
  const decor = ctx.models.some(offersDecoration);
  const lead = [...ctx.models].sort((a, b) => b.rates.fromPrice - a.rates.fromPrice)[0];
  const ot = lead?.rates.withDriver?.overtimeHourly ?? null;
  return {
    noun,
    h1: "Wedding cars on rent in Lahore",
    metaTitle: titleWithNames("Wedding Cars on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `Wedding cars on rent in Lahore: ${fullNames(ctx.models)}, with an experienced driver for mehndi, baraat and walima. From ${drivenFrom(ctx)}/day.`,
        `Wedding cars on rent in Lahore with an experienced driver for mehndi, baraat and walima. From ${drivenFrom(ctx)}/day.`,
      ],
      155,
    ),
    intro: `A car for the couple that looks right in the photos, with a driver who knows the way to every marquee on Ferozepur Road and Raiwind Road.${
      decor ? " Decoration can be arranged on request." : ""
    }`,
    guideTitle: "Planning wedding cars in Lahore",
    guide: [
      "Most families book the wedding car for the baraat and rukhsati, then again for the walima. Share the venue, the pickup point and the timings for each function, and we plan the day around them.",
      `Functions in Lahore often run late.${
        ot && lead ? ` If the baraat is delayed, overtime on the ${carName(lead)} is ${formatPKR(ot)} per hour, so it is worth agreeing the hours in advance.` : " Agree the hours in advance so the car stays as long as you need it."
      }`,
      "For the rest of the family, matching sedans and a van or coaster for guests keep everyone moving together and arriving at the same time.",
      `${TERMS.weddingPeakDays} dates in the ${TERMS.weddingSeason} wedding season are the busiest for Lahore's marquees and for our wedding cars, so book as soon as your dates are fixed.`,
    ],
    services: ["wedding-car-rental-lahore", "luxury-car-rental-lahore", "van-coaster-rental-lahore"],
    routes: [],
    compare: ["luxury", "sedan", "van", "coaster"],
    faqs: [
      {
        q: "How early should I book a wedding car in Lahore?",
        a: `As soon as your dates are fixed. ${TERMS.weddingPeakDays} dates in the ${TERMS.weddingSeason} wedding season fill up first, so booking a few weeks ahead is sensible.`,
      },
      {
        q: "Is decoration included with the wedding car?",
        a: decor
          ? "Decoration can be arranged on request. Tell us the colours and flowers you have in mind and we will share the options and the price in your quote."
          : "Tell us what you have in mind when you ask for a quote and we will tell you what is possible.",
      },
      {
        q: "What if the function runs late?",
        a: ot
          ? `The car stays with you. Time beyond the booked hours is charged as overtime, ${formatPKR(ot)} per hour for the ${lead ? carName(lead) : "wedding car"}.`
          : "The car stays with you. Time beyond the booked hours is charged as overtime at the hourly rate in your quote.",
      },
      {
        q: "Can I book cars for the whole baraat?",
        a: "Yes. Combine the wedding car with matching sedans for close family and a van or coaster for guests. Send us the number of guests and we will suggest a mix.",
      },
    ],
  };
}

function van(ctx: Ctx): CategoryContent {
  const noun = "Vans";
  const roof = ctx.models.some((m) => m.features.some((f) => /roof/i.test(f)));
  const north = ctx.models.filter(goesOutstation);
  return {
    noun,
    h1: "Vans on rent in Lahore",
    metaTitle: titleWithNames("Vans on Rent in Lahore", ctx),
    metaDescription: fitText(
      [
        `Vans on rent in Lahore: ${fullNames(ctx.models)}, up to ${ctx.maxSeats} seats with driver for family tours, airport pickups and wedding guests. From ${drivenFrom(ctx)}/day.`,
        `Vans on rent in Lahore, up to ${ctx.maxSeats} seats with driver for family tours, airport pickups and wedding guests. From ${drivenFrom(ctx)}/day.`,
      ],
      155,
    ),
    intro: `Up to ${ctx.maxSeats} seats and space for luggage. One van keeps the whole family or team together, from the airport arrivals hall to a week in the north.`,
    guideTitle: "What a van is good for",
    guide: [
      `Families flying in from abroad often land with a lot of luggage. A van meets them at Allama Iqbal International Airport with room for everyone and every suitcase${
        roof ? ", plus a roof carrier for the overflow" : ""
      }.`,
      "For tours to Murree, Naran or Swat, one van with one driver is simpler than a convoy of cars, and you pay motorway tolls for one vehicle instead of several.",
      "Offices use vans for staff pickup routes, for example from Johar Town and Township to Gulberg or the Kot Lakhpat industrial area. Ask us about rates for regular routes.",
      ctx.selfDrive.length === 0 ? "Vans are always booked with one of our drivers, who handles parking and the route while your group relaxes." : "",
    ].filter(Boolean),
    services: ["van-coaster-rental-lahore", "lahore-airport-car-rental", "wedding-car-rental-lahore", "corporate-car-rental-lahore"],
    routes: ["lahore-to-murree", "lahore-to-naran-kaghan", "lahore-to-swat", "lahore-to-islamabad"],
    compare: ["coaster", "suv"],
    faqs: [
      {
        q: "How many people fit in a van?",
        a: `${ctx.models.map((m) => `The ${carName(m)}${m.variant ? ` ${m.variant}` : ""} seats ${m.seats}.`).join(" ")} For bigger groups, a coaster or a second van keeps everyone together.`,
      },
      {
        q: "Is a driver included with the van?",
        a:
          ctx.selfDrive.length === 0
            ? `Yes. Vans are rented with one of our drivers. A city day covers up to ${CITY_DAY_HOURS} hours within Lahore.`
            : `The ${shortNames(ctx.selfDrive)} can be rented for self drive. The others come with a driver.`,
      },
      {
        q: "Can the van pick up from several homes?",
        a: "Yes. List the pickup points in your quote and we plan the route and timing, for example collecting relatives in Model Town and Garden Town before heading to the venue.",
      },
      {
        q: "Can we take the van to the northern areas?",
        a: north.length
          ? `Yes. The ${shortNames(north)} ${isAre(north)} regularly booked for Murree and Naran tours with our drivers. A night allowance applies for each night the driver stays away from Lahore.`
          : "Tell us your route and dates and we will confirm the best option for the trip.",
      },
    ],
  };
}

function coaster(ctx: Ctx): CategoryContent {
  const noun = "Coasters";
  const night = lowest(ctx.models, (m) => m.rates.driverNightAllowance);
  return {
    noun,
    h1: "Coasters on rent in Lahore",
    metaTitle: fitText(
      [`Coaster on Rent in Lahore: ${ctx.maxSeats} Seater with Driver`, "Coaster on Rent in Lahore for Groups and Tours"],
      60,
    ),
    metaDescription: fitText(
      [
        `Coaster on rent in Lahore with an experienced driver. Up to ${ctx.maxSeats} seats for baraat guests, school trips, staff transport and tours. From ${drivenFrom(ctx)}/day.`,
        `Coaster on rent in Lahore with an experienced driver, for baraat guests, school trips and tours. From ${drivenFrom(ctx)}/day.`,
      ],
      155,
    ),
    intro: `Seats for up to ${ctx.maxSeats} passengers in one vehicle, with an experienced driver. For baraat guests, school and university trips, factory staff and group tours.`,
    guideTitle: "Moving a big group around Lahore",
    guide: [
      "A coaster moves a whole baraat in one go, which keeps guests together and makes arrival at the marquee far easier to manage than a line of cars.",
      "Schools, colleges and universities book coasters for trips to Lahore Fort, Badshahi Mosque, Minar-e-Pakistan and the Wagah border ceremony, and for longer tours to Islamabad and Murree.",
      "Coasters need space to park and turn. Share the venue and pickup addresses so we can plan the stops, especially around the narrow streets of the old city.",
    ],
    services: ["van-coaster-rental-lahore", "wedding-car-rental-lahore", "corporate-car-rental-lahore"],
    routes: ["lahore-to-islamabad", "lahore-to-murree"],
    compare: ["van"],
    faqs: [
      {
        q: "How many seats does the coaster have?",
        a: `${ctx.models.map((m) => `The ${carName(m)} has ${m.seats} seats.`).join(" ")} For more people, add a van or a second coaster.`,
      },
      {
        q: "Can a coaster go to Murree?",
        a: "Yes, with our driver. Large vehicles can face restrictions on some Murree roads in peak season, so we plan drop off and parking points with you in advance.",
      },
      {
        q: "Is there a charge for the driver's night stay?",
        a: night
          ? `Yes. On trips with overnight stays, a driver night allowance from ${formatPKR(night)} is added for each night away from Lahore.`
          : "On trips with overnight stays, a driver night allowance is added. We confirm it in your quote.",
      },
      {
        q: "Can we book a coaster for a single function?",
        a: `Yes. Book it for the day of the baraat or walima and tell us the pickup points and timings. A city day covers up to ${CITY_DAY_HOURS} hours within Lahore.`,
      },
    ],
  };
}

function generic(ctx: Ctx): CategoryContent {
  const name = ctx.category.name;
  return {
    noun: name,
    h1: `${name} on rent in Lahore`,
    metaTitle: titleWithNames(`${name} on Rent in Lahore`, ctx),
    metaDescription: fitText(
      [
        `${name} on rent in Lahore: ${joinAnd(ctx.names.slice(0, 3))}. From ${formatPKR(ctx.from ?? 0)}/day, ${serviceLine(ctx)}. Get a quote on WhatsApp.`,
        `${name} on rent in Lahore from ${formatPKR(ctx.from ?? 0)}/day, ${serviceLine(ctx)}.`,
      ],
      155,
    ),
    intro: ctx.category.description || `${name} for trips in and around Lahore, ${serviceLine(ctx)}.`,
    guideTitle: `About our ${softLower(name)}`,
    guide: [
      `${ctx.category.description} Every car is cleaned before handover and booked with a clear written quote.`.trim(),
    ],
    services: ["rent-a-car-with-driver-lahore", "self-drive-car-rental-lahore"],
    routes: [],
    compare: [],
    faqs: [cheapestFaq(ctx, softLower(singularName(name))), priceRangeFaq(ctx, name), selfDriveFaq(ctx, name)].filter(
      (f): f is FaqItem => f !== null,
    ),
  };
}

const BUILDERS: Record<string, (ctx: Ctx) => CategoryContent> = { hatchback, sedan, suv, luxury, wedding, van, coaster };

/** Copy for a category page. `models` = this category's models, `allModels` = the whole fleet. */
export function categoryContent(category: CatalogCategory, models: CatalogModel[], allModels: CatalogModel[]): CategoryContent {
  const ctx = buildCtx(category, models, allModels);
  return (BUILDERS[category.slug] ?? generic)(ctx);
}

/** Short anchor text for links to a category page, e.g. "SUVs on rent in Lahore". */
export function categoryLinkText(category: CatalogCategory): string {
  const known: Record<string, string> = {
    hatchback: "Hatchbacks on rent in Lahore",
    sedan: "Sedans on rent in Lahore",
    suv: "SUVs on rent in Lahore",
    luxury: "Luxury cars on rent in Lahore",
    wedding: "Wedding cars on rent in Lahore",
    van: "Vans on rent in Lahore",
    coaster: "Coasters on rent in Lahore",
  };
  return known[category.slug] ?? `${category.name} on rent in Lahore`;
}
