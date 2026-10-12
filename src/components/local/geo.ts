/**
 * Lahore geography for the stylised area maps (build time only, no client JS).
 *
 * Coordinates are APPROXIMATE centres, good enough for a schematic map and for the
 * `geo` of an areaServed Place. They are never shown as numbers on the page.
 * The projection maps a 33 x 33 km box around Lahore onto a square SVG viewBox.
 */

export const MAP_SIZE = 520;

const BOUNDS = { lngMin: 74.15, lngMax: 74.5, latMin: 31.34, latMax: 31.64 } as const;

export interface Point {
  x: number;
  y: number;
}

/** lat/lng -> SVG user units (rounded to 0.1). */
export function project(lat: number, lng: number): Point {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * MAP_SIZE;
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * MAP_SIZE;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Smooth-ish polyline path through projected points. */
export function pathFrom(points: [number, number][]): string {
  return points
    .map(([lat, lng], i) => {
      const p = project(lat, lng);
      return `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
    })
    .join(" ");
}

export type LabelSide = "left" | "right" | "top" | "bottom";

export interface AreaGeo {
  slug: string;
  /** Short label on the map. */
  label: string;
  lat: number;
  lng: number;
  side: LabelSide;
}

/** Approximate centres of the eight area pages (slugs match site.areasServed and src/content/areas). */
export const AREA_GEO: AreaGeo[] = [
  { slug: "lahore-cantt", label: "Lahore Cantt", lat: 31.535, lng: 74.38, side: "left" },
  { slug: "dha-lahore", label: "DHA", lat: 31.475, lng: 74.425, side: "right" },
  { slug: "gulberg", label: "Gulberg", lat: 31.515, lng: 74.345, side: "left" },
  { slug: "johar-town", label: "Johar Town", lat: 31.47, lng: 74.275, side: "right" },
  { slug: "model-town", label: "Model Town", lat: 31.483, lng: 74.325, side: "right" },
  { slug: "bahria-town-lahore", label: "Bahria Town", lat: 31.365, lng: 74.185, side: "right" },
  { slug: "askari", label: "Askari", lat: 31.506, lng: 74.396, side: "bottom" },
  { slug: "wapda-town", label: "Wapda Town", lat: 31.432, lng: 74.265, side: "right" },
];

export type PoiKey = "airport" | "railway" | "kalma" | "thokar" | "ravi" | "wagah";

export interface Poi {
  key: PoiKey;
  label: string;
  lat: number;
  lng: number;
  side: LabelSide;
  /** Shorter label used on phones, where the map is small. */
  short?: string;
  /** Off-map destinations are pinned to the map edge with an arrow. */
  offMap?: boolean;
}

export const POIS: Poi[] = [
  { key: "airport", label: "Airport (LHE)", short: "Airport", lat: 31.521, lng: 74.404, side: "right" },
  { key: "railway", label: "Railway Station", short: "Railway Stn", lat: 31.577, lng: 74.336, side: "right" },
  { key: "kalma", label: "Kalma Chowk", short: "Kalma", lat: 31.504, lng: 74.331, side: "left" },
  { key: "thokar", label: "Thokar Niaz Baig", short: "Thokar", lat: 31.473, lng: 74.242, side: "left" },
  { key: "ravi", label: "Ravi toll plaza", short: "Ravi toll", lat: 31.603, lng: 74.268, side: "left" },
  // Wagah is ~20 km east of the box: pinned to the right edge at its latitude.
  { key: "wagah", label: "Wagah", lat: 31.603, lng: 74.488, side: "left", offMap: true },
];

/** Match a free-text distance label from the content ("Allama Iqbal International Airport (LHE)") to a POI. */
export function poiForLabel(label: string): Poi | undefined {
  const l = label.toLowerCase();
  const key: PoiKey | undefined = l.includes("airport")
    ? "airport"
    : l.includes("railway")
      ? "railway"
      : l.includes("wagah")
        ? "wagah"
        : l.includes("thokar")
          ? "thokar"
          : l.includes("ravi") || l.includes("m-2")
            ? "ravi"
            : l.includes("kalma")
              ? "kalma"
              : undefined;
  return key ? POIS.find((p) => p.key === key) : undefined;
}

/** Icon per distance destination (Icon.astro names). */
export function iconForLabel(label: string): string {
  const poi = poiForLabel(label);
  switch (poi?.key) {
    case "airport":
      return "ph:airplane-tilt";
    case "railway":
      return "ph:train";
    case "wagah":
      return "ph:flag";
    case "thokar":
    case "ravi":
      return "ph:road-horizon";
    case "kalma":
      return "ph:traffic-signal";
    default:
      return "ph:map-pin";
  }
}

/* Stylised features (approximate). */
export const RAVI: [number, number][] = [
  [31.66, 74.34],
  [31.628, 74.312],
  [31.606, 74.285],
  [31.582, 74.245],
  [31.548, 74.214],
  [31.505, 74.186],
  [31.46, 74.16],
  [31.42, 74.14],
];

export const CANAL: [number, number][] = [
  [31.573, 74.5],
  [31.566, 74.44],
  [31.561, 74.39],
  [31.553, 74.35],
  [31.538, 74.331],
  [31.517, 74.318],
  [31.498, 74.305],
  [31.481, 74.288],
  [31.468, 74.258],
  [31.452, 74.215],
  [31.43, 74.18],
  [31.4, 74.15],
];

export const RING_ROAD: [number, number][] = [
  [31.603, 74.268],
  [31.616, 74.31],
  [31.612, 74.36],
  [31.596, 74.405],
  [31.566, 74.438],
  [31.53, 74.44],
  [31.498, 74.452],
  [31.468, 74.46],
  [31.44, 74.43],
  [31.428, 74.37],
];

/** Southern section drawn dashed (schematic). */
export const RING_ROAD_SOUTH: [number, number][] = [
  [31.428, 74.37],
  [31.425, 74.31],
  [31.44, 74.262],
  [31.473, 74.242],
];
