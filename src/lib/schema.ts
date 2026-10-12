/**
 * JSON-LD builders (schema.org). Render with <JsonLd data={...} />.
 * Every node links to the business via BUSINESS_ID so Google can merge the graph.
 *
 * Rules (ARCHITECTURE.md): no AggregateRating / Review on our own pages, no vehicle sale
 * listings (rental offers use businessFunction LeaseOut), facts only from site.ts and the catalog.
 */
import { SITE_URL, formatAddress, site, socialLinks, type DayCode } from "@/config/site";
import type { CatalogModel } from "@/lib/catalog-types";
import { mapsUrl } from "@/lib/links";
import { absoluteUrl } from "@/lib/urls";

type Json = Record<string, unknown>;

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
const CONTEXT = "https://schema.org";
const LEASE_OUT = "http://purl.org/goodrelations/v1#LeaseOut";

const DAY_URI: Record<DayCode, string> = {
  Mo: "https://schema.org/Monday",
  Tu: "https://schema.org/Tuesday",
  We: "https://schema.org/Wednesday",
  Th: "https://schema.org/Thursday",
  Fr: "https://schema.org/Friday",
  Sa: "https://schema.org/Saturday",
  Su: "https://schema.org/Sunday",
};

/** Drop undefined / null / empty-array values so the output stays clean. */
function clean<T extends Json>(obj: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

const businessRef = { "@id": BUSINESS_ID };

function postalAddress(): Json {
  const a = site.address;
  return clean({
    "@type": "PostalAddress",
    streetAddress: [a.street, a.area].filter(Boolean).join(", "),
    addressLocality: a.city,
    addressRegion: a.region,
    postalCode: a.postalCode,
    addressCountry: a.country,
  });
}

function areaServed(): Json[] {
  return [
    { "@type": "City", name: "Lahore", sameAs: "https://en.wikipedia.org/wiki/Lahore" },
    ...site.areasServed.map((a) => ({ "@type": "Place", name: `${a.name}, Lahore`, url: absoluteUrl(`/areas/${a.slug}/`) })),
  ];
}

export interface BusinessOptions {
  /** e.g. "Rs 3,500 to Rs 50,000 per day" computed from the catalog. Falls back to site.priceRange (omitted when null). */
  priceRange?: string;
}

/** AutoRental (LocalBusiness) for the whole site. @id "<url>/#business". */
export function autoRentalBusiness(options: BusinessOptions = {}): Json {
  const sameAs = [...socialLinks().map((s) => s.url), site.googleBusinessProfileUrl].filter(Boolean);
  return clean({
    "@context": CONTEXT,
    "@type": "AutoRental",
    "@id": BUSINESS_ID,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    slogan: site.tagline,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/brand/logo.png"),
    image: absoluteUrl("/og/default.png"),
    telephone: site.phones[0].e164,
    email: site.email,
    priceRange: options.priceRange ?? site.priceRange,
    currenciesAccepted: site.currency,
    paymentAccepted: site.paymentAccepted.join(", "),
    foundingDate: site.foundingYear ? String(site.foundingYear) : undefined,
    address: postalAddress(),
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: mapsUrl(),
    openingHoursSpecification: site.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days.map((d) => DAY_URI[d]),
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: areaServed(),
    contactPoint: site.phones.map((p) => ({
      "@type": "ContactPoint",
      telephone: p.e164,
      contactType: "customer service",
      areaServed: "PK",
      availableLanguage: ["English", "Urdu", "Punjabi"],
    })),
    sameAs,
  });
}

/** WebSite node. No SearchAction (the site has no search). */
export function websiteSchema(): Json {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: site.name,
    description: site.description,
    inLanguage: site.locale,
    publisher: businessRef,
  };
}

function priceSpec(price: number, unit: "DAY" | "MON" | "WEE" | "HUR", label: string): Json {
  return {
    "@type": "UnitPriceSpecification",
    name: label,
    price,
    priceCurrency: "PKR",
    unitCode: unit,
    referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: unit },
  };
}

