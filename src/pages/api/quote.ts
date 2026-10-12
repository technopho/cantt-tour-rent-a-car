/**
 * POST /api/quote/ : the website's ONLY on-demand route (runs in the Cloudflare Worker).
 * Note the trailing slash: astro.config trailingSlash "always" also applies here, so /api/quote
 * (no slash) is a 404. A WAF rate limiting rule should match "URI Path starts with /api/quote".
 *
 * Flow: size + content-type checks -> JSON -> zod validation (ARCHITECTURE.md section 7) ->
 * honeypot -> Cloudflare Turnstile siteverify -> forward to the control panel
 * (POST /api/public/inquiries with X-Internal-Key) -> { ok: true, ref }.
 *
 * Free-tier rules (ARCHITECTURE.md section 2): keep CPU tiny (no crypto, no big transforms);
 * the two subrequests are I/O and do not count towards the 10 ms CPU budget.
 *
 * Abuse protection: there is no per-IP or per-recipient counter here on purpose (KV is not used and
 * D1 would cost a write per request). Protection = Turnstile on every request + honeypot + the free
 * Cloudflare WAF rate limiting rule on /api/quote (DEPLOYMENT.md: 5 requests / 10 s per IP -> block 10 min).
 * Email abuse is handled by the control panel, not here: the acknowledgement email to the visitor is OFF
 * by default (Settings > Notifications, emailCustomerOnInquiry) and, when switched on, is throttled from
 * the existing email_log (one per address per 24 h, a small daily cap, and it stops once the day's
 * customer email budget is needed for confirmations and invoices). See
 * control-panel/worker/services/inquiry-intake.ts. Staff alerts go to verified staff addresses only.
 *
 * Environment (wrangler.jsonc vars / secrets, .dev.vars locally):
 *   CONTROL_PANEL         service binding to the control panel Worker (production)
 *   CONTROL_PANEL_URL     plain HTTP fallback when the binding is absent (local dev)
 *   INTERNAL_API_KEY      secret shared with the control panel (X-Internal-Key)
 *   TURNSTILE_SECRET_KEY  secret; in `astro dev` the documented always-pass test secret is used when unset
 *
 * Responses always carry Cache-Control: no-store and never leak internal errors:
 *   201 { ok: true, ref }   400 { ok: false, code: "validation", error, fields? }
 *   403 { ok: false, code: "turnstile" | "forbidden", error }   405 / 413 / 415
 *   502 / 503 / 504 { ok: false, code: "server", error }
 */
import type { APIRoute } from "astro";
import { z } from "astro/zod";
// workerd module. Its types come from `npm run cf-typegen` (worker-configuration.d.ts, git-ignored),
// so the import is untyped here and narrowed to QuoteEnv below.
// @ts-ignore: resolved by the Cloudflare runtime (workerd), not by TypeScript.
import { env as workerEnv } from "cloudflare:workers";
import { normalizePkPhone } from "@/lib/format";

export const prerender = false;

interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

interface QuoteEnv {
  CONTROL_PANEL?: ServiceBinding;
  CONTROL_PANEL_URL?: string;
  INTERNAL_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const env = (workerEnv ?? {}) as QuoteEnv;

const MAX_BODY_BYTES = 10 * 1024;
const DAY_MS = 86_400_000;
const PANEL_TIMEOUT_MS = 8_000;
const TURNSTILE_TIMEOUT_MS = 5_000;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Cloudflare's documented always-pass TEST secret (pairs with site key 1x00000000000000000000AA). Dev only. */
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
/** Categories the control panel accepts (control-panel/shared/constants.ts CAR_CATEGORIES); others are dropped. */
const PANEL_CATEGORIES = new Set(["hatchback", "sedan", "suv", "luxury", "van", "coaster", "pickup", "wedding"]);

const MSG_UNAVAILABLE = "We could not send your request right now. Please WhatsApp us or call, and we will help straight away.";
const MSG_CHECK_FIELDS = "Please check the highlighted details and try again.";
const MSG_BAD_REQUEST = "Something about this request was not right. Please refresh the page and try again.";
const MSG_TURNSTILE = "The security check did not go through. Please try again.";

/* ------------------------------------------------------------------------------------------ */
/* Schema (ARCHITECTURE.md section 7 + the two bot checks)                                      */
/* ------------------------------------------------------------------------------------------ */

/** Trimmed optional text; empty strings and null become undefined. */
const optionalText = (max: number, message = `Please keep this under ${max} characters.`) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v ? v : undefined));

const quoteSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name.").max(80, "Please shorten your name to 80 characters."),
    phone: z
      .string()
      .trim()
      .max(24, "Enter a Pakistani mobile number, e.g. 0300 1234567.")
      .transform((value, ctx) => {
        const e164 = normalizePkPhone(value);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "Enter a Pakistani mobile number, e.g. 0300 1234567." });
          return z.NEVER;
        }
        return e164;
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(120, "Please use a shorter email address.")
      .nullish()
      .transform((v) => (v ? v : undefined))
      .pipe(z.email("Enter a valid email address, or leave it empty.").optional()),
    modelSlug: z
      .string()
      .trim()
      .max(80)
      .regex(/^[a-z0-9-]*$/)
      .nullish()
      .transform((v) => (v ? v : undefined)),
    category: z
      .string()
      .trim()
      .max(40)
      .nullish()
      .transform((v) => (v && PANEL_CATEGORIES.has(v) ? v : undefined)),
    serviceType: z.enum(["with_driver", "self_drive"]),
    tripType: z.enum(["within_city", "outstation", "airport", "wedding", "monthly", "corporate"]),
    pickupAt: z.number().int(),
    returnAt: z.number().int(),
    pickupLocation: optionalText(160),
    destination: optionalText(160),
    passengers: z.number().int().min(1, "At least 1 passenger.").max(60, "For more than 60 passengers, please WhatsApp us.").nullish(),
    message: optionalText(1000),
    estimateTotal: z.number().int().min(0).max(100_000_000).nullish(),
    landingPage: optionalText(300),
    utm: z
      .record(z.string().trim().max(40), z.string().trim().max(120))
      .nullish()
      .refine((v) => !v || Object.keys(v).length <= 12, "Too many tracking parameters."),
    /** Honeypot: humans never see it. */
    website: z.string().max(500).nullish(),
    turnstileToken: z.string().trim().min(1, "Please complete the security check.").max(2048),
  })
  .superRefine((v, ctx) => {
    const now = Date.now();
    if (v.pickupAt < now - DAY_MS) ctx.addIssue({ code: "custom", path: ["pickupAt"], message: "Pickup time has passed. Choose a time from now on." });
    if (v.pickupAt > now + 2 * 365 * DAY_MS) ctx.addIssue({ code: "custom", path: ["pickupAt"], message: "Pickup is too far ahead. Please WhatsApp us." });
    if (v.returnAt <= v.pickupAt) ctx.addIssue({ code: "custom", path: ["returnAt"], message: "Return must be after pickup." });
    else if (v.returnAt - v.pickupAt > 400 * DAY_MS) {
      ctx.addIssue({ code: "custom", path: ["returnAt"], message: "For rentals longer than a year, please WhatsApp us." });
    }
  });

type QuoteInput = z.infer<typeof quoteSchema>;

/** Fields the form can highlight; issues on any other path become a generic message. */
const CLIENT_FIELDS = new Set(["name", "phone", "email", "passengers", "message", "pickupAt", "returnAt"]);

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                      */
/* ------------------------------------------------------------------------------------------ */

function json(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...extra,
    },
  });
}

const fail = (status: number, code: string, error: string, fields?: Record<string, string>) =>
  json(status, fields ? { ok: false, code, error, fields } : { ok: false, code, error });

/** Read at most `limit` bytes; null when the body is larger (checked while streaming, not after). */
async function readBody(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Abort `run` after `ms` (works for fetch and service-binding fetch alike). */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await withTimeout(TURNSTILE_TIMEOUT_MS, (signal) => fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form, signal }));
    if (!res.ok) {
      console.error(`[quote] Turnstile siteverify HTTP ${res.status}`);
      return false;
    }
    const outcome = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!outcome.success) console.warn(`[quote] Turnstile rejected: ${(outcome["error-codes"] ?? []).join(",") || "unknown"}`);
    return outcome.success === true;
  } catch (error) {
    console.error(`[quote] Turnstile siteverify failed: ${error instanceof Error ? error.message : "unknown"}`);
    return false;
  }
}

/** ARCHITECTURE.md section 7 body (no bot-check fields, no undefined keys). */
function toInquiry(input: QuoteInput): Record<string, unknown> {
  const inquiry: Record<string, unknown> = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    modelSlug: input.modelSlug,
    category: input.category,
    serviceType: input.serviceType,
    tripType: input.tripType,
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    pickupLocation: input.pickupLocation,
    destination: input.destination,
    passengers: input.passengers ?? undefined,
    message: input.message,
    estimateTotal: input.estimateTotal ?? undefined,
    landingPage: input.landingPage,
    utm: input.utm && Object.keys(input.utm).length > 0 ? input.utm : undefined,
  };
  for (const key of Object.keys(inquiry)) if (inquiry[key] === undefined) delete inquiry[key];
  return inquiry;
}

