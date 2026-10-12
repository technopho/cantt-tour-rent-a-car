/**
 * WebPage-type JSON-LD for the company pages (/about/ -> AboutPage, /contact/ -> ContactPage).
 * src/lib/schema.ts has no builder for these, so this small one lives with the pages that use it.
 * It only links nodes the layout already emits (#business, #website) by @id: no new facts.
 *
 *   <JsonLd slot="jsonld" data={companyPageSchema("ContactPage", { url: "/contact/", name, description })} />
 */
import { site } from "@/config/site";
import { BUSINESS_ID, WEBSITE_ID } from "@/lib/schema";
import { absoluteUrl } from "@/lib/urls";

export interface CompanyPageInput {
  /** Path or absolute URL of the page. */
  url: string;
  name: string;
  description: string;
}

export function companyPageSchema(type: "AboutPage" | "ContactPage", input: CompanyPageInput): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: site.locale,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": BUSINESS_ID },
    mainEntity: { "@id": BUSINESS_ID },
  };
}