function rentalOffer(name: string, price: number, unit: "DAY" | "MON" | "WEE", url: string): Json {
  return {
    "@type": "Offer",
    name,
    url,
    price,
    priceCurrency: "PKR",
    businessFunction: LEASE_OUT,
    priceSpecification: priceSpec(price, unit, name),
    offeredBy: businessRef,
    seller: businessRef,
    areaServed: { "@type": "City", name: "Lahore" },
  };
}

/** schema.org bodyType for catalog category slugs that describe a body style (luxury/wedding do not). */
const BODY_TYPES: Record<string, string> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  van: "Van",
  coaster: "Minibus",
};

/**
 * A rental car model: Car + Product with rental Offers (per day / week / month, PKR), linked to #business.
 * The AggregateOffer low/high range only uses per-day offers so day and month prices are never mixed.
 * Use on /cars/<slug>/ pages only.
 */
export function carOfferSchema(model: CatalogModel, options: { url?: string; categoryName?: string } = {}): Json {
  const url = absoluteUrl(options.url ?? `/cars/${model.slug}/`);
  const name = `${model.make} ${model.model}`;
  const r = model.rates;
  const offers: Json[] = [];
  const dailyPrices = [r.withDriver?.daily, r.withDriver?.outstationDaily, r.selfDrive?.daily].filter(
    (p): p is number => typeof p === "number" && p > 0,
  );
  if (r.withDriver) {
    offers.push(rentalOffer(`${name} with driver, per day`, r.withDriver.daily, "DAY", url));
    if (r.withDriver.outstationDaily) offers.push(rentalOffer(`${name} with driver, outstation, per day`, r.withDriver.outstationDaily, "DAY", url));
    if (r.withDriver.monthly) offers.push(rentalOffer(`${name} with driver, per month`, r.withDriver.monthly, "MON", url));
  }
  if (r.selfDrive) {
    offers.push(rentalOffer(`${name} self drive, per day`, r.selfDrive.daily, "DAY", url));
    if (r.selfDrive.weekly) offers.push(rentalOffer(`${name} self drive, per week`, r.selfDrive.weekly, "WEE", url));
    if (r.selfDrive.monthly) offers.push(rentalOffer(`${name} self drive, per month`, r.selfDrive.monthly, "MON", url));
  }

  return clean({
    "@context": CONTEXT,
    "@type": ["Product", "Car"],
    "@id": `${url}#car`,
    name: model.variant ? `${name} ${model.variant}` : name,
    description: model.seoDescription ?? model.shortDescription,
    url,
    image: model.images.map((i) => i.src),
    brand: { "@type": "Brand", name: model.make },
    model: model.model,
    category: options.categoryName,
    bodyType: BODY_TYPES[model.category],
    vehicleModelDate: model.yearFrom ? String(model.yearFrom) : undefined,
    seatingCapacity: model.seats,
    vehicleSeatingCapacity: model.seats,
    vehicleTransmission: model.transmission === "automatic" ? "Automatic" : "Manual",
    fuelType: model.fuel.charAt(0).toUpperCase() + model.fuel.slice(1),
    vehicleEngine: model.engineCc
      ? {
          "@type": "EngineSpecification",
          engineDisplacement: { "@type": "QuantitativeValue", value: model.engineCc, unitCode: "CMQ" },
        }
      : undefined,
    cargoVolume: undefined,
    additionalProperty: model.features.map((f) => ({ "@type": "PropertyValue", name: "Feature", value: f })),
    offers: offers.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "PKR",
          lowPrice: Math.min(r.fromPrice, ...dailyPrices),
          highPrice: Math.max(r.fromPrice, ...dailyPrices),
          offerCount: offers.length,
          businessFunction: LEASE_OUT,
          offers,
        }
      : undefined,
  });
}

