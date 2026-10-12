import type { APIRoute } from "astro";
import { formatAddress, formatOpeningHours, primaryPhone, site, SITE_URL } from "@/config/site";
import { getCatalogMeta, getCategories, getModels, modelName } from "@/lib/catalog";
import { formatPKR } from "@/lib/format";
import { whatsappUrl } from "@/lib/links";
import { absoluteUrl, urls } from "@/lib/urls";

/**
 * llms.txt (https://llmstxt.org): a short, factual summary for AI assistants and agents.
 * Built from site.ts and the catalog, so it never drifts from the pages.
 */
export const GET: APIRoute = async ({ site: astroSite }) => {
  const origin = (astroSite?.href ?? SITE_URL).replace(/\/+$/, "");
  const abs = (path: string) => absoluteUrl(path, origin);
  const [models, categories, meta] = await Promise.all([getModels(), getCategories(), getCatalogMeta()]);

  const lines: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "Key facts:",
    `- Location: ${formatAddress()}`,
    `- Phone: ${primaryPhone.e164}`,
    `- WhatsApp: ${whatsappUrl(null)}`,
    `- Email: ${site.email}`,
    `- Hours: ${formatOpeningHours().join("; ")}`,
    `- Areas served: Lahore (${site.areasServed.map((a) => a.name).join(", ")}) and outstation trips across Pakistan`,
    "- Bookings: request a quote online or on WhatsApp. The team confirms availability and the final price before booking. Prices on the site are estimates in Pakistani rupees (PKR).",
    "",
    "## Services",
    ...site.services.map((s) => `- [${s.name}](${abs(urls.service(s.slug))}): ${s.description}`),
    "",
    "## Fleet",
    ...(meta.sample ? ["Note: sample fleet. Cars and prices below are placeholders until the real catalog is published.", ""] : []),
    `- [All cars](${abs(urls.cars())}): ${categories.map((c) => c.name).join(", ")}`,
    ...models.map((m) => `- [${modelName(m)}](${abs(urls.car(m.slug))}): ${m.seats} seats, ${m.transmission}, from ${formatPKR(m.rates.fromPrice)} per day`),
    "",
    "## Outstation routes",
    ...site.routes.map((r) => `- [Lahore to ${r.city}](${abs(urls.route(r.slug))})`),
    "",
    "## Areas in Lahore",
    ...site.areasServed.map((a) => `- [${a.name}](${abs(urls.area(a.slug))})`),
    "",
    "## Company",
    `- [Get a quote](${abs(urls.quote())})`,
    ...site.nav.company.map((l) => `- [${l.label}](${abs(l.href)})`),
    "",
  ];

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
