/**
 * The ONE place for business facts (NAP, phones, hours, areas, services, navigation).
 * Every page, the footer, JSON-LD and llms.txt read from here. Never hard-code these elsewhere.
 *
 * Unknown real-world facts are placeholders marked `TODO(owner)` and listed in PLACEHOLDER_FIELDS
 * so we can show the owner a launch checklist. Prices never live here: they come from the catalog.
 *
 * This module is dependency-free and safe to import from Svelte islands.
 */

/** Canonical origin without trailing slash, e.g. "https://canttrentacar.com". From astro.config `site`. */
export const SITE_URL: string = (import.meta.env.SITE ?? "https://canttrentacar.com").replace(/\/+$/, "");

export type DayCode = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export interface OpeningHours {
  days: DayCode[];
  /** 24h "HH:MM" Pakistan time. */
  opens: string;
  /** 24h "HH:MM" Pakistan time. Use "23:59" for midnight. */
  closes: string;
}

export interface AreaServed {
  slug: string; // /areas/<slug>/
  name: string;
}

export interface RouteServed {
  slug: string; // /routes/<slug>/
  city: string;
}

export type ServiceType = "with_driver" | "self_drive";
export type TripType = "within_city" | "outstation" | "airport" | "wedding" | "monthly" | "corporate";

export interface ServiceSummary {
  slug: string; // top-level URL: /<slug>/
  name: string;
  shortName: string;
  description: string;
  icon: string; // Icon.astro name
  serviceType: ServiceType | "both";
  tripType: TripType;
}

export interface NavLink {
  label: string;
  href: string;
}

