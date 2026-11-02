/**
 * Image "plates" for the content pages: one image plus the small print it owes the reader, which always comes
 * from captionFor in @/lib/media ("Representative image" on an AI picture with a vehicle in it, a quiet
 * photographer credit on a licensed place photo, nothing on the no-car stills). Everything resolves through
 * @/lib/media, so scenes and place photos take over the moment they land in the manifest, and pictures that ship
 * with the site and show no car (night-road trails, the northern terrain) close every list, so a page never
 * runs out. Every lookup may return undefined; components render nothing or a dark plate in that case.
 */
import { captionFor, fleetImage, road, rotated, scene, showsVehicle, still, type Img } from "@/lib/media";

export { REPRESENTATIVE } from "@/lib/media";

export interface Plate {
  img: Img;
  /** Portrait crop for phones, where one exists. */
  mobile?: { src: string; width: number; height: number };
  caption?: string;
  /** object-position for the crop. */
  position?: string;
}

/** Any picture as a plate, with its small print. */
export function plateOf(img: Img | undefined, position?: string): Plate | undefined {
  return img ? { img, caption: captionFor(img), position } : undefined;
}

/** Tail-light trails on a dark road. No car in the frame, so no caption. */
export function trails(): Plate {
  return plateOf(still("trails"), "60% 70%")!;
}

/** The northern mountains as particle terrain with the route drawn in brass. No car, no caption. */
export function terrain(): Plate {
  return plateOf(still("terrain"), "50% 60%")!;
}

/** AI fleet image ("Representative image"). */
export function fleetPlate(slug: string): Plate | undefined {
  return plateOf(fleetImage(slug));
}

/**
 * Licensed photos of Lahore's places name the place in their small print, so a photo of Lahore never reads as
 * the town or the city a page is about ("Badshahi Mosque, Lahore. Photo: Name / Unsplash").
 */
const PLACES: Record<string, string> = {
  badshahi: "Badshahi Mosque, Lahore",
  "lahore-night": "Lahore at night",
};

/** First of the named scenes that exists. */
export function scenePlate(...names: string[]): Plate | undefined {
  for (const name of names) {
    const plate = plateOf(scene(name));
    if (!plate) continue;
    const place = plate.img.credit ? PLACES[name] : undefined;
    return place ? { ...plate, caption: plate.caption ? `${place}. ${plate.caption}` : place } : plate;
  }
  return undefined;
}

/** True when no vehicle shows: the only kind of picture that may sit right after a list of cars. */
export const vehicleFree = (plate: Plate) => !showsVehicle(plate.img);

/** Licensed road or place photo (photographer credit). */
export function roadPlate(name: string): Plate | undefined {
  return plateOf(road(name));
}

/** First plate that exists. */
export function firstPlate(...plates: (Plate | undefined)[]): Plate | undefined {
  return plates.find((p): p is Plate => Boolean(p));
}

/** Plates in order, without gaps or repeats of the same image. */
export function uniquePlates(...plates: (Plate | undefined)[]): Plate[] {
  const seen = new Set<string>();
  return plates.filter((p): p is Plate => {
    if (!p || seen.has(p.img.src)) return false;
    seen.add(p.img.src);
    return true;
  });
}

/**
 * A list turned to start at the n-th page of its kind, three places on for each page: neighbouring pages in a
 * list (areas, routes) start their tails far apart, so no two show the same run of pictures.
 */
