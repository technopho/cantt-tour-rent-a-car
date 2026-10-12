/**
 * Pure trip logic for the TripComposer island: option lists, Pakistan-time date helpers,
 * validation, the live estimate and the plain-text trip summary used for WhatsApp messages.
 * No DOM access, no dependencies beyond the dependency-free estimate/format helpers.
 */
import type { ServiceType, TripType } from "@/lib/catalog-types";
import { ESTIMATE_DISCLAIMER, estimateQuote, rentalDays, type QuoteEstimate } from "@/lib/estimate";
import { formatPKR } from "@/lib/format";
import type { ComposerModel, ListOption, PlaceSuggestion, TripState } from "./types";

/* ------------------------------------------------------------------------------------------ */
/* Options                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export const SERVICE_TYPES: readonly ServiceType[] = ["with_driver", "self_drive"];
export const TRIP_TYPES: readonly TripType[] = ["within_city", "outstation", "airport", "wedding", "monthly", "corporate"];

/** What the sentence says inside the bracket. */
export const SERVICE_PHRASE: Record<ServiceType, string> = {
  with_driver: "with a driver",
  self_drive: "to drive myself",
};

export const SERVICE_OPTIONS: { value: ServiceType; label: string; hint: string }[] = [
  { value: "with_driver", label: "With a driver", hint: "A driver who knows Lahore comes with the car" },
  { value: "self_drive", label: "Self drive", hint: "You drive. Refundable deposit, handover in Lahore Cantt" },
];

export const TRIP_PHRASE: Record<TripType, string> = {
  within_city: "trips within Lahore",
  outstation: "an outstation trip",
  airport: "an airport transfer",
  wedding: "a wedding or event",
  monthly: "a monthly rental",
  corporate: "corporate travel",
};

export const TRIP_OPTIONS: { value: TripType; label: string; hint: string }[] = [
  { value: "within_city", label: "Within Lahore", hint: "Errands, family days out, meetings across the city" },
  { value: "outstation", label: "Outstation", hint: "Islamabad, Murree, the north and other cities" },
  { value: "airport", label: "Airport transfer", hint: "Pick or drop at Allama Iqbal International (LHE)" },
  { value: "wedding", label: "Wedding or event", hint: "Mehndi, baraat, walima and cars for guests" },
  { value: "monthly", label: "Monthly", hint: "30 days or more at a lower rate" },
  { value: "corporate", label: "Corporate", hint: "Visiting teams, events and staff transport" },
];

export const AIRPORT_PICKUP = "Allama Iqbal International Airport (LHE)";

/** Short list of pickup areas (free text is always allowed). */
export const PICKUP_SUGGESTIONS: PlaceSuggestion[] = [
  { label: "DHA Lahore", hint: "Defence, all phases" },
  { label: "Gulberg", hint: "Main Boulevard, Liberty, MM Alam Road" },
  { label: "Lahore Cantt", hint: "Our office area" },
  { label: "Johar Town" },
  { label: "Model Town" },
  { label: "Bahria Town" },
  { label: "Askari" },
  { label: AIRPORT_PICKUP, hint: "Arrivals or departures" },
  { label: "Lahore Railway Station" },
  { label: "Wapda Town" },
];

/* ------------------------------------------------------------------------------------------ */
/* Pakistan time (UTC+5, no DST)                                                                */
/* ------------------------------------------------------------------------------------------ */

export const PKT_OFFSET_MS = 5 * 3_600_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Days since epoch in Pakistan time (for "today" / "tomorrow" comparisons). */
export function pktDayIndex(ms: number): number {
  return Math.floor((ms + PKT_OFFSET_MS) / DAY_MS);
}

/** Epoch ms of 00:00 Pakistan time on the given PKT day index. */
function pktMidnight(dayIndex: number): number {
  return dayIndex * DAY_MS - PKT_OFFSET_MS;
}

interface PktParts {
  year: number;
  month: number; // 1-12
  day: number;
  hours: number;
  minutes: number;
  weekday: number; // 0 = Sunday
}

export function pktParts(ms: number): PktParts {
  const d = new Date(ms + PKT_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** Values for <input type="date"> and <input type="time"> in Pakistan time. */
export function toPktInputs(ms: number): { date: string; time: string } {
  const p = pktParts(ms);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hours)}:${pad(p.minutes)}` };
}

/** "2026-10-14" + "10:30" (Pakistan time) -> epoch ms, or null when incomplete/invalid. */
export function fromPktInputs(date: string, time: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [Number(dm[1]), Number(dm[2]), Number(dm[3]), Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi) - PKT_OFFSET_MS;
  return Number.isFinite(ms) ? ms : null;
}

/** "10:00 am", "12:30 pm". */
export function time12(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(minutes)} ${suffix}`;
}

/**
 * Short label for the sentence: "today, 4:00 pm", "tomorrow, 10:00 am", "Wed 14 Oct, 10:00 am"
 * (year added when it is not the current one). Relative words keep the server-rendered default
 * identical to the hydrated one whatever day the page was built.
 */
