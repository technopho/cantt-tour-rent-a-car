/**
 * Transparent, client-safe price estimate from catalog rates.
 * Dependency-free (only types + formatPKR), so the quote island can import it without pulling the
 * catalog loader or zod into the browser bundle:
 *
 *   import { estimateQuote, rentalDays } from "@/lib/estimate";
 *
 * The estimate is informational. The team confirms the final price on WhatsApp.
 */
import type { CatalogRates, ServiceType, TripType } from "./catalog-types";
import { formatPKR } from "./format";

export type { ServiceType, TripType } from "./catalog-types";

/** Anything with catalog rates (a full CatalogModel works). */
export interface EstimatableModel {
  rates: CatalogRates;
  make?: string;
  model?: string;
}

export interface EstimateInput {
  serviceType: ServiceType;
  tripType: TripType;
  /** Rental days (24h blocks). Fractions round up; minimum 1. */
  days: number;
  /** Overnight stays away from Lahore (driver night allowance). Defaults to days - 1 for outstation trips. */
  nights?: number;
}

export type EstimateUnit = "day" | "week" | "month" | "night";

export interface EstimateLine {
  /** Plain-English line label, e.g. "Car with driver, outstation". */
  label: string;
  quantity: number;
  unit: EstimateUnit;
  /** Price per unit (PKR). */
  rate: number;
  /** quantity x rate (PKR). */
  amount: number;
}

export interface QuoteEstimate {
  /** false when this car is not offered for the requested service (see `reason`). */
  ok: boolean;
  reason: string | null;
  serviceType: ServiceType;
  tripType: TripType;
  days: number;
  nights: number;
  lines: EstimateLine[];
  /** Sum of lines (PKR). Excludes the refundable deposit. */
  total: number;
  /** Effective average per day (PKR, rounded). */
  perDay: number;
  /** Refundable security deposit for self drive (PKR), not part of `total`. */
  securityDeposit: number | null;
  kmPerDay: number | null;
  overtimeHourly: number | null;
  /** Caveats to show under the number. Always includes the "estimate only" line. */
  notes: string[];
}

export const ESTIMATE_DISCLAIMER = "This is an estimate. Our team confirms the final price on WhatsApp before you book.";

const DAYS_PER_MONTH = 30;
const DAYS_PER_WEEK = 7;

function emptyEstimate(input: EstimateInput, days: number, nights: number, reason: string): QuoteEstimate {
  return {
    ok: false,
    reason,
    serviceType: input.serviceType,
    tripType: input.tripType,
    days,
    nights,
    lines: [],
    total: 0,
    perDay: 0,
    securityDeposit: null,
    kmPerDay: null,
    overtimeHourly: null,
    notes: [ESTIMATE_DISCLAIMER],
  };
}

function line(label: string, quantity: number, unit: EstimateUnit, rate: number): EstimateLine {
  return { label, quantity, unit, rate, amount: quantity * rate };
}

/**
 * Split `days` into the cheapest combination of month / week / day blocks.
 * Greedy with caps: leftover days never cost more than the next bigger block.
 */
function blocks(days: number, daily: number, weekly: number | null, monthly: number | null) {
  let months = 0;
  let weeks = 0;
  let rest = days;

  if (monthly && rest >= DAYS_PER_MONTH) {
    months = Math.floor(rest / DAYS_PER_MONTH);
    rest -= months * DAYS_PER_MONTH;
  }
  if (weekly && rest >= DAYS_PER_WEEK) {
    weeks = Math.floor(rest / DAYS_PER_WEEK);
    rest -= weeks * DAYS_PER_WEEK;
  }
  // Leftover days priced above a week? Round up to a week.
  if (weekly && rest > 0 && rest * daily >= weekly) {
    weeks += 1;
    rest = 0;
  }
  // Weeks + days above a month? Round up to a month.
  if (monthly && (weeks > 0 || rest > 0) && weeks * (weekly ?? 0) + rest * daily >= monthly) {
    months += 1;
    weeks = 0;
    rest = 0;
  }
  return { months, weeks, rest };
}

