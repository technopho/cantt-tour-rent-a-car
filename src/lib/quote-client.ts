/**
 * Browser helpers for the quote form (TripComposer island). Dependency-free and tiny:
 *  - submitQuote()        POST /api/quote with a timeout, normalised result
 *  - captureAttribution() landing page + UTM / click ids for the inquiry (first touch per tab)
 *  - loadDraft/saveDraft  unsent form draft in sessionStorage (every access wrapped in try/catch)
 *  - loadTurnstile()      Cloudflare Turnstile api.js, loaded on demand (step 2 only)
 *
 * The request/response shapes mirror src/pages/api/quote.ts and ARCHITECTURE.md section 7.
 */
import type { ServiceType, TripType } from "./catalog-types";
import { normalizePkPhone } from "./format";

/* ------------------------------------------------------------------------------------------ */
/* Contract                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Trailing slash required: astro.config trailingSlash "always" applies to the on-demand route too. */
export const QUOTE_ENDPOINT = "/api/quote/";

/** Body of POST /api/quote. The API normalises the phone and forwards everything except the bot checks. */
export interface QuotePayload {
  name: string;
  phone: string;
  email?: string;
  modelSlug?: string;
  category?: string;
  serviceType: ServiceType;
  tripType: TripType;
  /** Epoch ms (UTC). */
  pickupAt: number;
  returnAt: number;
  pickupLocation?: string;
  destination?: string;
  passengers?: number;
  message?: string;
  /** The estimate shown to the visitor (informational). */
  estimateTotal?: number;
  landingPage?: string;
  utm?: Record<string, string>;
  /** Honeypot: must stay empty. */
  website: string;
  turnstileToken: string;
}

export type QuoteField = "name" | "phone" | "email" | "passengers" | "message" | "pickupAt" | "returnAt";
export type QuoteFieldErrors = Partial<Record<QuoteField, string>>;
export type QuoteErrorCode = "validation" | "turnstile" | "rate_limited" | "network" | "server";

export type QuoteResult =
  | { ok: true; ref: string }
  | { ok: false; code: QuoteErrorCode; error: string; fields?: QuoteFieldErrors };

const MSG_NETWORK = "We could not reach our server. Check your connection and try again, or send your trip on WhatsApp.";
const MSG_SERVER = "Something went wrong on our side. Please try again in a minute, or send your trip on WhatsApp.";
const MSG_RATE = "Too many requests from your connection. Please wait a minute, or send your trip on WhatsApp.";

export async function submitQuote(payload: QuotePayload, timeoutMs = 20_000): Promise<QuoteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(QUOTE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      signal: controller.signal,
    });
    let data: { ok?: boolean; ref?: unknown; error?: unknown; code?: unknown; fields?: unknown } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null; // HTML error page (WAF block, 404 before deploy, ...)
    }
    if (res.ok && data?.ok && typeof data.ref === "string") return { ok: true, ref: data.ref };

    const code: QuoteErrorCode =
      res.status === 429 ? "rate_limited" : data?.code === "turnstile" ? "turnstile" : res.status === 400 || res.status === 422 ? "validation" : "server";
    const error = typeof data?.error === "string" ? data.error : code === "rate_limited" ? MSG_RATE : MSG_SERVER;
    const fields = data?.fields && typeof data.fields === "object" ? (data.fields as QuoteFieldErrors) : undefined;
    return { ok: false, code, error, fields };
  } catch {
    return { ok: false, code: "network", error: MSG_NETWORK };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Field checks (the API validates again with zod)                                             */
/* ------------------------------------------------------------------------------------------ */

export const PHONE_ERROR = "Enter a Pakistani mobile number, e.g. 0300 1234567. No Pakistani number? WhatsApp us instead.";

/** Null when valid, else a friendly message. Accepts 03XXXXXXXXX, +923XXXXXXXXX, 923..., with spaces or dashes. */
export function phoneError(input: string): string | null {
  if (!input.trim()) return "Enter your mobile number so we can send the price.";
  return normalizePkPhone(input) ? null : PHONE_ERROR;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  return v.length <= 120 && EMAIL_RE.test(v) ? null : "Enter a valid email address, or leave it empty.";
}

/* ------------------------------------------------------------------------------------------ */
/* Storage (sessionStorage can be missing or throw: private mode, blocked storage, previews)    */
/* ------------------------------------------------------------------------------------------ */

function readJson<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the form still works, the draft just is not kept */
  }
}

function removeKey(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const DRAFT_KEY = "cantt:quote-draft:v1";

export function loadDraft<T>(): T | null {
  return readJson<T>(DRAFT_KEY);
}
export function saveDraft(value: unknown): void {
  writeJson(DRAFT_KEY, value);
}
export function clearDraft(): void {
  removeKey(DRAFT_KEY);
}

/* ------------------------------------------------------------------------------------------ */
/* Attribution                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const ATTR_KEY = "cantt:attribution:v1";
const TRACKED_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid", "msclkid"];

interface StoredAttribution {
  landingPage: string;
  utm: Record<string, string>;
  referrer?: string;
}

export interface Attribution {
  landingPage: string;
  utm?: Record<string, string>;
}

/** External referrer as origin + path (query dropped), or undefined for internal/none. */
function externalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const ref = new URL(document.referrer);
    if (ref.host === window.location.host) return undefined;
    return `${ref.origin}${ref.pathname}`.slice(0, 120);
  } catch {
    return undefined;
  }
}

/**
 * First page seen in this tab (with its query), the latest campaign parameters and the external
 * referrer. Safe to call on every page; the composer calls it on mount and again on submit.
 */
export function captureAttribution(): Attribution {
  const url = new URL(window.location.href);
  const current: Record<string, string> = {};
  for (const key of TRACKED_PARAMS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) current[key] = value.slice(0, 120);
  }

  const stored: StoredAttribution = readJson<StoredAttribution>(ATTR_KEY) ?? {
    landingPage: `${url.pathname}${url.search}`.slice(0, 300),
    utm: {},
    referrer: externalReferrer(),
  };
  if (Object.keys(current).length > 0) stored.utm = current; // latest campaign wins
  writeJson(ATTR_KEY, stored);

  const utm: Record<string, string> = { ...stored.utm };
  if (stored.referrer) utm.referrer = stored.referrer;
  const landingPath = stored.landingPage.split("?")[0];
  if (landingPath !== url.pathname) utm.form_page = url.pathname.slice(0, 120);
  return { landingPage: stored.landingPage, utm: Object.keys(utm).length ? utm : undefined };
}

/* ------------------------------------------------------------------------------------------ */
/* Cloudflare Turnstile                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Cloudflare's documented always-pass TEST site key (pairs with the test secret on the API). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/** Build variable PUBLIC_TURNSTILE_SITE_KEY (DEPLOYMENT.md step 7); test key when unset (local dev). */
export const TURNSTILE_SITE_KEY: string = (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) || TURNSTILE_TEST_SITE_KEY;

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  language?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code: string) => boolean | void;
}

export interface TurnstileApi {
  render(container: HTMLElement | string, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileLoading: Promise<TurnstileApi> | null = null;

/** Load api.js once (only when step 2 opens). Rejects when blocked or offline; call again to retry. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    const fail = (message: string) => {
      script.remove();
      turnstileLoading = null;
      reject(new Error(message));
    };
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fail("Turnstile unavailable"));
    script.onerror = () => fail("Turnstile failed to load");
    document.head.appendChild(script);
  });
  return turnstileLoading;
}