export function formatWhen(ms: number, now: number): string {
  const p = pktParts(ms);
  const diff = pktDayIndex(ms) - pktDayIndex(now);
  const time = time12(p.hours, p.minutes);
  if (diff === 0) return `today, ${time}`;
  if (diff === 1) return `tomorrow, ${time}`;
  const year = p.year !== pktParts(now).year ? ` ${p.year}` : "";
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}${year}, ${time}`;
}

/** "8:00 pm" in Pakistan time. */
function timeOnly(ms: number): string {
  const p = pktParts(ms);
  return time12(p.hours, p.minutes);
}

/** Absolute label for messages read later by staff: "Wed 14 Oct 2026, 10:00 am". */
export function formatWhenAbsolute(ms: number): string {
  const p = pktParts(ms);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${time12(p.hours, p.minutes)}`;
}

/** Default trip window: tomorrow 10:00 am to 8:00 pm (a full day with a driver); monthly = 30 days. */
export function defaultWindow(now: number, tripType: TripType): { pickupAt: number; returnAt: number } {
  const pickupAt = pktMidnight(pktDayIndex(now) + 1) + 10 * HOUR_MS;
  const returnAt = tripType === "monthly" ? pickupAt + 30 * DAY_MS : pickupAt + 10 * HOUR_MS;
  return { pickupAt, returnAt };
}

/** Quick picks for the pickup panel: today (if there is time left), tomorrow, the coming Saturday. */
export function pickupShortcuts(now: number, currentPickup: number): { label: string; value: number }[] {
  const { hours, minutes } = pktParts(currentPickup);
  const timeOfDay = hours * HOUR_MS + minutes * 60_000;
  const today = pktDayIndex(now);
  const weekday = pktParts(now).weekday;
  const toSaturday = ((6 - weekday + 7) % 7) || 7;
  const out: { label: string; value: number }[] = [];
  const todayAt = pktMidnight(today) + timeOfDay;
  if (todayAt > now + HOUR_MS) out.push({ label: "Today", value: todayAt });
  out.push({ label: "Tomorrow", value: pktMidnight(today + 1) + timeOfDay });
  if (toSaturday > 1) {
    out.push({ label: toSaturday === 7 ? "Next Saturday" : "Saturday", value: pktMidnight(today + toSaturday) + timeOfDay });
  }
  return out;
}

/** Quick picks for the return panel, relative to pickup. */
export function returnShortcuts(pickupAt: number): { label: string; value: number }[] {
  return [
    { label: "Same day, 8:00 pm", value: Math.max(pickupAt + HOUR_MS, pktMidnight(pktDayIndex(pickupAt)) + 20 * HOUR_MS) },
    { label: "2 days", value: pickupAt + 2 * DAY_MS },
    { label: "3 days", value: pickupAt + 3 * DAY_MS },
    { label: "1 week", value: pickupAt + 7 * DAY_MS },
    { label: "1 month", value: pickupAt + 30 * DAY_MS },
  ].filter((s, i, all) => s.value > pickupAt && all.findIndex((o) => o.value === s.value) === i);
}

/* ------------------------------------------------------------------------------------------ */
/* Validation                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export type TripErrorKey = "from" | "to" | "pickup" | "destination";

/** Longest window the form accepts (the API allows a little more). */
export const MAX_RENTAL_DAYS = 366;

