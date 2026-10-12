/**
 * Fleet page helpers (build time only): use-case labels, availability, route-collision guard,
 * SEO title builders, per-model FAQs and "best for" copy.
 *
 * Prices are never written here: every amount comes from the catalog and is formatted with
 * formatPKR(). Business facts come from site.ts. Drive times are approximate and phrased that way.
 */
import { TERMS } from "@/components/services/terms";
import { site } from "@/config/site";
import type { CatalogCategory, CatalogModel } from "@/lib/catalog-types";
import { formatPKR, formatNumber } from "@/lib/format";
import type { FaqItem } from "@/lib/schema";
import { urls } from "@/lib/urls";

/** A "city day" with a driver (owner confirmed scope for the fleet pages). Defined in terms.ts. */
export const CITY_DAY_HOURS = TERMS.cityDayHours;

/* ------------------------------------------------------------------------------------------ */
/* Small text helpers                                                                           */
/* ------------------------------------------------------------------------------------------ */

/** ["a"] -> "a", ["a","b"] -> "a and b", ["a","b","c"] -> "a, b and c". */
export function joinAnd(items: readonly string[], word = "and"): string {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} ${word} ${list[list.length - 1]}`;
}

/** First candidate that fits `max` characters (SEO titles and descriptions). */
export function fitText(candidates: readonly string[], max: number): string {
  const found = candidates.find((c) => c.length <= max);
  if (found) return found;
  const last = candidates[candidates.length - 1] ?? "";
  const cut = last.slice(0, max - 3);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,.;:]+$/, "")}...`;
}

