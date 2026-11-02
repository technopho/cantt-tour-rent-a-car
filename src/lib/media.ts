/**
 * Image manifest (src/data/media.json). Fleet images and studio scenes are AI images (Canva); place photos
 * (roads, and the scenes lahore-night and badshahi) are licensed photos that carry a `credit`. Every helper
 * returns undefined when the entry is absent, so a page can build before any image exists, and picks up a new
 * entry the moment it lands in the manifest.
 *
 *   import { fleetImage, scene, road, heroFor, captionFor } from "@/lib/media";
 *   const img = scene("garage");               // Img | undefined
 *   const hero = heroFor(Astro.url.pathname);  // the right picture for this page's meaning, or undefined
 *   const note = hero && captionFor(hero);     // "Representative image", "Photo: Name / Unsplash", or undefined
 *
 * captionFor is the one place that decides a picture's small print; every hero, plate and interlude uses it.
 * Real catalog photos always win over fleetImage (DESIGN.md); CarVisual applies that rule.
 */

/** Who took a licensed photo. The manifest writes { author, authorUrl, source, license }; a plain string works too. */
export type Credit =
  | string
  | {
      author?: string;
      name?: string;
      photographer?: string;
      authorUrl?: string;
      /** The photo's page (its host tells Unsplash from Pexels), or the site's name. */
      source?: string;
      site?: string;
      license?: string;
    };

export interface Img {
  src: string;
  srcset?: string;
  width: number;
  height: number;
  alt: string;
  /** Licensed photo: who took it and where it is from. Its presence marks the picture as a real photo. */
  credit?: Credit;
  /** Optional manifest hint for an AI scene: does a vehicle (or part of one) show? Read from the alt text otherwise. */
  vehicle?: boolean;
}

interface MediaManifest {
  fleet?: Record<string, Img>;
  scenes?: Record<string, Img>;
  roads?: Record<string, Img>;
}

// Eager glob instead of a plain import: a missing manifest gives an empty map, not a failed build.
const files = import.meta.glob<MediaManifest>("../data/media.json", { eager: true, import: "default" });
const media: MediaManifest = Object.values(files)[0] ?? {};

/** AI image for a fleet model slug. */
export function fleetImage(slug: string | undefined): Img | undefined {
  return slug ? media.fleet?.[slug] : undefined;
}

/** Named mood scene. */
export function scene(name: string): Img | undefined {
  return media.scenes?.[name];
}

/** Named road image. */
export function road(name: string): Img | undefined {
  return media.roads?.[name];
}

/**
 * Pictures with no car in them that ship with the site rather than the manifest: tail-light trails on a night
 * road, and the particle terrain of the north. Safe on any page, including one about a model with no picture
 * of its own, because they show no particular car. No caption needed.
 */
export type StillName = "trails" | "terrain";
const STILLS: Record<StillName, Img> = {
  trails: { src: "/media/hero-poster.webp", width: 1920, height: 1200, alt: "Tail-light trails curving along a dark road at night" },
  terrain: {
    src: "/media/still-terrain.webp",
    width: 2000,
    height: 1125,
    alt: "The northern mountains drawn in points of light, with the road from Lahore traced in brass",
  },
};
export function still(name: StillName): Img {
  return STILLS[name];
}

/** Names of every scene in the manifest. */
export function sceneNames(): string[] {
  return Object.keys(media.scenes ?? {});
}

/** First scene that exists out of a list of preferred names. */
export function firstScene(...names: string[]): Img | undefined {
  for (const name of names) {
    const img = scene(name);
    if (img) return img;
  }
  return undefined;
}

/** FNV-1a: spreads similar keys (page slugs) evenly, even taken modulo a short list. */
const hash = (key: string) => {
  let h = 0x811c9dc5;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h ^ (h >>> 15)) >>> 0;
};

/**
 * A scene hashed from `key`: stable, different across pages, and blind to meaning. Only for a decorative spot
 * where any scene will do; a page hero uses heroFor.
 */