export function validateTrip(trip: TripState, now: number): Partial<Record<TripErrorKey, string>> {
  const errors: Partial<Record<TripErrorKey, string>> = {};
  if (trip.pickupAt < now - 30 * 60_000) errors.from = "Pickup time has passed. Choose a time from now on.";
  if (trip.returnAt <= trip.pickupAt) errors.to = "Return must be after pickup.";
  else if (trip.returnAt - trip.pickupAt > MAX_RENTAL_DAYS * DAY_MS) errors.to = "For rentals longer than a year, please WhatsApp us.";
  if (!trip.pickup.trim()) errors.pickup = "Tell us where to pick you up.";
  if (trip.tripType === "outstation" && !trip.destination.trim()) errors.destination = "Tell us where you are heading.";
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Estimate                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export type EstimateResult =
  | { ok: true; estimate: QuoteEstimate; model: ComposerModel; any: boolean }
  | { ok: false; message: string };

function offers(model: ComposerModel, service: ServiceType): boolean {
  return service === "with_driver" ? Boolean(model.rates.withDriver) : Boolean(model.rates.selfDrive);
}

/** Catalog suitableFor tag that matches a trip type (within Lahore suits every car). */
function tripTag(trip: TripType): string | null {
  return trip === "within_city" ? null : trip;
}

/** Cars that make sense for "any suitable car": offered for the service, tagged for the trip, seats enough. */
export function eligibleModels(models: ComposerModel[], service: ServiceType, trip: TripType, passengers: number | null): ComposerModel[] {
  let list = models.filter((m) => offers(m, service));
  const tag = tripTag(trip);
  if (tag) {
    const tagged = list.filter((m) => m.suitableFor?.includes(tag));
    if (tagged.length) list = tagged;
  }
  if (passengers) list = list.filter((m) => m.seats >= passengers);
  return list;
}

export function computeEstimate(models: ComposerModel[], trip: TripState, passengers: number | null): EstimateResult {
  if (trip.returnAt <= trip.pickupAt) return { ok: false, message: "Choose a return time after pickup to see an estimate." };
  const { days, nights } = rentalDays(trip.pickupAt, trip.returnAt);
  const input = {
    serviceType: trip.serviceType,
    tripType: trip.tripType,
    days,
    nights: trip.tripType === "outstation" ? nights : undefined,
  };

  const selected = models.find((m) => m.slug === trip.modelSlug);
  if (selected) {
    const estimate = estimateQuote(selected, input);
    return estimate.ok ? { ok: true, estimate, model: selected, any: false } : { ok: false, message: estimate.reason ?? ESTIMATE_DISCLAIMER };
  }

  const candidates = eligibleModels(models, trip.serviceType, trip.tripType, passengers);
  if (candidates.length === 0) {
    return {
      ok: false,
      message: passengers
        ? `For ${passengers} passengers we will suggest the right vehicles, or more than one.`
        : "Tell us your trip and we will suggest the right car.",
    };
  }
  let best: { estimate: QuoteEstimate; model: ComposerModel } | null = null;
  for (const model of candidates) {
    const estimate = estimateQuote(model, input);
    if (estimate.ok && (!best || estimate.total < best.estimate.total)) best = { estimate, model };
  }
  return best ? { ok: true, ...best, any: true } : { ok: false, message: "Tell us your trip and we will suggest the right car." };
}

/** "from Rs 6,500/day" for a car option, using the rate for the chosen service when offered. */
export function optionPrice(model: ComposerModel, service: ServiceType): string {
  const rate = service === "with_driver" ? model.rates.withDriver?.daily : model.rates.selfDrive?.daily;
  return `from ${formatPKR(rate ?? model.rates.fromPrice)}/day`;
}

/** Listbox options for the car bracket: "Any suitable car", then models grouped by category. */
export function carOptions(models: ComposerModel[], service: ServiceType): ListOption[] {
  const any: ListOption = { value: "", label: "Any suitable car", hint: "We suggest the best fit for your trip" };
  return [
    any,
    ...models.map((m) => ({
      value: m.slug,
      label: m.name,
      group: m.categoryName,
      hint: offers(m, service)
        ? `${m.seats} seats`
        : `${m.seats} seats, ${service === "self_drive" ? "with a driver only" : "self drive only"}`,
      meta: optionPrice(m, service),
    })),
  ];
}

/** Categories the control panel accepts for inquiries (control-panel/shared/constants.ts CAR_CATEGORIES). */
const PANEL_CATEGORIES = new Set(["hatchback", "sedan", "suv", "luxury", "van", "coaster", "pickup", "wedding"]);

export function inquiryCategory(model: ComposerModel | undefined): string | undefined {
  return model && PANEL_CATEGORIES.has(model.category) ? model.category : undefined;
}

/** Vans and coasters (and "any car") ask for the passenger count. */
export function wantsPassengers(model: ComposerModel | undefined): boolean {
  return !model || model.category === "van" || model.category === "coaster" || model.seats > 7;
}

/* ------------------------------------------------------------------------------------------ */
/* Plain-text summary (WhatsApp messages, step 2 recap)                                         */
/* ------------------------------------------------------------------------------------------ */

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function carPhrase(model: ComposerModel | undefined): string {
  return model ? `${article(model.name)} ${model.name}` : "any suitable car";
}

/**
 * "I need a Toyota Corolla Altis with a driver for an outstation trip to Murree from
 * Wed 14 Oct 2026, 10:00 am to Fri 16 Oct 2026, 6:00 pm, picking up in DHA Lahore."
 */
export function tripSentence(trip: TripState, models: ComposerModel[]): string {
  const model = models.find((m) => m.slug === trip.modelSlug);
  const to = trip.tripType === "outstation" && trip.destination.trim() ? ` to ${trip.destination.trim()}` : "";
  const pickup = trip.pickup.trim() ? `, picking up in ${trip.pickup.trim()}` : "";
  // Same day: "from Mon 12 Oct 2026, 10:00 am to 8:00 pm" (no repeated date).
  const back = pktDayIndex(trip.returnAt) === pktDayIndex(trip.pickupAt) ? timeOnly(trip.returnAt) : formatWhenAbsolute(trip.returnAt);
  return (
    `I need ${carPhrase(model)} ${SERVICE_PHRASE[trip.serviceType]} for ${TRIP_PHRASE[trip.tripType]}${to} ` +
    `from ${formatWhenAbsolute(trip.pickupAt)} to ${back}${pickup}.`
  );
}

export function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