/** Lower-case the first letter for mid-sentence use, keeping acronyms: "Wedding cars" -> "wedding cars", "SUVs" stays. */
export function softLower(text: string): string {
  return /^[A-Z]{2,}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Toyota Corolla Altis" */
export function carName(model: Pick<CatalogModel, "make" | "model">): string {
  return `${model.make} ${model.model}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Use cases (catalog suitableFor tags)                                                         */
/* ------------------------------------------------------------------------------------------ */

export interface UseCase {
  tag: string;
  /** Chip label, e.g. "Airport runs". */
  label: string;
  /** Mid-sentence phrase, e.g. "airport runs", "monthly rental". */
  phrase: string;
  icon: string;
  /** Where this use case is explained (service or route hub). */
  href: string;
  /** Descriptive anchor text for that link. */
  linkLabel: string;
}

const USE_CASES: Record<string, Omit<UseCase, "tag">> = {
  airport: {
    label: "Airport runs",
    phrase: "airport runs",
    icon: "ph:airplane-tilt",
    href: urls.service("lahore-airport-car-rental"),
    linkLabel: "Lahore airport pick and drop",
  },
  wedding: {
    label: "Weddings",
    phrase: "weddings",
    icon: "ph:sparkle",
    href: urls.service("wedding-car-rental-lahore"),
    linkLabel: "Wedding car rental in Lahore",
  },
  outstation: {
    label: "Outstation",
    phrase: "outstation trips",
    icon: "ph:mountains",
    href: urls.routes(),
    linkLabel: "Outstation trips from Lahore",
  },
  corporate: {
    label: "Corporate",
    phrase: "corporate use",
    icon: "ph:briefcase",
    href: urls.service("corporate-car-rental-lahore"),
    linkLabel: "Corporate car rental in Lahore",
  },
  monthly: {
    label: "Monthly",
    phrase: "monthly rental",
    icon: "ph:calendar-check",
    href: urls.service("monthly-car-rental-lahore"),
    linkLabel: "Monthly car rental in Lahore",
  },
  self_drive: {
    label: "Self drive",
    phrase: "self drive",
    icon: "ph:key",
    href: urls.service("self-drive-car-rental-lahore"),
    linkLabel: "Self drive car rental in Lahore",
  },
  family: {
    label: "Family trips",
    phrase: "family outings",
    icon: "ph:users-three",
    href: urls.service("rent-a-car-with-driver-lahore"),
    linkLabel: "Rent a car with driver in Lahore",
  },
};

/** Display order for chips and "best for" lists. */
const USE_CASE_ORDER = ["airport", "wedding", "outstation", "family", "corporate", "monthly", "self_drive"];

export function useCase(tag: string): UseCase {
  const known = USE_CASES[tag];
  if (known) return { tag, ...known };
  const label = tag.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { tag, label, phrase: label.toLowerCase(), icon: "ph:check-circle", href: urls.cars(), linkLabel: "Cars for rent in Lahore" };
}

/** The model's suitableFor tags as use cases, in a stable order, without duplicates. */
export function modelUseCases(model: Pick<CatalogModel, "suitableFor">): UseCase[] {
  const tags = [...new Set(model.suitableFor)];
  tags.sort((a, b) => {
    const ia = USE_CASE_ORDER.indexOf(a);
    const ib = USE_CASE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return tags.map(useCase);
}

/* ------------------------------------------------------------------------------------------ */
/* Availability and model facts                                                                 */
/* ------------------------------------------------------------------------------------------ */

export function offersDriver(model: Pick<CatalogModel, "rates">): boolean {
  return model.rates.withDriver !== null;
}
export function offersSelfDrive(model: Pick<CatalogModel, "rates">): boolean {
  return model.rates.selfDrive !== null;
}

/** "With driver or self drive" | "With driver only" | "Self drive only". */
export function availabilityLabel(model: Pick<CatalogModel, "rates">): string {
  if (offersDriver(model) && offersSelfDrive(model)) return "With driver or self drive";
  return offersDriver(model) ? "With driver only" : "Self drive only";
}

/** Which rate the "from" price is (for the small caption under it), or null when unclear. */
export function fromPriceBasis(model: Pick<CatalogModel, "rates">): "self drive" | "with driver" | null {
  const r = model.rates;
  if (r.selfDrive && r.selfDrive.daily === r.fromPrice) return "self drive";
  if (r.withDriver && r.withDriver.daily === r.fromPrice) return "with driver";
  return null;
}

const FOUR_BY_FOUR = /four wheel|all wheel|4x4|4wd|awd/i;

/** Four or all wheel drive, from the staff-written feature list or variant. */
export function hasFourWheelDrive(model: Pick<CatalogModel, "features" | "variant">): boolean {
  return model.features.some((f) => FOUR_BY_FOUR.test(f)) || FOUR_BY_FOUR.test(model.variant ?? "");
}

/** "all" or "four" (as in "all wheel drive") for cars that drive both axles, null otherwise. */
export function driveLabel(model: Pick<CatalogModel, "features" | "variant">): "all" | "four" | null {
  if (!hasFourWheelDrive(model)) return null;
  return /all wheel|awd/i.test(`${model.features.join(" ")} ${model.variant ?? ""}`) ? "all" : "four";
}

export function offersDecoration(model: Pick<CatalogModel, "features" | "description">): boolean {
  return model.features.some((f) => /decorat/i.test(f)) || /decorat/i.test(model.description);
}

export function goesOutstation(model: Pick<CatalogModel, "rates" | "suitableFor">): boolean {
  return model.suitableFor.includes("outstation") || Boolean(model.rates.withDriver?.outstationDaily);
}

/** Lowest value of a rate across models, ignoring missing ones. */
export function lowest(models: readonly CatalogModel[], pick: (m: CatalogModel) => number | null | undefined): number | null {
  const values = models.map(pick).filter((v): v is number => typeof v === "number" && v > 0);
  return values.length ? Math.min(...values) : null;
}

export function highest(models: readonly CatalogModel[], pick: (m: CatalogModel) => number | null | undefined): number | null {
  const values = models.map(pick).filter((v): v is number => typeof v === "number" && v > 0);
  return values.length ? Math.max(...values) : null;
}

/** "4 to 7 seats" or "7 seats". */
export function seatRange(models: readonly CatalogModel[]): string | null {
  if (models.length === 0) return null;
  const min = Math.min(...models.map((m) => m.seats));
  const max = Math.max(...models.map((m) => m.seats));
  return min === max ? `${max} seats` : `${min} to ${max} seats`;
}

/** "Sedans" -> "Sedan", "Wedding cars" -> "Wedding car", "SUVs" -> "SUV", "Luxury" stays. For one car's badge. */
export function singularName(name: string): string {
  return /[^s]s$/i.test(name) ? name.slice(0, -1) : name;
}

/** Category name lookup with a readable fallback for unknown slugs. */
export function categoryLabel(slug: string, categories: readonly CatalogCategory[]): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------------------------------ */
/* Route guard: /cars/<category>/ and /cars/<model>/ share one URL space                        */
/* ------------------------------------------------------------------------------------------ */

/**
 * Fails the build when a model slug equals a category slug, because both would render at
 * /cars/<slug>/. Called from both dynamic routes' getStaticPaths.
 */
export function assertNoFleetSlugCollisions(models: readonly CatalogModel[], categories: readonly CatalogCategory[]): void {
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const clashes = models.map((m) => m.slug).filter((slug) => categorySlugs.has(slug));
  if (clashes.length > 0) {
    throw new Error(
      `[fleet] Model slug(s) "${clashes.join('", "')}" equal a category slug, so /cars/<slug>/ would collide. ` +
        "Rename the model slug (or the category slug) in the control panel and publish again.",
    );
  }
}

/* ------------------------------------------------------------------------------------------ */
/* SEO for model pages                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Title without the brand (the layout appends it), <= 60 characters. */
export function modelMetaTitle(model: CatalogModel): string {
  if (model.seoTitle && model.seoTitle.trim().length >= 10) return fitText([model.seoTitle.trim()], 60);
  const name = carName(model);
  const both = offersDriver(model) && offersSelfDrive(model);
  return fitText(
    [
      both ? `${name} on Rent in Lahore, With Driver or Self Drive` : "",
      both ? `${name} on Rent in Lahore, Driver or Self Drive` : "",
      offersDriver(model) ? `${name} on Rent in Lahore with Driver` : `${name} Self Drive Rental in Lahore`,
      `${name} on Rent in Lahore`,
      `${model.model} on Rent in Lahore`,
    ].filter(Boolean),
    60,
  );
}

/** Meta description, <= 155 characters, prices from the catalog. */
export function modelMetaDescription(model: CatalogModel, categoryName: string): string {
  if (model.seoDescription && model.seoDescription.trim().length >= 50) return fitText([model.seoDescription.trim()], 155);
  const name = carName(model);
  const from = formatPKR(model.rates.fromPrice);
  const service = offersDriver(model) && offersSelfDrive(model) ? "with driver or self drive" : offersDriver(model) ? "with a driver" : "for self drive";
  const uses = modelUseCases(model)
    .filter((u) => u.tag !== "self_drive")
    .slice(0, 3)
    .map((u) => u.phrase);
  const usesText = uses.length ? ` For ${joinAnd(uses)}.` : "";
  return fitText(
    [
      `Rent the ${name} in Lahore ${service}, from ${from}/day. ${model.seats} seats, ${model.transmission}.${usesText} Get a quote on WhatsApp.`,
      `Rent the ${name} in Lahore ${service}, from ${from}/day. ${model.seats} seats, ${model.transmission}.${usesText}`,
      `Rent the ${name} in Lahore ${service}, from ${from}/day. ${model.seats} seat ${softLower(singularName(categoryName))}, ${model.transmission}.`,
      `${name} on rent in Lahore from ${from}/day, ${service}.`,
    ],
    155,
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Per-model copy                                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface BestForItem extends UseCase {
  text: string;
}

/** Short, model-specific sentences for each suitableFor tag (Lahore specifics, approximate times). */
export function bestFor(model: CatalogModel): BestForItem[] {
  const name = model.model;
  const r = model.rates;
  return modelUseCases(model).map((u) => {
    let text: string;
    switch (u.tag) {
      case "airport":
        text = `Allama Iqbal International Airport (LHE) is about 15 minutes from Lahore Cantt in normal traffic.${
          model.luggage ? ` The ${name} takes about ${model.luggage} large ${model.luggage === 1 ? "suitcase" : "suitcases"}.` : ""
        } Share your flight number and we time the pickup to your arrival.`;
        break;
      case "wedding":
        text = `Mehndi, baraat and walima, with a driver who knows the marquees on Ferozepur Road, Raiwind Road and in DHA.${
          offersDecoration(model) ? " Decoration can be arranged on request." : ""
        }`;
        break;
      case "outstation":
        text = hasFourWheelDrive(model)
          ? `Built for long climbs to Murree, Naran, Hunza and Skardu, with ${driveLabel(model)} wheel drive for steep or wet stretches.`
          : model.seats >= 10
            ? `Group tours on the M-2 to Islamabad and Murree, with room for everyone's bags.`
            : `Steady on the M-2 to Islamabad (about 375 km) and the M-11 to Sialkot.${r.withDriver?.outstationDaily ? ` Outstation days are ${formatPKR(r.withDriver.outstationDaily)} with a driver.` : ""}`;
        break;
      case "corporate":
        text = `Client pickups, visiting teams and meetings in Gulberg, on MM Alam Road or at Arfa Software Technology Park on Ferozepur Road.`;
        break;
      case "monthly": {
        const monthly = r.selfDrive?.monthly ?? r.withDriver?.monthly ?? null;
        text = `Keep it for a month for office commutes or a long stay in Lahore.${monthly ? ` Monthly rates start at ${formatPKR(monthly)}.` : ""}`;
        break;
      }
      case "self_drive":
        text = r.selfDrive
          ? `Drive it yourself from ${formatPKR(r.selfDrive.daily)}/day${
              r.selfDrive.securityDeposit ? `, with a refundable deposit of ${formatPKR(r.selfDrive.securityDeposit)}` : ""
            }. Bring your CNIC or passport and a valid driving licence.`
          : `Ask us about self drive options for this car.`;
        break;
      case "family":
        text = `${model.seats} seats for family days out, hospital visits and trips to relatives across Lahore, from Cantt to Johar Town.`;
        break;
      default:
        text = `A good match for ${u.phrase} in and around Lahore.`;
    }
    return { ...u, text };
  });
}