function turn<T>(list: readonly T[], keys: readonly string[], slug: string): T[] {
  const i = keys.indexOf(slug);
  if (i < 0 || list.length === 0) return rotated(list, slug);
  const start = (i * 3) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/** "s:name" scene, "r:name" road photo, "f:slug" fleet image, "t:trails" / "t:terrain" no-car still. */
function plateFor(choice: string): Plate | undefined {
  const name = choice.slice(2);
  if (choice.startsWith("s:")) return scenePlate(name);
  if (choice.startsWith("r:")) return roadPlate(name);
  if (choice.startsWith("f:")) return fleetPlate(name);
  if (choice === "t:terrain") return terrain();
  return trails();
}

/**
 * General pool for interludes, rotated by `key` so pages differ from each other but stay stable: licensed photos
 * of Lahore, the studio scenes, a few fleet images, and the night-road trails.
 */
export function platePool(key: string): Plate[] {
  return rotated(
    uniquePlates(
      scenePlate("lahore-night"),
      scenePlate("chauffeur"),
      scenePlate("badshahi"),
      scenePlate("garage"),
      scenePlate("cabin"),
      fleetPlate("mercedes-s-class"),
      scenePlate("corporate"),
      fleetPlate("toyota-land-cruiser"),
      scenePlate("airport"),
      fleetPlate("toyota-prado"),
      scenePlate("selfdrive"),
      fleetPlate("toyota-fortuner"),
      trails(),
    ),
    key,
  );
}

/**
 * Hands out plates for one page without repeating a picture: each call takes the first candidate not yet shown,
 * else the next free plate from the pool (platePool(key) unless one is given). `exclude` lists pictures already
 * on the page elsewhere, such as the cars in a list of thumbnails.
 *
 *   const pick = picker("/about/");
 *   const hero = pick(scenePlate("garage"), fleetPlate("mercedes-s-class"));
 *   const next = pick(); // the next free plate from the pool
 */
export function picker(key: string, options: { pool?: (Plate | undefined)[]; exclude?: (Img | undefined)[] } = {}) {
  const used = new Set<string>((options.exclude ?? []).filter((img): img is Img => Boolean(img)).map((img) => img.src));
  const pool = options.pool ? uniquePlates(...options.pool) : platePool(key);
  const take = (plate: Plate | undefined) => {
    if (plate) used.add(plate.img.src);
    return plate;
  };
  const free = (p: Plate | undefined): p is Plate => Boolean(p) && !used.has(p!.img.src);
  const pick = (...candidates: (Plate | undefined)[]): Plate | undefined => take(candidates.find(free) ?? pool.find(free));
  /** The first free plate that passes `test`, candidates first, then the pool. Undefined (no plate) when none does. */
  pick.where = (test: (plate: Plate) => boolean, ...candidates: (Plate | undefined)[]): Plate | undefined =>
    take(candidates.find((p): p is Plate => free(p) && test(p)) ?? pool.find((p) => free(p) && test(p)));
  return pick;
}

/* ---------------------------------------------------------------- Routes */

/**
 * Pictures of each route, best first: the destination's own photo (a road photo up north; for the plains, a
 * photo of the destination once one is in the manifest, under roads/<city>), then places on the way (the Hazara
 * Motorway sign to Gilgit, Naran on the summer route north), then the northern terrain. Routes across the plains
 * open on the night-road trails, never on a Lahore landmark that would read as the destination. Never a fleet
 * car: the cars recommended for the trip are listed on the page with their own pictures.
 */
const ROUTE_PICTURES: Record<string, string[]> = {
  "lahore-to-hunza": ["r:hunza", "r:naran", "r:motorway", "t:terrain"],
  "lahore-to-skardu": ["r:skardu", "r:motorway", "r:naran", "t:terrain"],
  "lahore-to-naran-kaghan": ["r:naran", "r:motorway", "t:terrain"],
  "lahore-to-murree": ["r:murree", "t:terrain"],
  "lahore-to-swat": ["r:swat", "t:terrain"],
  "lahore-to-islamabad": ["r:islamabad", "t:terrain"],
  "lahore-to-sialkot": ["r:sialkot", "t:trails"],
  "lahore-to-faisalabad": ["r:faisalabad", "t:trails"],
  "lahore-to-multan": ["r:multan", "t:trails"],
  "lahore-to-kartarpur-nankana-sahib": ["r:kartarpur", "r:nankana-sahib", "t:trails"],
  "lahore-to-wagah-border": ["r:wagah", "t:trails"],
};

/**
 * The rest of a route page's pictures, rotated per route: the drive itself. No Lahore landmark here: the reading
 * plates sit above headings about the destination ("Inside Faisalabad"), where Lahore would read as that city.
 */
function routeTail(slug: string, region: "north" | "punjab"): Plate[] {
  return turn(
    uniquePlates(
      scenePlate("chauffeur"),
      scenePlate("cabin"),
      trails(),
      region === "north" ? terrain() : scenePlate("corporate"),
      scenePlate("contact"),
    ),
    Object.keys(ROUTE_PICTURES),
    slug,
  );
}

export interface RoutePictures {
  hero: Plate;
  /** For the guide's reading column; Reading places as many as it has room for. */
  reading: Plate[];
  /** The interlude after the recommended cars. */
  closing?: Plate;
  /** Behind the quote band at the foot of the page. Never the hero. */
  band?: Plate;
}

/**
 * Every picture of a route page, none twice. Deterministic per route, varied across routes. Lahore's own photos
 * only appear in the quote band at the foot ("Get a quote for Lahore to ..."), named in their small print.
 */
export function routePictures(slug: string, region: "north" | "punjab" = "punjab"): RoutePictures {
  const lead = (ROUTE_PICTURES[slug] ?? (region === "north" ? ["r:motorway", "t:terrain"] : ["t:trails"])).map(plateFor);
  const pick = picker(slug, { pool: [...lead, ...routeTail(slug, region)] });
  const hero = pick() ?? (region === "north" ? terrain() : trails());
  // The interlude right after the recommended cars shows no vehicle, or it would read as one more car in the list,
  // so it is chosen before the reading plates can use up the pictures with no vehicle in them.
  const closing = pick.where(vehicleFree);
  // Reading usually has room for two plates (it alternates them with pull quotes), so the band gets the next
  // picture and a third plate only fills a page with no pull quotes.
  const reading = [pick(), pick()];
  const band = pick(...turn(uniquePlates(scenePlate("lahore-night"), scenePlate("badshahi")), Object.keys(ROUTE_PICTURES), slug));
  reading.push(pick());
  return { hero, reading: reading.filter((p): p is Plate => Boolean(p)), closing, band };
}

/** Lead image of a route (hub pages). */
export function routePlate(slug: string, region: "north" | "punjab" = "punjab"): Plate {
  return routePictures(slug, region).hero;
}

/* ---------------------------------------------------------------- Areas */

/** Each area opens on its own picture, so no two area pages look alike. Scenes not yet made fall through. */
const AREA_LEADS: Record<string, string[]> = {
  // Head office, where handovers and document checks happen: the key on the desk.
  "lahore-cantt": ["s:contact", "s:garage", "t:trails"],
  "dha-lahore": ["s:chauffeur"],
  // The business district: the glass office tower.
  gulberg: ["s:corporate"],
  "johar-town": ["s:selfdrive"],
  "model-town": ["s:badshahi"],
  // A residential town of villas: the villa driveway at dusk, not the wedding car.
  "bahria-town-lahore": ["s:monthly"],
  // Next to the airport.
  askari: ["s:airport"],
  "wapda-town": ["s:lahore-night"],
};

export interface AreaPictures {
  hero: Plate;
  reading: Plate[];
  closing?: Plate;
}

/**
 * Every picture of an area page, none twice. `exclude` is the pictures of the cars in the page's "Popular cars"
 * list, so the reading plates never repeat a car that sits in a thumbnail just below. Fleet images only come in
 * once the scenes and photos run out.
 */
export function areaPictures(slug: string, exclude: (Img | undefined)[] = []): AreaPictures {
  const tail = turn(
    uniquePlates(
      scenePlate("lahore-night"),
      scenePlate("badshahi"),
      scenePlate("chauffeur"),
      scenePlate("garage"),
      scenePlate("cabin"),
      scenePlate("corporate"),
      scenePlate("airport"),
      scenePlate("monthly"),
      scenePlate("selfdrive"),
      trails(),
    ),
    Object.keys(AREA_LEADS),
    slug,
  );
  const cars = rotated(uniquePlates(...["mercedes-s-class", "toyota-land-cruiser", "toyota-prado", "toyota-fortuner", "honda-civic", "toyota-corolla"].map(fleetPlate)), slug);
  const pick = picker(slug, { pool: [...(AREA_LEADS[slug] ?? []).map(plateFor), ...tail, ...cars], exclude });
  const hero = pick() ?? trails();
  // The closing interlude follows the "Popular cars" list, so it shows no vehicle (it would read as the last car).
  // Chosen before the reading plates, which would otherwise use up the pictures with no vehicle in them.
  const closing = pick.where(vehicleFree);
  const reading = [pick(), pick(), pick()].filter((p): p is Plate => Boolean(p));
  return { hero, reading, closing };
}

/** Lead image of an area page. */
export function areaPlate(slug: string): Plate {
  return areaPictures(slug).hero;
}

/* ---------------------------------------------------------------- Guides */

const NORTHERN_GUIDE = "lahore-to-northern-areas-road-trip-guide";

/** Lead image per guide: its own scene or road photo first, then a fleet image, then a picture with no car. */
export function guidePlate(slug: string): Plate {
  switch (slug) {
    case "cost-to-rent-a-car-in-lahore":
      return firstPlate(scenePlate("luxury"), fleetPlate("mercedes-s-class")) ?? trails();
    case "documents-to-rent-a-car-in-pakistan":
      return firstPlate(scenePlate("corporate", "selfdrive"), fleetPlate("toyota-prado")) ?? trails();
    case "self-drive-vs-car-with-driver-lahore":
      return firstPlate(scenePlate("selfdrive", "chauffeur")) ?? trails();
    case NORTHERN_GUIDE:
      return firstPlate(roadPlate("hunza"), roadPlate("skardu")) ?? terrain();
    case "renting-a-car-in-lahore-overseas-pakistanis":
      return firstPlate(scenePlate("airport", "lahore-night"), fleetPlate("toyota-land-cruiser")) ?? trails();
    default:
      return platePool(slug)[0] ?? trails();
  }
}

/** Pictures for a guide's reading column: the northern guide walks through the north's places, the rest draw on the general pool. */
export function guidePool(slug: string): Plate[] {
  if (slug !== NORTHERN_GUIDE) return platePool(slug);
  return uniquePlates(...["skardu", "naran", "swat", "murree", "motorway", "hunza"].map(roadPlate), terrain(), scenePlate("lahore-night"), trails());
}
