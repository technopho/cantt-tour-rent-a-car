/**
 * Which live (catalog / site.ts) block each guide shows after its article body, and the heading
 * it adds to the table of contents. Slugs match src/content/guides/*.md.
 */
export type GuideExtraKind = "cost" | "documents" | "compare" | "north" | "overseas";

export interface GuideExtra {
  kind: GuideExtraKind;
  id: string;
  title: string;
}

const EXTRAS: Record<string, GuideExtra> = {
  "cost-to-rent-a-car-in-lahore": { kind: "cost", id: "live-prices", title: "Live prices from our fleet" },
  "documents-to-rent-a-car-in-pakistan": { kind: "documents", id: "deposits", title: "Current self drive deposits" },
  "self-drive-vs-car-with-driver-lahore": { kind: "compare", id: "compare-rates", title: "Driver vs self drive: live rates" },
  "lahore-to-northern-areas-road-trip-guide": { kind: "north", id: "northern-cars", title: "Cars and routes for the north" },
  "renting-a-car-in-lahore-overseas-pakistanis": { kind: "overseas", id: "before-you-land", title: "Before you land" },
};

export function guideExtra(slug: string): GuideExtra | undefined {
  return EXTRAS[slug];
}

/** Related service and page links per guide (descriptive anchors). */
export const GUIDE_LINKS: Record<string, { label: string; href: string }[]> = {
  "cost-to-rent-a-car-in-lahore": [
    { label: "Live rates for every car", href: "/rates/" },
    { label: "Monthly car rental in Lahore", href: "/monthly-car-rental-lahore/" },
    { label: "Outstation routes and pricing", href: "/routes/" },
  ],
  "documents-to-rent-a-car-in-pakistan": [
    { label: "Self drive car rental in Lahore", href: "/self-drive-car-rental-lahore/" },
    { label: "Rental policies", href: "/policies/" },
    { label: "Corporate car rental", href: "/corporate-car-rental-lahore/" },
  ],
  "self-drive-vs-car-with-driver-lahore": [
    { label: "Rent a car with driver in Lahore", href: "/rent-a-car-with-driver-lahore/" },
    { label: "Self drive car rental in Lahore", href: "/self-drive-car-rental-lahore/" },
    { label: "Live rates for every car", href: "/rates/" },
  ],
  "lahore-to-northern-areas-road-trip-guide": [
    { label: "All outstation routes from Lahore", href: "/routes/" },
    { label: "Van and coaster rental for groups", href: "/van-coaster-rental-lahore/" },
    { label: "SUVs for mountain roads", href: "/cars/suv/" },
  ],
  "renting-a-car-in-lahore-overseas-pakistanis": [
    { label: "Lahore airport pick and drop", href: "/lahore-airport-car-rental/" },
    { label: "Monthly car rental in Lahore", href: "/monthly-car-rental-lahore/" },
    { label: "Wedding car rental in Lahore", href: "/wedding-car-rental-lahore/" },
  ],
};

/** Word count of a markdown body, ignoring link targets and markdown punctuation. */
export function guideWordCount(body: string | undefined): number {
  return (body ?? "")
    .replace(/\]\([^)]*\)/g, "] ") // drop link URLs, keep the anchor text
    .replace(/[#*_>|`[\]()]/g, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Reading time in minutes at about 220 words a minute (minimum 3), the same on the index and the guide. */
export function guideReadMinutes(body: string | undefined): number {
  return Math.max(3, Math.round(guideWordCount(body) / 220));
}