export function pickScene(key: string): Img | undefined {
  const names = sceneNames().sort();
  return names.length === 0 ? undefined : scene(names[hash(key) % names.length]);
}

export const REPRESENTATIVE = "Representative image";

const STILL_SRCS = new Set(Object.values(STILLS).map((img) => img.src));
// Words in an AI scene's alt text that mean a vehicle, or part of one, is in the frame. A car key on its own is not.
const VEHICLE_WORDS =
  /\b(cars?(?! keys?\b)|sedans?|saloons?|suvs?|4x4|jeeps?|vans?|minivans?|coasters?|bus(es)?|vehicles?|limousines?|hatchbacks?|convoy|steering wheel|dashboard|cent(re|er) console|headlights?|bonnet|rear door|car door)\b/i;

/** A licensed photo, not an AI image. */
export function isPhoto(img: Img): boolean {
  return Boolean(img.credit);
}

/**
 * An AI image with a vehicle in it, which must say "Representative image": every AI fleet image, and any AI
 * scene whose manifest entry says so or whose alt text names a vehicle. Licensed place photos and the no-car
 * stills (trails, terrain) never are.
 */
export function showsVehicle(img: Img): boolean {
  if (isPhoto(img) || STILL_SRCS.has(img.src)) return false;
  if (img.src.startsWith("/media/fleet/")) return true;
  if (typeof img.vehicle === "boolean") return img.vehicle;
  return img.src.startsWith("/media/") && VEHICLE_WORDS.test(img.alt);
}

const SITES: [RegExp, string][] = [
  [/unsplash\.com/i, "Unsplash"],
  [/pexels\.com/i, "Pexels"],
];

/** "Photo: Name / Unsplash" from a manifest credit. */
export function creditLine(credit: Credit): string | undefined {
  if (typeof credit === "string") return credit.trim() ? (/^photo\b/i.test(credit) ? credit.trim() : `Photo: ${credit.trim()}`) : undefined;
  const who = (credit.author ?? credit.name ?? credit.photographer)?.trim();
  const urls = [credit.site, credit.source, credit.authorUrl].filter((s): s is string => Boolean(s));
  const site = SITES.find(([re]) => urls.some((u) => re.test(u)))?.[1] ?? (credit.site || (credit.source && !/^https?:/i.test(credit.source) ? credit.source : undefined));
  if (who && site) return `Photo: ${who} / ${site}`;
  if (who || site) return `Photo: ${who ?? site}`;
  return undefined;
}

/**
 * The small print a picture owes the reader: a quiet photographer credit for a licensed photo, "Representative
 * image" for an AI image with a vehicle in it, nothing for anything else.
 */
export function captionFor(img: Img): string | undefined {
  if (img.credit) return creditLine(img.credit);
  return showsVehicle(img) ? REPRESENTATIVE : undefined;
}

/**
 * Hero choices. s: scene, r: road, f: fleet image, t: a still with no car (trails, terrain). The first one that
 * exists wins. A page whose gallery opens on a car does not lead with that same car (the gallery would repeat it).
 */

