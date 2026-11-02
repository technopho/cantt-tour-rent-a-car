# Website design brief: "The Private Garage, After Dark"

Owner's brief (2026-11-02): "We are a luxury rent car service. The website should be unique and feel premium and luxury." Their complaints about the previous version: weak animations, no real 3D, too much text and too few visuals, no preloader. Every decision below answers one of those.

**Read:** a private members' garage in Lahore, entered at night. Think of a couture house's site crossed with a car launch film, not a rental listing. The visitor is being shown a car, not sold a price list. Pictures and motion carry the story; words are few, set large, and placed with care.

**Dials:** DESIGN_VARIANCE 10, MOTION_INTENSITY 9, VISUAL_DENSITY 3 (lots of black space, one strong image at a time). Phones get the same experience, recomposed, not a reduced one.

## Identity

- **Name:** Cantt Rent a Car. Never rename it. "Cantt" = Lahore Cantonment: order, punctuality, discretion.
- **Mood:** polished paint in low light. Brass, ivory, obsidian, ember tail-lights. Quiet confidence. Nothing shouts, nothing bounces.
- **Theme:** dark by default (the brand). Visitors can switch to a light "ivory" theme with the sun/moon toggle in the header; the choice is saved in `localStorage` (`cantt-theme`) and applied before first paint. Light tokens live under `:root[data-theme="light"]` in `global.css`. Picture-led blocks (page heroes, the home opening and its image sections, plates, interludes, the header bar, the menu and the footer) carry `data-theme="dark"` and stay dark in both themes, because ivory type over a photograph needs a dark scrim either way. A new image-led section must do the same.

## Tokens (token NAMES stay the same as before so existing utilities keep working; values change)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#070708` | page |
| `--surface` | `#0f0e0d` | panels |
| `--surface-2` | `#181614` | raised panels, inputs |
| `--line` | `rgb(236 224 200 / 0.12)` | hairlines |
| `--line-strong` | `rgb(236 224 200 / 0.42)` | form controls (3:1) |
| `--text` | `#f2ece0` | ivory text |
| `--muted` | `#a79e8e` | secondary text (AA on bg and surface-2) |
| `--accent` | `#c9a66b` | champagne brass: rules, icons, large display, focus |
| `--accent-fg` | `#d4b27a` | brass small text |
| `--accent-fill` / `--accent-fill-hover` | `#c9a66b` / `#dcbd86` | filled buttons |
| `--accent-ink` | `#0b0a08` | text on brass |
| `--accent-soft` | `rgb(201 166 107 / 0.14)` | tints |
| `--ember` | `#c1281d` | tail-lights only, in 3D, trails and small glows. Never on buttons |

- No blue, purple or neon anywhere. Gold is a thin line or a small area, never a large flat fill or a gradient text effect.
- **Type:** display `Bodoni Moda Variable` (roman and italic; optical-size axis if available), used at 28px and larger only, because its hairlines disappear when small. Italic is the emphasis device: one italic word per headline at most. Text and UI `Instrument Sans Variable` (400 to 600). Labels: Instrument Sans 11 to 12px, uppercase, tracking 0.22em. Prices: Bodoni tabular figures at large sizes, Instrument Sans at small sizes.
- Display sizes are big: home acts up to `clamp(3.5rem, 11vw, 11rem)`, tight leading (0.95), letter-spacing -0.01em.
- **Shape:** no pills, no bubbly cards. Radius 0 to 2px. Buttons are rectangles with a hairline border and a brass fill that slides in on hover. Cards are mostly not cards: an image, a hairline, a caption.
- **Icons:** Phosphor "light" or "thin" feel. Use sparingly. **A car icon must never stand in for a car.**
- **Grain:** a fine fixed film grain overlay stays, at very low opacity.
- **Logo:** the existing C mark with its bar, redrawn in ivory with a brass bar.

## Copy rules