export interface ServiceSchemaInput {
  name: string;
  description: string;
  /** Path or absolute URL of the service page. */
  url: string;
  /** e.g. "Car rental with driver". */
  serviceType?: string;
  /** Lowest "from" price for this service (PKR per day), from the catalog. */
  lowPrice?: number | null;
  /** Override areaServed (defaults to Lahore + served neighbourhoods). */
  areaServed?: Json | Json[];
}

/** Service landing page (e.g. /wedding-car-rental-lahore/). */
export function serviceSchema(input: ServiceSchemaInput): Json {
  const url = absoluteUrl(input.url);
  return clean({
    "@context": CONTEXT,
    "@type": "Service",
    "@id": `${url}#service`,
    name: input.name,
    description: input.description,
    serviceType: input.serviceType ?? input.name,
    url,
    provider: businessRef,
    areaServed: input.areaServed ?? areaServed(),
    offers:
      typeof input.lowPrice === "number"
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "PKR",
            lowPrice: input.lowPrice,
            businessFunction: LEASE_OUT,
            priceSpecification: priceSpec(input.lowPrice, "DAY", `From, per day`),
            offeredBy: businessRef,
          }
        : undefined,
  });
}

export interface BreadcrumbItem {
  name: string;
  /** Path or absolute URL. */
  url: string;
}

/** BreadcrumbList. Pass the full trail including Home. Breadcrumbs.astro does this for you. */
export function breadcrumbSchema(items: BreadcrumbItem[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

/** FAQPage (optional per ARCHITECTURE.md; one per page at most). */
export function faqSchema(faqs: FaqItem[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export interface TouristTripInput {
  /** e.g. "Lahore to Islamabad by car". */
  name: string;
  description: string;
  /** Path or absolute URL of the route page. */
  url: string;
  from?: string; // default "Lahore"
  to: string;
  /** Stops along the way, in order. */
  stops?: string[];
  distanceKm?: number;
  driveHours?: number;
  /** Lowest per-day price for an outstation car (PKR), from the catalog. */
  lowPrice?: number | null;
}

/** Outstation route page (/routes/lahore-to-<city>/). */
export function touristTripSchema(route: TouristTripInput): Json {
  const url = absoluteUrl(route.url);
  const places = [route.from ?? "Lahore", ...(route.stops ?? []), route.to];
  return clean({
    "@context": CONTEXT,
    "@type": "TouristTrip",
    "@id": `${url}#trip`,
    name: route.name,
    description: route.description,
    url,
    provider: businessRef,
    touristType: ["Families", "Groups", "Business travellers"],
    itinerary: {
      "@type": "ItemList",
      numberOfItems: places.length,
      itemListElement: places.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Place", name: p },
      })),
    },
    additionalProperty: [
      route.distanceKm ? { "@type": "PropertyValue", name: "Distance", value: route.distanceKm, unitCode: "KMT" } : null,
      route.driveHours ? { "@type": "PropertyValue", name: "Drive time", value: route.driveHours, unitCode: "HUR" } : null,
    ].filter(Boolean),
    offers:
      typeof route.lowPrice === "number"
        ? {
            "@type": "Offer",
            priceCurrency: "PKR",
            price: route.lowPrice,
            businessFunction: LEASE_OUT,
            priceSpecification: priceSpec(route.lowPrice, "DAY", "Car with driver, outstation, from per day"),
            offeredBy: businessRef,
          }
        : undefined,
  });
}

/** Human price range from catalog min/max, e.g. "Rs 3,500 to Rs 50,000 per day". */
export function priceRangeLabel(range: { min: number; max: number } | null): string | undefined {
  if (!range) return undefined;
  const f = (n: number) => `Rs ${new Intl.NumberFormat("en-US").format(n)}`;
  return `${f(range.min)} to ${f(range.max)} per day`;
}

/** Re-exported for pages that need the formatted NAP in schema-adjacent markup. */
export { formatAddress };
