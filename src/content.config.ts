/**
 * Markdown content collections (glob loader + zod). One file per page:
 *   src/content/areas/<slug>.md     -> /areas/<slug>/        (slug = file name)
 *   src/content/routes/<slug>.md    -> /routes/<slug>/       (frontmatter slug, e.g. lahore-to-islamabad)
 *   src/content/services/<slug>.md  -> /<slug>/              (frontmatter slug = DESIGN.md service URL)
 *   src/content/guides/<slug>.md    -> /guides/<slug>/       (slug = file name)
 *
 * Read with: const entries = await getCollection("areas"); const { Content } = await render(entry);
 * Model slugs in recommendedModels / popularModels are resolved with resolveModels() from @/lib/catalog.
 * Never put prices in content: prices come only from the catalog.
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use kebab-case");
const faq = z.object({ q: z.string().min(5), a: z.string().min(5) });
/**
 * Without the brand: buildTitle() appends " | Cantt Rent a Car" (19 chars). Max 60 keeps the keyword
 * part inside Google's ~60 character display; the brand may truncate, the keywords will not.
 */
const metaTitle = z
  .string()
  .min(10)
  .max(60)
  .refine((t) => !/cantt rent a car/i.test(t), "metaTitle must not include the brand (it is appended automatically)");
const metaDescription = z.string().min(50).max(170);

/** No em/en dashes in visible copy (DESIGN.md copy rule). */
const noDashes = (value: unknown): boolean => !/[\u2013\u2014]/.test(JSON.stringify(value));
const dashMessage = "Use periods, commas, colons or hyphens instead of em/en dashes.";

export const SERVICE_SLUGS = [
  "rent-a-car-with-driver-lahore",
  "self-drive-car-rental-lahore",
  "monthly-car-rental-lahore",
  "lahore-airport-car-rental",
  "wedding-car-rental-lahore",
  "corporate-car-rental-lahore",
  "luxury-car-rental-lahore",
  "van-coaster-rental-lahore",
] as const;

const areas = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/areas" }),
  schema: z
    .object({
      title: z.string(),
      h1: z.string(),
      metaTitle,
      metaDescription,
      areaName: z.string(),
      intro: z.string(),
      landmarks: z.array(z.string()).default([]),
      pickupPoints: z.array(z.string()).default([]),
      distances: z
        .array(z.object({ to: z.string(), km: z.number().positive(), minutes: z.number().int().positive() }))
        .default([]),
      nearbyAreas: z.array(slug).default([]),
      popularModels: z.array(slug).default([]),
      faqs: z.array(faq).default([]),
      updatedAt: z.coerce.date(),
    })
    .refine(noDashes, dashMessage),
});

const routes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/routes" }),
  schema: z
    .object({
      to: z.string(),
      slug: slug.regex(/^lahore-to-/, "route slugs start with lahore-to-"),
      metaTitle,
      metaDescription,
      h1: z.string(),
      distanceKm: z.number().positive(),
      driveHours: z.number().positive(),
      motorways: z.array(z.string()).default([]),
      tollNote: z.string().optional(),
      bestSeason: z.string().optional(),
      roadAdvice: z.string().optional(),
      stops: z.array(z.string()).default([]),
      recommendedModels: z.array(slug).default([]),
      faqs: z.array(faq).default([]),
      updatedAt: z.coerce.date(),
    })
    .refine(noDashes, dashMessage),
});

const services = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/services" }),
  schema: z
    .object({
      slug: z.enum(SERVICE_SLUGS),
      h1: z.string(),
      metaTitle,
      metaDescription,
      serviceType: z.enum(["with_driver", "self_drive", "both"]),
      tripType: z.enum(["within_city", "outstation", "airport", "wedding", "monthly", "corporate"]),
      intro: z.string(),
      highlights: z.array(z.object({ title: z.string(), text: z.string(), icon: z.string().optional() })).default([]),
      inclusions: z.array(z.string()).default([]),
      exclusions: z.array(z.string()).default([]),
      recommendedModels: z.array(slug).default([]),
      faqs: z.array(faq).default([]),
      updatedAt: z.coerce.date(),
    })
    .refine(noDashes, dashMessage),
});

const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
  schema: z
    .object({
      title: z.string(),
      metaTitle,
      metaDescription,
      excerpt: z.string().max(240),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
      author: z.string().default("Cantt Rent a Car team"),
      draft: z.boolean().default(false),
    })
    .refine(noDashes, dashMessage),
});

export const collections = { areas, routes, services, guides };
