/**
 * SEO helpers: titles, descriptions, canonical URLs, Open Graph / Twitter tags, robots.
 * BaseLayout calls buildSeo() for you; pages just pass `title`, `description` and flags.
 *
 *   buildTitle("Toyota Corolla on rent in Lahore")  -> "Toyota Corolla on rent in Lahore | Cantt Rent a Car"
 *   clampDescription(longText)                       -> <= 158 chars, cut on a word boundary
 *   canonicalUrl("/cars")                            -> "https://canttrentacar.com/cars/"
 */
import { SITE_URL, site } from "@/config/site";
import { absoluteUrl, withTrailingSlash } from "@/lib/urls";

export const TITLE_SEPARATOR = " | ";
export const DEFAULT_TITLE = `Rent a Car in Lahore with Driver or Self Drive${TITLE_SEPARATOR}${site.name}`;
export const DEFAULT_DESCRIPTION = site.description;
export const DEFAULT_OG_IMAGE = { src: "/og/default.png", width: 1200, height: 630, alt: `${site.name}, car rental in Lahore` };

export interface OgImage {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface SeoInput {
  /** Page title WITHOUT the brand; the template appends " | Cantt Rent a Car". */
  title?: string;
  /** Use the title exactly as given (no template). For content with a hand-written metaTitle that already ends with the brand. */
  rawTitle?: boolean;
  description?: string;
  /** Override the canonical path or URL (defaults to the current path). */
  canonical?: string;
  image?: OgImage;
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string | Date;
  modifiedTime?: string | Date;
}

export interface SeoTags {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: Record<string, string>;
  twitter: Record<string, string>;
  article: Record<string, string>;
}

/** "<page> | Cantt Rent a Car". Empty -> default title. Never doubles the brand. */
export function buildTitle(page?: string, raw = false): string {
  const t = page?.trim();
  if (!t) return DEFAULT_TITLE;
  if (raw || t.toLowerCase().includes(site.name.toLowerCase())) return t;
  return `${t}${TITLE_SEPARATOR}${site.name}`;
}

/** Collapse whitespace and clamp to `max` characters on a word boundary (adds "..."). */
export function clampDescription(text: string | undefined, max = 158): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return DEFAULT_DESCRIPTION;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "")}...`;
}

/** Absolute canonical URL with trailing slash; strips query and hash. */
export function canonicalUrl(pathOrUrl: string, origin: string = SITE_URL): string {
  const url = new URL(pathOrUrl, `${origin}/`);
  const base = /^https?:\/\//i.test(pathOrUrl) ? url.origin : origin.replace(/\/+$/, "");
  return `${base}${withTrailingSlash(url.pathname)}`;
}

function toIso(d: string | Date | undefined): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Everything BaseLayout needs for <head>. */
export function buildSeo(input: SeoInput, pathname: string, origin: string = SITE_URL): SeoTags {
  const title = buildTitle(input.title, input.rawTitle);
  const description = clampDescription(input.description);
  const canonical = canonicalUrl(input.canonical ?? pathname, origin);
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const imageUrl = absoluteUrl(image.src, origin).replace(/\/$/, "");
  const robots = input.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1";

  const og: Record<string, string> = {
    "og:type": input.type ?? "website",
    "og:site_name": site.name,
    "og:locale": "en_PK",
    "og:title": title,
    "og:description": description,
    "og:url": canonical,
    "og:image": imageUrl,
  };
  if (image.width) og["og:image:width"] = String(image.width);
  if (image.height) og["og:image:height"] = String(image.height);
  if (image.alt) og["og:image:alt"] = image.alt;

  const twitter: Record<string, string> = {
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": imageUrl,
  };
  if (image.alt) twitter["twitter:image:alt"] = image.alt;

  const article: Record<string, string> = {};
  const published = toIso(input.publishedTime);
  const modified = toIso(input.modifiedTime);
  if (input.type === "article") {
    if (published) article["article:published_time"] = published;
    if (modified) article["article:modified_time"] = modified;
  }

  return { title, description, canonical, robots, og, twitter, article };
}
