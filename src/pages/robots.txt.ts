import type { APIRoute } from "astro";
import { SITE_URL } from "@/config/site";

/**
 * Allow everyone (search engines and AI search / agent crawlers alike); keep the API out.
 * The only dynamic route is POST /api/quote, which crawlers have no reason to touch.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = (site?.href ?? SITE_URL).replace(/\/+$/, "");
  const body = [
    "# Cantt Rent a Car",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap-index.xml`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