export const site = {
  name: "Cantt Rent a Car",
  shortName: "Cantt",
  // TODO(owner): registered business name as on NTN / SECP / bank account.
  legalName: "Cantt Rent a Car",
  // TODO(owner): confirm the production domain (also set SITE_URL in the build environment).
  domain: "canttrentacar.com",
  url: SITE_URL,
  tagline: "Reliable cars and drivers in Lahore, on time, at honest prices.",
  /** <= 158 chars (meta description). */
  description:
    "Rent a car in Lahore with a driver or self drive. Sedans, SUVs, vans, coasters and wedding cars for city trips, airport runs, weddings and outstation tours.",
  locale: "en-PK",
  currency: "PKR",
  timeZone: "Asia/Karachi",
  foundingYear: null as number | null, // TODO(owner): year founded (only shown if set)

  phones: [
    {
      e164: "+923434899399",
      display: "0343 4899399",
      label: "Bookings",
    },
  ],
  // WhatsApp number, digits only with country code (wa.me format). Same as the bookings phone.
  whatsapp: "923434899399",
  // TODO(owner): real inbox on the final domain.
  email: "hello@canttrentacar.com",

  address: {
    // TODO(owner): office / shop number and street. Left empty so nothing fake is published.
    street: "",
    area: "Lahore Cantt",
    city: "Lahore",
    region: "Punjab",
    // TODO(owner): confirm postal code of the office.
    postalCode: "54810",
    country: "PK",
    countryName: "Pakistan",
  },

  // TODO(owner): exact office coordinates (right-click the pin in Google Maps). Placeholder = Lahore Cantt.
  geo: { lat: 31.5204, lng: 74.3587 },

  // TODO(owner): real opening hours.
  openingHours: [{ days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], opens: "08:00", closes: "22:00" }] as OpeningHours[],

  /**
   * Optional non-numeric JSON-LD priceRange fallback, used only when the catalog has no models.
   * Prices never live here (ARCHITECTURE.md): the real range is computed from the catalog.
   */
  priceRange: null as string | null,
  paymentAccepted: ["Cash", "Bank transfer", "JazzCash", "Easypaisa"], // TODO(owner): confirm payment methods

  social: {
    // TODO(owner): real profile URLs. null = hidden everywhere.
    facebook: null as string | null,
    instagram: null as string | null,
    tiktok: null as string | null,
    youtube: null as string | null,
  },
  // TODO(owner): Google Business Profile share link (g.page / maps.app.goo.gl).
  googleBusinessProfileUrl: null as string | null,

  /** Lahore neighbourhoods with their own area page (/areas/<slug>/). */
  areasServed: [
    { slug: "lahore-cantt", name: "Lahore Cantt" },
    { slug: "dha-lahore", name: "DHA Lahore" },
    { slug: "gulberg", name: "Gulberg" },
    { slug: "johar-town", name: "Johar Town" },
    { slug: "model-town", name: "Model Town" },
    { slug: "bahria-town-lahore", name: "Bahria Town Lahore" },
    { slug: "askari", name: "Askari" },
    { slug: "wapda-town", name: "Wapda Town" },
  ] as AreaServed[],

  /** Outstation routes with their own page (/routes/<slug>/). */
  routes: [
    { slug: "lahore-to-islamabad", city: "Islamabad" },
    { slug: "lahore-to-murree", city: "Murree" },
    { slug: "lahore-to-naran-kaghan", city: "Naran Kaghan" },
    { slug: "lahore-to-hunza", city: "Hunza" },
    { slug: "lahore-to-skardu", city: "Skardu" },
    { slug: "lahore-to-swat", city: "Swat" },
    { slug: "lahore-to-sialkot", city: "Sialkot" },
    { slug: "lahore-to-faisalabad", city: "Faisalabad" },
    { slug: "lahore-to-multan", city: "Multan" },
    { slug: "lahore-to-kartarpur-nankana-sahib", city: "Kartarpur and Nankana Sahib" },
    { slug: "lahore-to-wagah-border", city: "Wagah Border" },
  ] as RouteServed[],

  /** Service landing pages (top-level URLs, see DESIGN.md). */
  services: [
    {
      slug: "rent-a-car-with-driver-lahore",
      name: "Rent a car with driver",
      shortName: "With driver",
      description: "A clean car and a driver who knows Lahore, for errands, family days out and business.",
      icon: "ph:steering-wheel",
      serviceType: "with_driver",
      tripType: "within_city",
    },
    {
      slug: "self-drive-car-rental-lahore",
      name: "Self drive car rental",
      shortName: "Self drive",
      description: "Drive yourself. Clear terms, a refundable deposit and a quick handover in Lahore Cantt.",
      icon: "ph:key",
      serviceType: "self_drive",
      tripType: "within_city",
    },
    {
      slug: "monthly-car-rental-lahore",
      name: "Monthly car rental",
      shortName: "Monthly",
      description: "Keep a car for a month or longer at a lower daily rate, with or without a driver.",
      icon: "ph:calendar-check",
      serviceType: "both",
      tripType: "monthly",
    },
    {
      slug: "lahore-airport-car-rental",
      name: "Airport pick and drop",
      shortName: "Airport",
      description: "Pickups and drop-offs at Allama Iqbal International Airport, timed to your flight.",
      icon: "ph:airplane-tilt",
      serviceType: "with_driver",
      tripType: "airport",
    },
    {
      slug: "wedding-car-rental-lahore",
      name: "Wedding car rental",
      shortName: "Weddings",
      description: "Decorated cars for the couple and matching cars for guests, for mehndi, baraat and walima.",
      icon: "ph:sparkle",
      serviceType: "with_driver",
      tripType: "wedding",
    },
    {
      slug: "corporate-car-rental-lahore",
      name: "Corporate car rental",
      shortName: "Corporate",
      description: "Cars and drivers for visiting teams, events and staff transport, billed to your company.",
      icon: "ph:briefcase",
      serviceType: "both",
      tripType: "corporate",
    },
    {
      slug: "luxury-car-rental-lahore",
      name: "Luxury car rental",
      shortName: "Luxury",
      description: "Executive sedans and premium SUVs with professional drivers for VIP movement.",
      icon: "ph:crown-simple",
      serviceType: "with_driver",
      tripType: "within_city",
    },
    {
      slug: "van-coaster-rental-lahore",
      name: "Van and coaster rental",
      shortName: "Vans and coasters",
      description: "Vans and coasters with drivers for group tours, staff transport and wedding guests.",
      icon: "ph:van",
      serviceType: "with_driver",
      tripType: "outstation",
    },
  ] as ServiceSummary[],

  /** Primary calls to action. One label per intent across the whole site. */
  cta: {
    quote: { label: "Get a quote", href: "/quote/" },
    whatsapp: { label: "WhatsApp us" },
    call: { label: "Call now" },
  },

  /** Default WhatsApp prefill (Roman Urdu where natural). */
  whatsappMessage: "Assalam o Alaikum! I need a car on rent in Lahore.",

  nav: {
    /** Desktop header: must fit on one line at 1024px next to the logo and CTAs. */
    primary: [
      { label: "Fleet", href: "/cars/" },
      { label: "With driver", href: "/rent-a-car-with-driver-lahore/" },
      { label: "Self drive", href: "/self-drive-car-rental-lahore/" },
      { label: "Weddings", href: "/wedding-car-rental-lahore/" },
      { label: "Outstation", href: "/routes/" },
      { label: "Rates", href: "/rates/" },
    ] as NavLink[],
    company: [
      { label: "About us", href: "/about/" },
      { label: "Rates", href: "/rates/" },
      { label: "FAQ", href: "/faq/" },
      { label: "Guides", href: "/guides/" },
      { label: "Policies", href: "/policies/" },
      { label: "Partner with us", href: "/partner-with-us/" },
      { label: "Contact", href: "/contact/" },
    ] as NavLink[],
  },
} as const;