const PAGE_HEROES: Record<string, string[]> = {
  "wedding-car-rental-lahore": ["s:wedding", "f:mercedes-s-class"],
  "rent-a-car-with-driver-lahore": ["s:chauffeur", "f:mercedes-s-class"],
  "lahore-airport-car-rental": ["s:airport", "f:toyota-prado"],
  "corporate-car-rental-lahore": ["s:corporate", "f:mercedes-s-class"],
  "self-drive-car-rental-lahore": ["s:selfdrive", "f:honda-civic"],
  "monthly-car-rental-lahore": ["s:monthly", "f:toyota-fortuner"],
  "luxury-car-rental-lahore": ["s:luxury", "s:chauffeur", "f:toyota-land-cruiser"],
  "van-coaster-rental-lahore": ["s:vans", "f:toyota-hiace", "f:toyota-coaster", "r:motorway", "t:trails"],
  about: ["s:garage", "f:toyota-land-cruiser"],
  contact: ["s:contact", "s:lahore-night", "f:toyota-fortuner"],
  rates: ["s:garage", "f:toyota-prado"],
  quote: ["s:cabin", "f:mercedes-s-class"],
  faq: ["s:cabin", "f:honda-civic"],
  policies: ["s:cabin", "f:honda-civic"],
  "partner-with-us": ["s:corporate", "f:toyota-fortuner"],
  // Not the Land Cruiser: it is the first car in the gallery right under the hero.
  cars: ["s:garage", "s:monthly", "s:chauffeur", "t:trails"],
  areas: ["s:lahore-night", "s:badshahi", "f:toyota-prado"],
  routes: ["r:motorway", "r:skardu", "f:toyota-land-cruiser"],
  guides: ["s:cabin", "s:lahore-night", "f:honda-civic"],
  "404": ["s:lahore-night", "s:garage", "f:toyota-land-cruiser"],
};

const CATEGORY_HEROES: Record<string, string[]> = {
  hatchback: ["s:garage", "s:selfdrive", "t:trails"],
  sedan: ["s:chauffeur", "s:corporate", "f:honda-civic"],
  suv: ["s:monthly", "s:airport", "f:toyota-fortuner"],
  luxury: ["s:luxury", "s:chauffeur", "f:toyota-land-cruiser"],
  wedding: ["s:wedding", "f:mercedes-s-class"],
  van: ["s:vans", "f:toyota-hiace", "r:motorway", "t:trails"],
  coaster: ["s:vans", "f:toyota-coaster", "r:motorway", "t:trails"],
};

/** Same order for a given key, different start across keys: many pages of one kind should not all match. */
export function rotated<T>(list: readonly T[], key: string): T[] {
  if (list.length === 0) return [];
  const start = hash(key) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

function heroChoices(path: string): string[] {
  const [first = "", second] = path.split("/").filter(Boolean);
  if (!second) return PAGE_HEROES[first] ?? ["s:garage", "s:lahore-night", "f:toyota-land-cruiser"];

  switch (first) {
    case "cars":
      // A model page only ever shows that model: another car here would misdescribe it.
      return CATEGORY_HEROES[second] ?? [`f:${second}`, "s:garage"];
    case "routes": {
      // Route pages choose their own pictures (routePictures in src/components/local/plates.ts); this is the short form.
      const city = second.replace(/^lahore-to-/, "");
      return [`r:${city}`, `r:${city.split("-")[0]}`, "t:terrain"];
    }
    case "areas":
      return [...rotated(["s:lahore-night", "s:badshahi"], second), ...rotated(["f:toyota-prado", "f:toyota-fortuner", "f:mercedes-s-class", "f:honda-civic"], second)];
    case "guides":
      if (second.includes("northern")) return ["r:hunza", "r:skardu", "r:motorway", "t:terrain"];
      return [...rotated(["s:cabin", "s:lahore-night"], second), ...rotated(["f:honda-civic", "f:toyota-fortuner", "f:toyota-prado"], second)];
    default:
      return ["s:garage", "s:lahore-night", "f:toyota-land-cruiser"];
  }
}

function lookUp(choice: string): Img | undefined {
  const name = choice.slice(2);
  if (choice.startsWith("s:")) return scene(name);
  if (choice.startsWith("r:")) return road(name);
  if (choice.startsWith("t:")) return STILLS[name as StillName];
  return fleetImage(name);
}

/**
 * The hero picture for a page, chosen by what the page is about: its named scene or road, then a fleet image
 * that suits it, then the night-road trails, which show no car and suit any page. Undefined only for a model
 * page whose car has no picture. Show captionFor(img) with it.
 */
export function heroFor(path: string): Img | undefined {
  const key = path.replace(/\.html$/, "");
  for (const choice of heroChoices(key)) {
    const img = lookUp(choice);
    if (img) return img;
  }
  return STILLS.trails;
}
