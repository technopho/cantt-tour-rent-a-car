# Cantt Rent a Car: website

Public website for Cantt Rent a Car, Lahore: home page with a 3D night-drive hero (desktop), fleet and rates, 8 service pages, Lahore area pages, outstation route pages, guides and the trip composer quote form.

The internal control panel lives in a separate repository: [technopho/cantt-tour-rent-control-panel](https://github.com/technopho/cantt-tour-rent-control-panel). Quote requests from this site arrive in its **Inquiries** inbox, and its **Settings → Website → Publish** button sends cars, prices and photos here.

- Stack: Astro 7 (static prerender) on Cloudflare Workers static assets, Tailwind 4, GSAP, Lenis, Three.js, Svelte 5 islands, Cloudflare Turnstile. Free plan only.
- How the two apps fit together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Going live step by step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Design rules (tokens, typography, motion, copy): [DESIGN.md](DESIGN.md)

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Opens http://localhost:4321. To test the quote form end to end, run the control panel on http://localhost:5173 (see its README); `.dev.vars` points `CONTROL_PANEL_URL` there.

```bash
npm run check    # astro check (types)
npm run build    # production build; fails on any em/en dash in copy (integrations/copy-guard.mjs)
npm run preview  # serve the build with the Workers runtime
```

`npm run build` copies `.dev.vars` into `dist/server/.dev.vars` and `npm run preview` reads that copy, so build again after changing `.dev.vars`. The copy is never uploaded; production secrets come from `wrangler secret put`.

## Where things are

| What | File |
|---|---|
| Business facts (name, phones, WhatsApp, address, hours, socials, areas, services) | `src/config/site.ts` (placeholders are listed in `PLACEHOLDER_FIELDS`) |
| Policy values shown on the site (city day, handover, fuel, wedding season...) | `src/components/services/terms.ts` (values marked CHOSEN DEFAULT need the owner's confirmation) |
| Cars and prices | Published from the control panel (`CATALOG_URL`); `src/data/catalog.sample.json` is the fallback used in development |
| Service, area, route and guide content | `src/content/` |
| Pages | `src/pages/` (only `src/pages/api/quote.ts` runs on the server) |

Prices are never typed into page copy: they always come from the catalog, so the website, structured data and quotes stay in step with the control panel.

## Before launch

1. Replace every placeholder in `src/config/site.ts` (real phone, WhatsApp, address, coordinates, hours, Google Business Profile link).
2. Confirm or change the CHOSEN DEFAULT values in `src/components/services/terms.ts`, and have `/policies/` reviewed by a lawyer.
3. Publish the real fleet from the control panel, with photos.
4. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): domain, Cloudflare, Turnstile keys, `INTERNAL_API_KEY`, the `CONTROL_PANEL` service binding, Workers Builds with `CATALOG_URL`, Search Console.