export interface ModelFaqContext {
  /** An SUV to suggest for the northern areas when this car is not ideal there. */
  northernPick?: CatalogModel | null;
}

/** Model-specific FAQs generated from catalog data (prices from the catalog only). */
export function modelFaqs(model: CatalogModel, ctx: ModelFaqContext = {}): FaqItem[] {
  const name = carName(model);
  const short = model.model;
  const r = model.rates;
  const wd = r.withDriver;
  const sd = r.selfDrive;
  const faqs: FaqItem[] = [];

  faqs.push({
    q: `Is fuel included in the ${name} rent?`,
    a: `Not in the ${short} rates shown here. Fuel, motorway tolls and parking are paid separately.${
      wd ? ` With a driver, fuel is ${TERMS.fuelWithDriver}.` : ""
    }${sd ? ` For self drive, the fuel rule is ${TERMS.fuelSelfDrive}.` : ""} Anything extra is written in your quote before you confirm, so there are no surprises on the day.`,
  });

  if (sd) {
    const parts = [`${formatPKR(sd.daily)} per day`];
    if (sd.weekly) parts.push(`${formatPKR(sd.weekly)} per week`);
    if (sd.monthly) parts.push(`${formatPKR(sd.monthly)} per month`);
    faqs.push({
      q: `Can I drive the ${name} myself?`,
      a: `Yes. Self drive is ${joinAnd(parts, "or")}.${
        sd.securityDeposit ? ` A refundable security deposit of ${formatPKR(sd.securityDeposit)} is taken at handover.` : ""
      }${sd.kmPerDay ? ` The rate includes ${formatNumber(sd.kmPerDay)} km per day.` : ""} Bring your CNIC (or passport if you are visiting from abroad) and a valid driving licence.`,
    });
  } else {
    faqs.push({
      q: `Can I drive the ${name} myself?`,
      a: `No. The ${short} is only rented with one of our drivers. If you want to drive yourself, see our self drive cars, or ask us on WhatsApp for the closest option.`,
    });
  }

  // Outstation / northern areas.
  const four = hasFourWheelDrive(model);
  const drive = driveLabel(model);
  const nightLine = wd && r.driverNightAllowance ? ` A driver night allowance of ${formatPKR(r.driverNightAllowance)} is added for each night away from Lahore.` : "";
  if (!goesOutstation(model)) {
    faqs.push({
      q: `Can I take the ${short} to Murree or the northern areas?`,
      a: `The ${short} is kept for trips within Lahore, so it is not offered for outstation travel.${
        ctx.northernPick ? ` For Murree or the north, the ${carName(ctx.northernPick)} is a better fit.` : ""
      } Tell us your route and we will suggest the right car.`,
    });
  } else if (four || model.category === "suv" || model.category === "luxury") {
    faqs.push({
      q: `Can I take the ${short} to Murree or the northern areas?`,
      a: `Yes. The ${short} handles Murree, Naran, Hunza and Skardu well${drive ? `, and its ${drive} wheel drive helps on steep or wet stretches` : ""}.${
        wd?.outstationDaily ? ` Outstation days are ${formatPKR(wd.outstationDaily)} with a driver.` : ""
      }${nightLine} Babusar Pass usually opens only in summer, so we plan the route with you before you leave.`,
    });
  } else if (model.seats >= 10) {
    faqs.push({
      q: `Can I take the ${short} to Murree or the northern areas?`,
      a: `Yes, with our driver.${wd?.outstationDaily ? ` Outstation days are ${formatPKR(wd.outstationDaily)}.` : ""}${nightLine} Large vehicles can face restrictions on some Murree roads in peak season, so we plan drop off and parking points with you in advance.`,
    });
  } else {
    faqs.push({
      q: `Can I take the ${short} to Murree or the northern areas?`,
      a: `Yes for Murree and Islamabad, which are smooth motorway and expressway drives from Lahore.${
        wd?.outstationDaily ? ` Outstation days are ${formatPKR(wd.outstationDaily)} with a driver.` : ""
      }${nightLine} For Naran, Hunza or Skardu with a full car and luggage, we recommend ${
        ctx.northernPick ? `an SUV such as the ${carName(ctx.northernPick)}` : "an SUV"
      } for the extra ground clearance.`,
    });
  }

  if (wd) {
    faqs.push({
      q: `How long is a day with the ${short} and a driver?`,
      a: `A city day is up to ${CITY_DAY_HOURS} hours within Lahore, for example ${TERMS.cityDayWindow}, at ${formatPKR(wd.daily)}. ${
        wd.overtimeHourly ? `Extra hours are ${formatPKR(wd.overtimeHourly)} per hour.` : "Extra hours are charged at an hourly rate we confirm in your quote."
      }`,
    });
  }

  faqs.push({
    q: `How many people and bags fit in the ${name}?`,
    a: `The ${short} is a ${model.seats} seater${
      model.luggage ? ` with space for about ${model.luggage} large ${model.luggage === 1 ? "suitcase" : "suitcases"}` : ""
    }. If you are travelling with more people or bags, we can suggest a bigger car or add a second one.`,
  });

  if (model.suitableFor.includes("wedding")) {
    faqs.push({
      q: `Can I book the ${short} for a wedding?`,
      a: `Yes. Book it for the mehndi, baraat or walima and tell us the venue and timings.${
        offersDecoration(model) ? " Decoration can be arranged on request." : ""
      }${wd?.overtimeHourly ? ` If the function runs late, overtime is ${formatPKR(wd.overtimeHourly)} per hour.` : ""}`,
    });
  } else if (model.suitableFor.includes("airport")) {
    faqs.push({
      q: `Can the ${short} pick me up from Lahore airport?`,
      a: `Yes. Share your flight number and we time the pickup to your arrival at Allama Iqbal International Airport. From the airport it is about 15 to 20 minutes to Lahore Cantt or DHA and about 30 minutes to Gulberg in normal traffic.`,
    });
  }

  const wdMonthly = wd?.monthly ?? null;
  const sdMonthly = sd?.monthly ?? null;
  if (wdMonthly || sdMonthly) {
    const parts: string[] = [];
    if (wdMonthly) parts.push(`${formatPKR(wdMonthly)} per month with a driver`);
    if (sdMonthly) parts.push(`${formatPKR(sdMonthly)} per month for self drive`);
    faqs.push({
      q: `Is there a monthly rate for the ${short}?`,
      a: `Yes: ${joinAnd(parts)}. Monthly bookings suit office use, long family visits and overseas Pakistanis staying for the season.`,
    });
  }

  return faqs.slice(0, 7);
}

/** WhatsApp prefill for a model page (same wording as links.whatsappForModel). */
export function modelWhatsappMessage(model: CatalogModel): string {
  return `Assalam o Alaikum! I'd like a quote for the ${carName(model)}.`;
}

/** Payment methods sentence from site.ts. */
export function paymentMethodsText(): string {
  return joinAnd([...site.paymentAccepted]);
}
