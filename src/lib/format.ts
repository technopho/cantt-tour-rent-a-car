/**
 * Formatting helpers. Dependency-free and safe in Svelte islands.
 * Money is integer PKR rupees everywhere (same convention as the control panel).
 */

const pkrNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 12500 -> "Rs 12,500". Matches the control panel's formatPKR(). */
export function formatPKR(amount: number): string {
  return `Rs ${pkrNumber.format(Math.round(amount))}`;
}

/** 12500 -> "12,500" (no currency). */
export function formatNumber(value: number): string {
  return pkrNumber.format(value);
}

export type PriceUnit = "day" | "week" | "month" | "hour" | "night" | "trip";

/** 6500, "day" -> "Rs 6,500/day". */
export function formatRate(amount: number, unit: PriceUnit = "day"): string {
  return `${formatPKR(amount)}/${unit}`;
}

/** 4.5 -> "4 h 30 min", 6 -> "6 h", 0.75 -> "45 min". */
export function formatDriveTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** 375 -> "375 km". */
export function formatKm(km: number): string {
  return `${pkrNumber.format(km)} km`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

/** Date -> "11 Oct 2026" in Pakistan time. */
export function formatDate(date: Date | string | number): string {
  return dateFmt.format(new Date(date));
}

/** Date -> "2026-10-11" (for <time datetime>). */
export function isoDate(date: Date | string | number): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** "+923001234567" -> "0300 1234567". Returns the input unchanged if it is not a PK mobile. */
export function formatPkPhone(e164: string): string {
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]}` : e164;
}

/** Normalise user-typed Pakistani numbers to E.164: "0300-1234567" -> "+923001234567". Null if invalid. */
export function normalizePkPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^3\d{9}$/.test(d) ? `+92${d}` : null;
}

/** Pluralise a simple English noun: plural(3, "day") -> "3 days". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