- Very short. A section gets a headline and at most one sentence, unless it is a content page. No filler verbs (elevate, seamless, unleash, revolutionize) and no luxury cliches (unparalleled, world-class, bespoke, curated).
- **No em dashes or en dashes anywhere**: the build fails on them (`integrations/copy-guard.mjs`). Use periods, commas, colons or hyphens.
- No fake numbers, reviews, awards, client names or claims. Facts come from the catalog or `src/config/site.ts`.
- CTA labels stay exactly: **"Get a quote"**, **"WhatsApp us"**, **"Call now"**.
- SEO text is not deleted to make a page look clean. On content pages it stays, but is laid out in an editorial way alongside images, or inside accordions. Titles, meta descriptions, canonical URLs, JSON-LD, internal links and every route stay. Each page keeps exactly one H1 containing its main keyword.

## Signature experiences

1. **Preloader, "Ignition":** black screen. The C mark draws itself as a brass hairline, its stroke tied to real load progress with a thin Bodoni percentage counter. When ready, the bar of the C lights, two headlight beams sweep outward, and the screen parts like a garage door onto the opening's first frame, whose light carries on from the preloader's seam. The full sequence plays on the home page only (BaseLayout `preloadMedia`, `<html data-preload="media">`), following the real load of the opening's first frames through the `cantt:load-progress` and `cantt:load-ready` events. A first visit to any other page gets the quick sequence (the C draws, the bar lights, the doors part, about 1.2s). Later pages get a short 500ms obsidian curtain with a brass edge. Hard cap of 7 seconds, it never traps the visitor. Pure inline CSS and JS in the document so it paints at once. Hidden without JS. Short fade under reduced motion.
2. **The opening (home, pictures, scroll-driven, pinned; `src/components/home/HomeHero.astro`):** five full-bleed frames on a sticky stage, played by the scroll like the first minute of a car launch film.
   - Act 1, *Arrive like it's yours:* a night arrival. The H1, "Arrive like it's yours" with "Luxury rent a car in Lahore" inside the same H1, and "Get a quote".
   - Act 2, *With a driver, or the keys:* the chauffeur at the open door.
   - Act 3, *Dressed for the baraat:* the wedding car.
   - Act 4, *From Lahore to the north:* a northern road (licensed photo), else the terrain still.
   - Act 5, *After dark, on time:* Lahore at night with ember light trails, dissolving into the Collection.
   - Each frame lists its pictures in order of preference and takes the first that exists and is not already in the opening, so the sequence improves by itself as images arrive. Phones get the same five frames, cropped per picture (`object-position`), not a reduced version.
   - Motion: only the imagery is scrubbed. A frame arrives by a strip-light sweep (it wipes in from the left behind a vertical bar of light with an anamorphic streak) or by a garage door (the frame before lifts away, light spilling under its edge). Slow Ken Burns and parallax throughout, a soft band of light across each frame as it settles, ember trails in the last act, the film grain on top. Type plays in on its own clock when an act starts, so a line never rests half cut. CSS and GSAP only, transforms and opacity, no WebGL.
   - The first frame's picture is the LCP element: eager, `fetchpriority="high"`, width and height set, responsive `srcset`. Chrome ignores a picture that covers the whole viewport for LCP, so that frame stops 1px short of the top edge.
   - Reduced motion and JS off: the five frames stacked, each with its words and its image note. The `fallback` tier (Save-Data, little memory, no WebGL2) keeps the frames and wipes and drops the extra light (sweeping bands, trail glow and flowing trails).
3. **The 3D concept car is removed from the whole site** (owner decision, 2026-11-02: up close its bodywork looked melted). No car film, no Private Viewing, no car model, no concept car stills or renders anywhere, and no model credit. A car is only ever shown in a picture.
4. **The Collection:** fleet as a pinned horizontal gallery, largest and most luxurious cars first, huge Bodoni names sliding past images at a different speed, with clip-path reveals and a custom "View" cursor. Phones: swipeable full-bleed stack.
5. **Occasions:** services as tall image columns that expand on hover or tap (wedding, chauffeur, airport, corporate, self drive, long-term, north).
6. **The Road North:** a 3D particle terrain of mountains, with the route from Lahore to Skardu drawn as a glowing line that the camera flies along on scroll.
7. **Site-wide motion:** split-line text reveals, clip-path image reveals, slow image parallax and Ken Burns, magnetic buttons, custom cursor on desktop, hairlines that draw themselves, smooth scroll on desktop, brass-curtain page transitions.
8. **Inner page heroes:** full-bleed image with Ken Burns and a large serif title, never a text-only hero.