async function forwardToControlPanel(inquiry: Record<string, unknown>, internalKey: string): Promise<Response> {
  const body = JSON.stringify(inquiry);
  const headers = { "Content-Type": "application/json", Accept: "application/json", "X-Internal-Key": internalKey };
  const binding = env.CONTROL_PANEL;
  if (binding && typeof binding.fetch === "function") {
    // Worker to Worker over the service binding: the hostname is ignored, the path is what matters.
    return withTimeout(PANEL_TIMEOUT_MS, (signal) =>
      binding.fetch(new Request("https://control-panel/api/public/inquiries", { method: "POST", headers, body, signal })),
    );
  }
  const base = (env.CONTROL_PANEL_URL ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("CONTROL_PANEL_URL is not set");
  return withTimeout(PANEL_TIMEOUT_MS, (signal) => fetch(`${base}/api/public/inquiries`, { method: "POST", headers, body, signal }));
}

/* ------------------------------------------------------------------------------------------ */
/* Handlers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export const POST: APIRoute = async ({ request }) => {
  // Same-origin only (no CORS). Requests without an Origin header (curl, some privacy tools) still need Turnstile.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return fail(403, "forbidden", MSG_BAD_REQUEST);
    } catch {
      return fail(403, "forbidden", MSG_BAD_REQUEST);
    }
  }

  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return fail(415, "validation", MSG_BAD_REQUEST);
  }

  const raw = await readBody(request, MAX_BODY_BYTES);
  if (raw === null) return fail(413, "validation", "This request is too large. Please shorten your message.");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail(400, "validation", MSG_BAD_REQUEST);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail(400, "validation", MSG_BAD_REQUEST);

  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    let missingToken = false;
    let other = false;
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key === "turnstileToken") missingToken = true;
      else if (CLIENT_FIELDS.has(key)) fields[key] ??= issue.code === "invalid_type" ? "Please check this detail." : issue.message;
      else other = true;
    }
    if (Object.keys(fields).length > 0) return fail(400, "validation", MSG_CHECK_FIELDS, fields);
    if (other) return fail(400, "validation", MSG_BAD_REQUEST);
    if (missingToken) return fail(403, "turnstile", "Please complete the security check.");
    return fail(400, "validation", MSG_BAD_REQUEST);
  }
  const input = parsed.data;

  // Honeypot filled: almost certainly a bot. Reject without saying why.
  if (input.website && input.website.trim() !== "") return fail(400, "validation", MSG_BAD_REQUEST);

  const secret = env.TURNSTILE_SECRET_KEY || (import.meta.env.DEV ? TURNSTILE_TEST_SECRET : "");
  const internalKey = env.INTERNAL_API_KEY ?? "";
  if (!secret || !internalKey) {
    console.error(`[quote] Misconfigured: ${!secret ? "TURNSTILE_SECRET_KEY " : ""}${!internalKey ? "INTERNAL_API_KEY" : ""}is not set.`);
    return fail(503, "server", MSG_UNAVAILABLE);
  }

  const human = await verifyTurnstile(input.turnstileToken, secret, request.headers.get("CF-Connecting-IP"));
  if (!human) return fail(403, "turnstile", MSG_TURNSTILE);

  let panel: Response;
  try {
    panel = await forwardToControlPanel(toInquiry(input), internalKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`[quote] Control panel unreachable: ${message}`);
    return fail(message === "timeout" ? 504 : 502, "server", MSG_UNAVAILABLE);
  }

  if (panel.status === 201 || panel.ok) {
    let ref: unknown;
    try {
      ref = ((await panel.json()) as { ref?: unknown }).ref;
    } catch {
      ref = undefined;
    }
    if (typeof ref === "string" && ref.length > 0 && ref.length <= 40) return json(201, { ok: true, ref });
    console.error("[quote] Control panel answered without a reference.");
    return fail(502, "server", MSG_UNAVAILABLE);
  }

  // Log status only (no customer data). 401 = INTERNAL_API_KEY mismatch between the two Workers;
  // 400/422 = the two schemas drifted apart (our zod check passed). Neither is something the
  // visitor can fix by editing a field, so both get the WhatsApp / Call fallback.
  console.error(`[quote] Control panel rejected the inquiry: HTTP ${panel.status}`);
  return fail(502, "server", MSG_UNAVAILABLE);
};

/** Anything other than POST. */
export const ALL: APIRoute = () => json(405, { ok: false, code: "validation", error: "Method not allowed." }, { Allow: "POST" });
