/**
 * Contact link builders (WhatsApp, phone, email). Dependency-free apart from site.ts;
 * safe in Svelte islands (e.g. the quote success screen builds a WhatsApp link with the ref).
 */
import { primaryPhone, site } from "@/config/site";

/** https://wa.me/923000000000?text=... (number digits only, message optional). */
export function whatsappUrl(message: string | null = site.whatsappMessage, number: string = site.whatsapp): string {
  const digits = number.replace(/\D/g, "");
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
}

/** tel:+923000000000 */
export function telUrl(e164: string = primaryPhone.e164): string {
  return `tel:${e164.replace(/[^\d+]/g, "")}`;
}

/** mailto:hello@...?subject=... */
export function mailtoUrl(email: string = site.email, subject?: string): string {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}

/** Google Maps link for the office coordinates (used for hasMap and "Directions" links). */
export function mapsUrl(): string {
  return site.googleBusinessProfileUrl ?? `https://www.google.com/maps/search/?api=1&query=${site.geo.lat},${site.geo.lng}`;
}

/** Prefilled WhatsApp message for a specific car: "Assalam o Alaikum! I'd like a quote for the Toyota Corolla Altis." */
export function whatsappForModel(modelName: string): string {
  return whatsappUrl(`Assalam o Alaikum! I'd like a quote for the ${modelName}.`);
}
