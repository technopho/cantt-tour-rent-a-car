/**
 * Rental terms: the ONE place each policy is stated. Service, area, fleet and rate pages, the home
 * page, /faq/, /policies/ and markdown content all read these values instead of restating them, so
 * two pages can never give a customer different rules.
 *
 * TODO(owner): every value here is a sensible default for a Lahore rent a car, NOT a confirmed
 * business fact. Confirm or change each one before launch (listed in the build report). Prices
 * never live here: rates, deposits, km allowances, overtime and night allowances come from the
 * catalog (control panel).
 *
 * TODO(owner): the values marked "CHOSEN DEFAULT" were picked in the October 2026 copy audit
 * because different pages stated different rules. Please confirm each one specifically:
 *   cityDayWindow       8 am to 8 pm (fleet and rate pages said 9 am to 9 pm)
 *   selfDriveHandover   Cantt office by default, delivery to your address on request (some area
 *                       pages said Cantt office only)
 *   selfDriveOutstation allowed with written approval (the home FAQ said outstation = with driver only)
 *   fuelWithDriver      paid as you go or a fixed amount in the quote (rate and car pages said fuel is
 *                       never included)
 *   weddingSeason       November to February (the home FAQ said October to March)
 *   weddingPeakDays     Friday to Sunday (pages said Fri/Sat, Fri/Sun and Sat/Sun)
 *
 * How to use:
 *   .astro / .ts files      import { TERMS } and interpolate, e.g. `returned ${TERMS.selfDriveHandover}`
 *   frontmatter strings     {{key}} tokens, replaced by fillTerms() in the page (services, area and route FAQs);
 *                           unknown tokens fail the build
 *   markdown bodies         tokens are NOT replaced there, so body prose avoids restating these
 *                           values. The few that still do must be updated with this file:
 *                           self-drive-car-rental-lahore.md and askari.md (handover place),
 *                           cost-to-rent-a-car-in-lahore.md (wedding season).
 * Phrases are written to sit mid-sentence (lower case, no final period).
 *
 * Leaf module on purpose (no imports): fleet-data.ts, category-copy.ts and home-data.ts import it
 * without import cycles.
 */

export const TERMS = {
  /** Standard duty hours in a with-driver city day (owner confirmed for the fleet pages). Re-exported as CITY_DAY_HOURS by fleet-data.ts. */
  cityDayHours: 12,
  /** CHOSEN DEFAULT. Example window for the city day, plain words (no dashes). */
  cityDayWindow: "8 am to 8 pm",
  /** Free waiting at Allama Iqbal International Airport after the flight actually lands. */
  airportFreeWaitMinutes: 60,
  /** Grace period on late returns before extra time is charged. */
  lateGraceMinutes: 60,
  /** A late return longer than this is charged as an extra day. */
  lateFullDayAfterHours: 4,
  /** Free cancellation window before pickup (regular bookings). */
  freeCancelHours: 24,
  /** Wedding and peak-date bookings: inside this many days the advance may be kept. */
  weddingCancelDays: 7,
  /** Self drive deposit refund, counted from the return of the car. */
  depositRefundDays: 7,
  /** Minimum age for self drive. */
  selfDriveMinAge: 21,
  /** Typical replacement time for a monthly car that needs a workshop visit (Lahore). */
  replacementHours: 24,
  /** CHOSEN DEFAULT. Where self drive cars are handed over and returned: "handed over {{selfDriveHandover}}". */
  selfDriveHandover: "at our Lahore Cantt office, or at your address in Lahore on request",
  /** CHOSEN DEFAULT. When a self drive car may leave Lahore: "can leave Lahore {{selfDriveOutstation}}". */
  selfDriveOutstation: "only with our written approval, given before you leave",
  /** CHOSEN DEFAULT. Fuel on a car with driver (the published rates never include fuel): "fuel is {{fuelWithDriver}}". */
  fuelWithDriver: "either paid as you go or agreed as a fixed amount in your quote",
  /** Fuel on self drive: "the fuel rule is {{fuelSelfDrive}}". Missing fuel is charged at the current pump price. */
  fuelSelfDrive: "same level to same level, so you return the car with the fuel level noted at handover",
  /** CHOSEN DEFAULT. Lahore's busy wedding season: "the {{weddingSeason}} wedding season". */
  weddingSeason: "November to February",
  /** CHOSEN DEFAULT. Busiest wedding days: "{{weddingPeakDays}} functions". */
  weddingPeakDays: "Friday to Sunday",
} as const;

export type TermKey = keyof typeof TERMS;

/** Replace {{key}} tokens with TERMS values. Unknown tokens fail the build (catches typos). */
export function fillTerms(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in TERMS)) throw new Error(`[terms] Unknown token {{${key}}} in content.`);
    return String(TERMS[key as TermKey]);
  });
}
