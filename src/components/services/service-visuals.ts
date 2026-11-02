/**
 * Which scenes belong to which service page. Names are looked up in the media manifest and may not exist
 * yet: missing ones drop out. Each list ends on pictures that ship with the site and show no car (night-road
 * trails, the northern terrain), so a page never has to borrow a car from its own gallery to fill a gap,
 * which would show that car twice. The first interlude follows the page's list of cars, so the page takes the
 * first picture here with no vehicle in it for that slot (afterCarList in model-visual.ts).
 */
import { road, scene, still, type Img } from "@/lib/media";

const SCENES: Record<string, { hero: string; interludes: () => (Img | undefined)[] }> = {
  "rent-a-car-with-driver-lahore": { hero: "chauffeur", interludes: () => [scene("cabin"), scene("lahore-night"), scene("corporate"), still("trails")] },
  "self-drive-car-rental-lahore": { hero: "selfdrive", interludes: () => [road("motorway"), scene("garage"), still("trails"), still("terrain")] },
  "monthly-car-rental-lahore": { hero: "monthly", interludes: () => [scene("garage"), scene("lahore-night"), scene("corporate"), still("trails")] },
  "lahore-airport-car-rental": { hero: "airport", interludes: () => [scene("cabin"), scene("lahore-night"), scene("chauffeur"), still("trails")] },
  "wedding-car-rental-lahore": { hero: "wedding", interludes: () => [scene("badshahi"), scene("cabin"), scene("chauffeur"), still("trails")] },
  "corporate-car-rental-lahore": { hero: "corporate", interludes: () => [scene("cabin"), scene("lahore-night"), scene("airport"), still("trails")] },
  "luxury-car-rental-lahore": { hero: "luxury", interludes: () => [scene("cabin"), scene("contact"), scene("garage"), scene("monthly"), scene("wedding"), still("trails")] },
  "van-coaster-rental-lahore": { hero: "vans", interludes: () => [road("motorway"), scene("lahore-night"), still("terrain"), still("trails")] },
};

/** The page's scenes in order: hero first, then its interludes. */
export function serviceScenes(slug: string): (Img | undefined)[] {
  const entry = SCENES[slug];
  return entry ? [scene(entry.hero), ...entry.interludes()] : [];
}