export type Site = typeof site;

/** The primary phone (first in the list). */
export const primaryPhone = site.phones[0];

/** One-line address for display, skipping empty parts: "Lahore Cantt, Lahore, Punjab 54810, Pakistan". */
export function formatAddress(a: typeof site.address = site.address): string {
  const regionLine = [a.region, a.postalCode].filter(Boolean).join(" ");
  return [a.street, a.area, a.city, regionLine, a.countryName].filter(Boolean).join(", ");
}

const DAY_NAMES: Record<DayCode, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};
const DAY_ORDER: DayCode[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function dayName(code: DayCode): string {
  return DAY_NAMES[code];
}

/** "08:00" -> "8:00 am", "22:00" -> "10:00 pm", "23:59" -> "midnight". */
export function formatTime12(hhmm: string): string {
  if (hhmm === "23:59" || hhmm === "24:00") return "midnight";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Human hours lines, e.g. ["Every day, 8:00 am to 10:00 pm"]. No dashes (copy rule). */
export function formatOpeningHours(hours: OpeningHours[] = site.openingHours): string[] {
  return hours.map((h) => {
    const sorted = DAY_ORDER.filter((d) => h.days.includes(d));
    let days: string;
    if (sorted.length === 7) days = "Every day";
    else if (sorted.length > 2 && DAY_ORDER.indexOf(sorted[sorted.length - 1]) - DAY_ORDER.indexOf(sorted[0]) === sorted.length - 1)
      days = `${DAY_NAMES[sorted[0]]} to ${DAY_NAMES[sorted[sorted.length - 1]]}`;
    else days = sorted.map((d) => DAY_NAMES[d]).join(", ");
    return `${days}, ${formatTime12(h.opens)} to ${formatTime12(h.closes)}`;
  });
}

/** Social profiles that are set (for sameAs and footer icons). */
export function socialLinks(): { network: keyof typeof site.social; url: string; icon: string; label: string }[] {
  const meta: Record<keyof typeof site.social, { icon: string; label: string }> = {
    facebook: { icon: "simple-icons:facebook", label: "Facebook" },
    instagram: { icon: "simple-icons:instagram", label: "Instagram" },
    tiktok: { icon: "simple-icons:tiktok", label: "TikTok" },
    youtube: { icon: "simple-icons:youtube", label: "YouTube" },
  };
  return (Object.keys(site.social) as (keyof typeof site.social)[])
    .filter((k) => Boolean(site.social[k]))
    .map((k) => ({ network: k, url: site.social[k] as string, ...meta[k] }));
}

export function getService(slug: string): ServiceSummary | undefined {
  return site.services.find((s) => s.slug === slug);
}
export function getArea(slug: string): AreaServed | undefined {
  return site.areasServed.find((a) => a.slug === slug);
}
export function getRoute(slug: string): RouteServed | undefined {
  return site.routes.find((r) => r.slug === slug);
}

/**
 * Launch checklist: every fact above that is still a placeholder.
 * Remove an entry once the owner has confirmed the real value.
 */
export const PLACEHOLDER_FIELDS = [
  { field: "site.domain", label: "Production domain (also SITE_URL build variable)", value: site.domain },
  { field: "site.legalName", label: "Registered business name", value: site.legalName },
  { field: "site.phones[0]", label: "Primary phone number", value: site.phones[0].e164 },
  { field: "site.whatsapp", label: "WhatsApp Business number", value: site.whatsapp },
  { field: "site.email", label: "Email address", value: site.email },
  { field: "site.address.street", label: "Office street address", value: site.address.street },
  { field: "site.address.postalCode", label: "Office postal code", value: site.address.postalCode },
  { field: "site.geo", label: "Office map coordinates", value: `${site.geo.lat}, ${site.geo.lng}` },
  { field: "site.openingHours", label: "Opening hours", value: formatOpeningHours().join("; ") },
  { field: "site.paymentAccepted", label: "Accepted payment methods", value: site.paymentAccepted.join(", ") },
  { field: "site.social", label: "Social media profile links", value: "none set" },
  { field: "site.googleBusinessProfileUrl", label: "Google Business Profile link", value: "not set" },
  { field: "site.foundingYear", label: "Year founded (optional)", value: "not set" },
  { field: "wrangler.jsonc vars.TURNSTILE_SITE_KEY", label: "Real Cloudflare Turnstile site key", value: "test key" },
  { field: "src/data/catalog.sample.json", label: "Real fleet and prices (publish from the control panel)", value: "sample fleet" },
] as const;

export type PlaceholderField = (typeof PLACEHOLDER_FIELDS)[number]["field"];

export function isPlaceholder(field: PlaceholderField): boolean {
  return PLACEHOLDER_FIELDS.some((p) => p.field === field);
}
