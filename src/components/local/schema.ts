/**
 * JSON-LD builders for the local SEO pages that src/lib/schema.ts does not provide.
 * They reference the sitewide AutoRental node by @id (BUSINESS_ID) so Google merges the graph.
 * No AggregateRating / Review, no vehicle listings (ARCHITECTURE.md).
 */
import { SITE_URL, site } from "@/config/site";
import { BUSINESS_ID } from "@/lib/schema";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import { absoluteUrl } from "@/lib/urls";

type Json = Record<string, unknown>;
const CONTEXT = "https://schema.org";

const LAHORE = { "@type": "City", name: "Lahore", sameAs: "https://en.wikipedia.org/wiki/Lahore" };

export interface AreaServedInput {
  /** "DHA Lahore" */
  name: string;
  /** Path of the area page. */
  url: string;
  lat?: number;
  lng?: number;
}

/** Same PostalAddress as the sitewide node (src/lib/schema.ts), built from site.ts. */
function postalAddress(): Json {
  const a = site.address;
  const out: Json = {
    "@type": "PostalAddress",
    streetAddress: [a.street, a.area].filter(Boolean).join(", "),
    addressLocality: a.city,
    addressRegion: a.region,
    addressCountry: a.country,
  };
  if (a.postalCode) out.postalCode = a.postalCode;
  return out;
}

/**
 * The business (by @id) serving one neighbourhood: merges an areaServed Place into the
 * sitewide AutoRental node on the area page. It repeats the NAP basics (address, phone) so the
 * node still validates as a LocalBusiness if a parser reads it on its own instead of merging.
 */
export function areaBusinessSchema(area: AreaServedInput): Json {
  const url = absoluteUrl(area.url);
  return {
    "@context": CONTEXT,
    "@type": "AutoRental",
    "@id": BUSINESS_ID,
    name: site.name,
    url: `${SITE_URL}/`,
    telephone: site.phones[0].e164,
    address: postalAddress(),
    areaServed: {
      "@type": "Place",
      "@id": `${url}#place`,
      name: area.name.includes("Lahore") ? area.name : `${area.name}, Lahore`,
      url,
      containedInPlace: LAHORE,
      ...(typeof area.lat === "number" && typeof area.lng === "number"
        ? { geo: { "@type": "GeoCoordinates", latitude: area.lat, longitude: area.lng } }
        : {}),
    },
  };
}

export interface ArticleInput {
  headline: string;
  description: string;
  /** Path of the article. */
  url: string;
  datePublished: Date;
  dateModified: Date;
  wordCount?: number;
  /** Section names (H2s), used as articleSection. */
  sections?: string[];
}

/** Guide pages: Article with the organisation as author and publisher. */
export function articleSchema(input: ArticleInput): Json {
  const url = absoluteUrl(input.url);
  return {
    "@context": CONTEXT,
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.headline.slice(0, 110),
    description: input.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: absoluteUrl(DEFAULT_OG_IMAGE.src).replace(/\/$/, ""),
    datePublished: input.datePublished.toISOString(),
    dateModified: input.dateModified.toISOString(),
    inLanguage: site.locale,
    author: { "@type": "Organization", name: site.name, url: `${SITE_URL}/` },
    publisher: { "@id": BUSINESS_ID },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.sections && input.sections.length ? { articleSection: input.sections } : {}),
  };
}

export interface ListItemInput {
  name: string;
  url: string;
}

/** Hub pages: an ItemList of the child pages. */
export function itemListSchema(name: string, items: ListItemInput[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

/** A destination Place for a route Service areaServed. */
export function destinationPlace(name: string): Json {
  return { "@type": "Place", name: `${name}, Pakistan` };
}
