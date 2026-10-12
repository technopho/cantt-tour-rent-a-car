/**
 * Extra JSON-LD nodes for the fleet pages (lib/schema.ts covers Car+Offer, BreadcrumbList, FAQPage).
 * ItemList only lists page URLs: no vehicle-listing markup, no ratings (ARCHITECTURE.md).
 */
import { site } from "@/config/site";
import { BUSINESS_ID, WEBSITE_ID } from "@/lib/schema";
import { absoluteUrl } from "@/lib/urls";

export interface ListEntry {
  name: string;
  /** Path or absolute URL. */
  url: string;
}

/** ItemList of model pages (for /cars/ and /cars/<category>/). */
export function itemListSchema(input: { name: string; url: string; items: ListEntry[] }): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${url}#cars`,
    name: input.name,
    url,
    numberOfItems: input.items.length,
    itemListOrder: "https://schema.org/ItemListUnordered",
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

/** WebPage node with a modified date (the rates page uses the catalog's publish time). */
export function webPageSchema(input: { name: string; description: string; url: string; dateModified?: string }): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  const modified = input.dateModified ? new Date(input.dateModified) : null;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: site.locale,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": BUSINESS_ID },
    ...(modified && !Number.isNaN(modified.getTime()) ? { dateModified: modified.toISOString() } : {}),
  };
}