## Motion rules

- Easing: slow and heavy, `cubic-bezier(0.16, 1, 0.3, 1)` or GSAP `expo.out`/`power4.out`, 0.9 to 1.6s. Nothing bounces, nothing elastic.
- GSAP plus ScrollTrigger plus Lenis (fine pointer only). Animate transform, opacity, clip-path. Everything collapses to a calm static layout under `prefers-reduced-motion`.
- Content must be readable with JS off: never hide text with CSS unless `html.js` is set, and every reveal has a timeout fallback.

## 3D rules (The Road North only)

- The only 3D on the site is The Road North's particle terrain (`src/scripts/terrain3d.ts`). No other WebGL scene, and no 3D car.
- Runs on phones as well, on two quality tiers (`src/scripts/tier.ts`). Only Save-Data, reduced motion, very low memory (under 3 GB), or no WebGL2 fall back to the plain list of stops, so nobody sees an empty stage.
- Pause rendering off screen and in hidden tabs. Lower DPR when frame rate drops. Dispose of everything on page hide.
- three.js loads lazily, only when The Road North comes near, and never blocks the H1 or the preloader's first paint.

## Images

- Pictures live in `public/media/`. Manifest: `src/data/media.json`. Fleet images are only fallbacks: a real photo from the catalog (`model.images`) always wins.
- **Sources:** cars, people and studio scenes come from Canva AI only. Free licensed real photos (Unsplash or Pexels) are allowed for places only: `public/media/roads/*` and the place scenes such as `lahore-night` and `badshahi`.
- **Image honesty:** every AI image that shows a vehicle (or the inside of one) carries a small **"Representative image"** note, scenes included, not only fleet images. Every real licensed photo carries a small, quiet photographer credit, for example "Photo: Name / Unsplash", built from the manifest entry's `credit` object. The no-car stills (light trails, terrain) need no note.
- Pictures come from `@/lib/media` (`fleetImage`, `scene`, `road`, `heroFor`, and `still()` for the no-car stills). Any lookup may return undefined, so code renders well without it and picks up new images by itself when they land. Never hardcode a manifest image path.
- `loading="lazy"` below the fold, explicit width and height, WebP, one `fetchpriority="high"` per page at most.

## Performance

Home is a deliberate exception: it may ship the pinned picture opening and The Road North's WebGL terrain. Content pages keep the previous budget (LCP 2.5s or better, CLS 0.05 or less, under 50 KB gzip JS before interaction, excluding the shared motion chunk loaded on idle).

## Pages (all prerendered; routes must not change)

- `/` home
- Services: `/rent-a-car-with-driver-lahore/`, `/self-drive-car-rental-lahore/`, `/monthly-car-rental-lahore/`, `/lahore-airport-car-rental/`, `/wedding-car-rental-lahore/`, `/corporate-car-rental-lahore/`, `/luxury-car-rental-lahore/`, `/van-coaster-rental-lahore/`
- Fleet: `/cars/`, `/cars/<category>/`, `/cars/<model-slug>/`
- Areas: `/areas/`, `/areas/<slug>/`
- Routes: `/routes/`, `/routes/lahore-to-<city>/`
- Guides: `/guides/`, `/guides/<slug>/`
- `/rates/`, `/about/`, `/contact/`, `/faq/`, `/policies/`, `/quote/`, `/partner-with-us/`
- `/404`, `sitemap-index.xml`, `robots.txt`, `llms.txt`
