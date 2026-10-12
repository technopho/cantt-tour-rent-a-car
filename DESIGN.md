# Website design brief

**Design read:** premium consumer brand site + local-business SEO site for people renting cars in Lahore (families, wedding parties, corporate staff, overseas Pakistanis visiting home, tourists heading north), with a cinematic night-drive automotive language, built with Astro + Tailwind 4 + GSAP + Three.js.

**Dials:** DESIGN_VARIANCE 8 · MOTION_INTENSITY 7 · VISUAL_DENSITY 4. On phones: single column, motion reduced to light reveals.

## Identity

- **Name:** Cantt Rent a Car. "Cantt" = Lahore Cantonment: order, punctuality, trust. The brand promise is *reliable cars and drivers, on time, at honest prices*.
- **Mood:** Lahore at night from a moving car. Tail-light streaks on the Canal Road, motorway lights, polished paint. Calm confidence, not flashy.
- **Theme:** dark is the brand mode (default). Light mode is supported through the same CSS variables under `prefers-color-scheme: light`, with identical hierarchy. One theme per page, no section flips.

## Tokens (lock these)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0b0d12` | `#f3f4f6` |
| `--surface` | `#12151c` | `#ffffff` |
| `--surface-2` | `#1a1e27` | `#e9ebef` |
| `--line` | `rgb(255 255 255 / 0.08)` | `rgb(12 15 22 / 0.10)` |
| `--text` | `#eef0f3` | `#10131a` |
| `--muted` | `#9aa3b2` | `#4b5363` |
| `--accent` | `#e8553d` (Lahori sandstone red) | `#c9432c` |
| `--accent-ink` (text on accent) | `#ffffff` | `#ffffff` |

- One accent only, used for primary CTAs, key highlights and tail-light glows. No purple/blue AI gradients. No neon outer glows.
- **Type:** display `Unbounded Variable` (weights 500–700, tight tracking, for headlines and big numbers); text `Manrope Variable` (400–700). Self-hosted via `@fontsource-variable/*`, `font-display: swap`, preload only the two primary files. Prices use `font-variant-numeric: tabular-nums`.
- **Shape system:** buttons and chips are full pills; cards, inputs, media are 16px radius (`rounded-2xl`); small badges 8px. Follow everywhere.
- **Icons:** Phosphor (via `@iconify-json/ph`, rendered at build time as inline SVG). One stroke weight ("regular"). Brand marks (WhatsApp) from `@iconify-json/simple-icons`.
- **Shadows:** tinted to background, never pure black on light. Prefer borders (`--line`) and spacing over cards.
- **Grain:** optional subtle noise on a fixed, `pointer-events-none` overlay only.

## Copy rules

- Plain, confident English for Lahore customers. Short sentences. Roman Urdu only where it reads naturally (e.g. "Gari chahiye? We're on WhatsApp.").
- **No em dashes or en dashes anywhere** in visible copy. Use periods, commas, colons or hyphens.
- No filler verbs (elevate, seamless, unleash, revolutionize). No fake numbers, no fake reviews, no invented awards. Facts must come from the catalog or `src/config/site.ts`.
- One label per intent across the whole site: **"Get a quote"** (primary), **"WhatsApp us"**, **"Call now"**.
- Hero: max 4 text elements, headline ≤ 2 lines on desktop, sub ≤ 20 words.
- Eyebrow labels: max 1 per 3 sections.

## Signature experiences (each must have a reason)

1. **Night-drive hero (WebGL):** light trails (white headlights, red tail-lights) streaming along curved roads through darkness, reacting gently to pointer and scroll. Reason: instantly says "driving in Lahore at night", sets the cinematic tone. The H1 text is the LCP element; the canvas fades in after first paint on capable devices. Fallback (phones and tablets, reduced motion, low-end, Save-Data): a static poster image of the same scene; touch devices keep the CSS/GSAP motion but never load the WebGL scene, because field performance on mid-range Android matters more than the effect. Optional: a sleek stylised car on a reflective floor, only if it looks premium in screenshots.
2. **Trip composer (the quote form):** a sentence the visitor completes instead of a boring form: *"I need a [Toyota Corolla] [with driver] for [a wedding] from [Fri 14 Nov] to [Sun 16 Nov], picking up in [DHA Phase 5]."* Each bracket is an accessible popover/select. A live "estimated from Rs X" updates from catalog rates (clearly labelled as an estimate; the team confirms the final price). Step 2 asks name, phone (+92), optional email. Turnstile. Success screen shows the reference number and a "WhatsApp us" button prefilled with the ref. Reason: makes the main conversion feel effortless and memorable.
3. **The garage (fleet):** desktop: pinned horizontal pan through the fleet with category chips that re-flow cards using GSAP Flip; mobile: native scroll-snap carousel. Cards tilt slightly in 3D on hover (desktop only). Reason: browsing the fleet should feel like walking a showroom.
4. **Route map:** a transit-map style diagram (Lahore → Islamabad → Murree → Naran → Hunza → Skardu, plus Sialkot, Faisalabad, Multan) whose lines draw themselves on scroll, with distance and drive-time counters. Reason: outstation trips are a big revenue line and the map makes them tangible.
5. **How renting works:** sticky-stack of 3 cards (Tell us your trip → We confirm on WhatsApp → Drive or get driven). Reason: removes uncertainty for first-time renters.
6. **Neighbourhood index:** big typographic list of Lahore areas we serve; hovering/focusing an area reveals pickup notes and links to its area page. Reason: local SEO + "they know my area".
7. **Page transitions:** cross-document View Transitions (`@view-transition { navigation: auto; }`) with a short fade/slide, progressive enhancement only.

## Motion rules

- GSAP + ScrollTrigger only where something is pinned, scrubbed or sequenced. Simple reveals use CSS scroll-driven animations (`animation-timeline: view()`) with an IntersectionObserver fallback.
- Lenis smooth scroll only on fine-pointer desktop, driven by `gsap.ticker`; never on touch.
- Animate only transform and opacity. Every animation collapses to static under `prefers-reduced-motion: reduce`.
- Clean up ScrollTriggers/WebGL on `astro:before-swap` or page hide.

## Performance budget

- LCP ≤ 2.5 s on 4G mid-range Android, CLS ≤ 0.05, INP ≤ 200 ms. Lighthouse mobile ≥ 95 on every template.
- ≤ 50 KB gzip JS on content pages before interaction. Three.js chunk loads only after idle + visibility on capable devices.
- Images: AVIF/WebP, explicit width/height, lazy below the fold, one `fetchpriority="high"` image max per page.

## Pages (all prerendered)

- `/` home
- Services: `/rent-a-car-with-driver-lahore/`, `/self-drive-car-rental-lahore/`, `/monthly-car-rental-lahore/`, `/lahore-airport-car-rental/`, `/wedding-car-rental-lahore/`, `/corporate-car-rental-lahore/`, `/luxury-car-rental-lahore/`, `/van-coaster-rental-lahore/`
- Fleet: `/cars/`, `/cars/<category>/`, `/cars/<model-slug>/`
- Areas: `/areas/`, `/areas/<slug>/` (lahore-cantt, dha-lahore, gulberg, johar-town, model-town, bahria-town-lahore, askari, wapda-town)
- Routes: `/routes/`, `/routes/lahore-to-<city>/`
- Guides: `/guides/`, `/guides/<slug>/`
- `/rates/`, `/about/`, `/contact/`, `/faq/`, `/policies/`, `/quote/` (full-page composer), `/partner-with-us/` (investors who want to attach their car)
- `/404`, `sitemap-index.xml`, `robots.txt`, `llms.txt`
