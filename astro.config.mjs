// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import copyGuard from "./integrations/copy-guard.mjs";

/**
 * Public site URL. Used for canonical URLs, Open Graph, JSON-LD and the sitemap.
 * Set SITE_URL in the build environment (Workers Builds variable) once the real domain is live.
 */
const SITE_URL = (process.env.SITE_URL || "https://canttrentacar.com").replace(/\/+$/, "");

/** Utility pages that must never appear in the sitemap. */
const SITEMAP_EXCLUDE = [/\/404\/?$/, /\/quote\/thanks\/?$/, /\/api\//];

export default defineConfig({
  site: SITE_URL,

  // Every page is prerendered. The only on-demand route will be src/pages/api/quote.ts,
  // which opts out with `export const prerender = false`.
  output: "static",

  adapter: cloudflare({
    // Build-time image optimisation for local assets only. Car photos come from R2 with
    // pre-generated widths and are rendered as plain <img srcset>, never through astro:assets.
    imageService: "compile",
    // Prerender in Node so build-time code can use fetch with timeouts, process.env and
    // node:fs (icons are read from the iconify JSON files). On-demand routes still run in workerd.
    prerenderEnvironment: "node",
  }),

  // No Astro sessions: this disables the adapter's automatic SESSION KV binding
  // (KV free tier is tiny and we store nothing per visitor).
  session: false,

  integrations: [
    svelte(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((pattern) => pattern.test(page)),
    }),
    // Fails the build on em/en dashes in content (markdown bodies included) or in the built pages.
    copyGuard(),
  ],

  trailingSlash: "always",
  build: {
    format: "directory",
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  // TODO(security): Astro's `security.csp` is intentionally off for now. GSAP (CSSOM inline
  // styles) and JSON-LD data blocks are compatible with it, but these are not yet:
  //  - Cloudflare Turnstile on the quote form needs script-src/frame-src for
  //    https://challenges.cloudflare.com and its own inline bootstrap,
  //  - prerendered `style="..."` attributes (Svelte islands, CSS custom properties set in markup)
  //    are blocked by style-src without 'unsafe-inline',
  //  - Svelte transitions inject <style> elements at runtime.
  // Revisit once the quote island exists: enable `security: { csp: { ... } }`, add the
  // Turnstile origins to scriptDirective.resources and test with `npm run preview`.
  // Baseline security headers are already sent via public/_headers.

  vite: {
    plugins: [tailwindcss()],
  },
});