export function estimateQuote(model: EstimatableModel, input: EstimateInput): QuoteEstimate {
  const days = Math.max(1, Math.ceil(Number.isFinite(input.days) ? input.days : 1));
  const isOutstation = input.tripType === "outstation";
  const nights = Math.max(0, Math.floor(input.nights ?? (isOutstation ? days - 1 : 0)));
  const { rates } = model;
  const notes: string[] = [];
  const lines: EstimateLine[] = [];

  if (input.serviceType === "with_driver") {
    const r = rates.withDriver;
    if (!r) return emptyEstimate(input, days, nights, "This car is available for self drive only.");

    if (input.tripType === "monthly" && r.monthly && days >= DAYS_PER_MONTH) {
      const b = blocks(days, r.daily, null, r.monthly);
      if (b.months) lines.push(line("Car with driver, monthly", b.months, "month", r.monthly));
      if (b.rest) lines.push(line("Car with driver, extra days", b.rest, "day", r.daily));
    } else {
      const rate = isOutstation ? (r.outstationDaily ?? r.daily) : r.daily;
      lines.push(line(isOutstation ? "Car with driver, outstation" : "Car with driver", days, "day", rate));
    }

    if (isOutstation && nights > 0 && rates.driverNightAllowance) {
      lines.push(line("Driver night stay allowance", nights, "night", rates.driverNightAllowance));
    }

    notes.push("Fuel, tolls and parking are not included in this estimate.");
    if (r.overtimeHourly) notes.push(`Driver overtime is ${formatPKR(r.overtimeHourly)}/hour beyond standard duty hours.`);
    if (input.tripType === "airport") notes.push("Airport pick and drop is often priced per trip. We will confirm the best option.");
    notes.push(ESTIMATE_DISCLAIMER);

    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    return {
      ok: true,
      reason: null,
      serviceType: input.serviceType,
      tripType: input.tripType,
      days,
      nights,
      lines,
      total,
      perDay: Math.round(total / days),
      securityDeposit: null,
      kmPerDay: null,
      overtimeHourly: r.overtimeHourly,
      notes,
    };
  }

  const r = rates.selfDrive;
  if (!r) return emptyEstimate(input, days, nights, "This car is only available with a driver.");

  const b = blocks(days, r.daily, r.weekly, r.monthly);
  if (b.months && r.monthly) lines.push(line("Self drive, monthly", b.months, "month", r.monthly));
  if (b.weeks && r.weekly) lines.push(line("Self drive, weekly", b.weeks, "week", r.weekly));
  if (b.rest) lines.push(line("Self drive", b.rest, "day", r.daily));

  notes.push("Fuel is not included in this estimate.");
  if (r.kmPerDay) notes.push(`Mileage allowance: ${r.kmPerDay} km per day.`);
  if (r.securityDeposit) notes.push(`Refundable security deposit of ${formatPKR(r.securityDeposit)}, collected at handover.`);
  notes.push(ESTIMATE_DISCLAIMER);

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return {
    ok: true,
    reason: null,
    serviceType: input.serviceType,
    tripType: input.tripType,
    days,
    nights,
    lines,
    total,
    perDay: Math.round(total / days),
    securityDeposit: r.securityDeposit,
    kmPerDay: r.kmPerDay,
    overtimeHourly: null,
    notes,
  };
}

/**
 * Rental days between pickup and return: 24h blocks rounded up (minimum 1) and calendar nights.
 * Inputs are Date objects or epoch ms.
 */
export function rentalDays(pickupAt: Date | number, returnAt: Date | number): { days: number; nights: number } {
  const start = typeof pickupAt === "number" ? pickupAt : pickupAt.getTime();
  const end = typeof returnAt === "number" ? returnAt : returnAt.getTime();
  const ms = Math.max(0, end - start);
  const days = Math.max(1, Math.ceil(ms / 86_400_000));
  // Calendar nights in Pakistan time (UTC+5, no DST).
  const PKT = 5 * 3_600_000;
  const dayIndex = (t: number) => Math.floor((t + PKT) / 86_400_000);
  const nights = Math.max(0, dayIndex(end) - dayIndex(start));
  return { days, nights };
}

/** Lowest daily price for a service type, or null if the car is not offered that way. */
export function dailyRateFor(model: EstimatableModel, serviceType: ServiceType): number | null {
  return serviceType === "with_driver" ? (model.rates.withDriver?.daily ?? null) : (model.rates.selfDrive?.daily ?? null);
}
