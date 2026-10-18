# Cantt Rent a Car — Architecture & Conventions

This file is the contract for everyone (human or agent) working on this project. Read it before changing code.

## 1. The two apps

| Folder | What | Domain | Stack |
|---|---|---|---|
| `website/` | Public marketing + quote site. SEO is the top priority. | `canttrentacar.com` (placeholder, configurable) | Astro 7 (static prerender) on Cloudflare Workers Static Assets, Tailwind 4, GSAP 3.15, Lenis, Three.js, Svelte 5 islands |
| `control-panel/` | Internal business system (fleet, bookings, money). Never indexed. | `admin.canttrentacar.com` | React 19 + Vite SPA (TanStack Router/Query, shadcn/ui) + Hono API in the same Worker, D1 (Drizzle), R2 |

The two folders are independent npm projects (no shared workspace). They communicate only through:

1. **Catalog JSON** (control panel → website, build time). When staff press "Publish website", the control panel writes `catalog/v1.json` to the public R2 media bucket and calls the website's Workers Builds deploy hook. The website build fetches `CATALOG_URL`; if it is unset or unreachable it falls back to `website/src/data/catalog.sample.json`. Schema: section 6.
2. **Quote requests** (website → control panel, runtime). The website's only dynamic endpoint `POST /api/quote/` (trailing slash, because `trailingSlash: "always"` applies to on-demand routes) validates the form + Turnstile, then forwards to the control panel's `POST /api/public/inquiries` via a Cloudflare **service binding** (`env.CONTROL_PANEL`) in production, or via plain HTTP to `CONTROL_PANEL_URL` in local dev. Both paths send header `X-Internal-Key: <INTERNAL_API_KEY>`.

The public website **never** shows live availability and **never** creates bookings. It only creates inquiries. Staff convert inquiries into bookings inside the control panel, where the calendar prevents double bookings.

## 2. Cloudflare free-tier rules (hard constraints)

- **10 ms CPU per Worker request.** No password hashing, no server-side PDF/image generation, no React SSR, no big JSON transforms. PDFs (invoices, agreements, statements) are generated in the browser.
- **100,000 Worker requests/day, shared by both apps.** Static assets are free. The website is fully prerendered; only `/api/quote/` runs a Worker. The panel only invokes the Worker for `/api/*` (`run_worker_first`). Never proxy public images through a Worker. Dashboard polling ≥ 60 s; `refetchOnWindowFocus: false`.
- **D1: 5M rows read / 100k rows written per day, 500 MB per DB, 50 queries per invocation, 100 bound params per statement, no interactive transactions.**
  - Never `LIKE '%term%'` on big tables; use indexed prefix search on normalised columns (`search_name`, `phone`, `cnic`, `registration_no`).
  - List endpoints use **keyset pagination** on the ULID `id` (time-sortable). No `COUNT(*)` totals on large tables.
  - Reports read **rollups** (`ledger_monthly`), not raw journal lines.
  - Multi-row writes go through `db.batch([...])` (atomic). Split bulk inserts so each statement has ≤ 100 bound params.
- **R2 free: 10 GB.** Every image is resized/compressed to WebP **in the browser** before upload. No originals kept. Handover photos are deleted after the deposit is settled (unless flagged).
- **Cloudflare Images: not used** (5k transform/month cap). Variants are generated at upload.
- **KV: not used** (1k writes/day). Counters live in D1.
- **Daily jobs without cron slots:** the free plan allows 5 cron triggers per account (all used by other Workers on the current account), so the 4 job groups in `control-panel/worker/cron.ts` run via `POST /api/public/cron/:group` (GitHub Actions, `X-Cron-Key`) with a catch-up on `GET /api/me`; each group runs in its own invocation and at most once per UTC day (operation_locks `cron:<date>:<group>`).
- **Email: Resend free (100/day) → Brevo free fallback.** Staff alerts go through the free `send_email` binding to verified addresses. Only confirmations/invoices are emailed to customers; reminders go via wa.me links sent by staff.

## 3. Control panel conventions

### Layout
```
control-panel/
  wrangler.jsonc        Worker config (D1 "DB", R2 "MEDIA" + "PRIVATE", send_email "STAFF_MAIL")
  worker/
    index.ts            Hono app, mounts every router under /api, exports default { fetch, scheduled }
    db/schema.ts        Drizzle schema (single source of truth)
    lib/                Core helpers: ids, db, auth, errors, money, dates, ledger, counters, audit, pagination
    routes/<module>.ts  One Hono router per module (already mounted in index.ts)
    services/<module>.ts Business logic used by routes (pure functions where possible)
    email/              Provider-agnostic sender + HTML string templates (no React Email)
  shared/               Zod schemas, enums, types and pure logic shared by SPA and Worker (pricing engine, formatters)
  src/                  React SPA
    routes/             TanStack file-based routes (src/routeTree.gen.ts is generated — never edit)
    components/ui/      shadcn/ui primitives (owned code)
    components/         App components (DataTable, PageHeader, MoneyInput, StatusBadge, ...)
    lib/api.ts          Typed fetch wrapper
  migrations/           SQL migrations (drizzle-kit generate + hand-written trigger migrations)
  seed/seed.sql         Chart of accounts, expense categories, default settings, demo data
```

### IDs, money, time
- **IDs:** text ULIDs from `newId()` (`worker/lib/ids.ts`). Time-sortable, generated in the app so multi-table writes can be batched atomically.
- **Human refs:** `INQ-2610-0042`, `BK-2610-0042`, `PAY-2610-0042`, invoices `INV-2026-27-00042` (fiscal year Jul–Jun). Generated with `nextCounter()` (`worker/lib/counters.ts`).
- **Money:** integer **PKR rupees** everywhere (DB, API, UI state). Format with `formatPKR()` from `shared/format.ts` → `Rs 12,500`. Percentages are stored as basis points (`2500` = 25.00%).
- **Datetimes** (booking start/end, inquiry pickup): integer epoch **milliseconds UTC**. Display in `Asia/Karachi` (UTC+5, no DST).
- **Dates** (expense date, document expiry, installment due): text `YYYY-MM-DD` in Pakistan local date.
- **Phones:** stored E.164 `+923001234567`; `normalizePkPhone()` in `shared/format.ts`. WhatsApp links use `wa.me/923001234567`.
- **CNIC:** stored `35202-1234567-1`; validated by `cnicSchema`.

### API
- Everything under `/api`. JSON in/out. Inputs validated with `zValidator` + schemas from `shared/schemas/*`.
- Success: the resource or `{ items, nextCursor }` for lists. Errors: `{ error: { code, message, details? } }` with proper status (400 validation, 401/403 auth, 404, 409 conflict, 422 business rule).
- Throw `new AppError(status, code, message)` from `worker/lib/errors.ts`; the global handler formats it. D1 trigger error `VEHICLE_OVERLAP` maps to 409.
- Auth: middleware puts `c.var.user = { id, email, name, role }`. Guard with `requireRole(...roles)`. Roles: `owner`, `manager`, `accountant`, `agent`, `fleet`, `viewer`.
  - Production: Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) verified with `jose` against `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`; the email must exist and be active in `users` (the `OWNER_EMAIL` is auto-provisioned as owner on first login).
  - Local dev: `AUTH_MODE=dev` logs you in as `DEV_USER_EMAIL` (owner). This mode is refused when `APP_ENV=production`.
- Money-changing actions write an `audit_log` row and post a balanced journal entry through `postJournal()` (`worker/lib/ledger.ts`) **in the same `db.batch`**.

### Accounting model (double-entry, see `seed/seed.sql` for the chart of accounts)
- Customer payments: Dr Cash/Bank (1000) / Cr Customer accounts (1100). A credit balance on 1100 = customer advance.
- Booking completion (revenue recognition, split by month across the rental period): Dr 1100 / Cr Rental revenue 4000 (+ 4010 driver services, 4020 damage/late, 4100 recovered pass-through costs, 2200 sales tax).
- Security deposits: Dr 1000 / Cr Deposits held 2110; refund reverses; deductions Dr 2110 / Cr 1100.
- Expenses: Dr 5xxx/6xxx (tagged with `vehicle_id` when car-specific) / Cr 1000 (paid) or 2000 (payable to vendor).
- Investor settlement (approved): Dr Investor share 5000 / Cr Investor payable 2010 (tagged investor+vehicle). Payout: Dr 2010 / Cr 1000.
  - An agreement's months are approved strictly in order (no approving a month under an approved later one; reopen newest first). Each settlement records `breakdown.postedUntil`; revenue and car expenses dated in an earlier month but posted after the previous approved settlement's cutoff reach the next settlement once, as "Prior-period adjustments".
- Financed car purchase: Dr Fleet 1200 / Cr 1000 (down payment) / Cr Vehicle loans 2300. Installment: Dr 2300 (principal) + Dr 5200 (markup) / Cr 1000.
- Depreciation (monthly cron, company-owned cars only): Dr 5190 / Cr 1210.
- Partner (sub-rented) cars: Dr 5010 / Cr 2020; payment Dr 2020 / Cr 1000.
- Every journal line updates `ledger_monthly(month, account_code, vehicle_id, investor_id)` via UPSERT in the same batch. Reports and dashboards read `ledger_monthly`.
- Per-customer 1100 balances live in `customer_balances`, kept by the AFTER INSERT trigger `jl_customer_balance` (migration 0006). Journal lines are never updated or deleted (correct with a reversing entry), and every 1100 line carries `customer_id`.
- Payroll challan deductions are whole pending challans, oldest first, earlier months' drafts first; paying links exactly those challans and credits 4100 with the same amount.
- Two views everywhere: **Profit** (ledger, accrual) and **Cash** (payments table).

### Double-booking guarantee
`booking_vehicles` rows hold `vehicle_id, start_at, block_end_at (end_at + buffer), active`. A SQLite trigger (`migrations/0001_booking_overlap_trigger.sql`) raises `VEHICLE_OVERLAP` if an active row overlaps another active row for the same vehicle. Cancelling/no-show/expired holds set `active = 0`; early returns shrink `end_at`/`block_end_at`.

### Frontend (SPA)
- File-based routes in `src/routes`. Data via TanStack Query + `api` from `src/lib/api.ts`. Query keys: `[module, ...params]`.
- Forms: react-hook-form + `zodResolver(schemaFromShared)`.
- UI: shadcn/ui primitives in `src/components/ui`, icons from `lucide-react` (shadcn default). Toasts with `sonner`.
- Every list: search, filters, keyset "Load more", empty state, loading skeleton, error state.
- Mobile-friendly: staff use phones for handover checklists and quick lookups.
- Money inputs use `<MoneyInput>`; display with `formatPKR`. Dates displayed `dd MMM yyyy` and times `h:mm a` in Asia/Karachi.

## 4. Website conventions

```
website/
  astro.config.mjs      output: 'static', adapter: cloudflare({ imageService: 'compile' }), site: SITE_URL
  wrangler.jsonc        Worker "cantt-tour-rent-a-car", static assets, service binding CONTROL_PANEL
  src/
    config/site.ts      Business NAP, phones, WhatsApp, social links, areas served — the ONE place to edit
    lib/catalog.ts      Loads catalog (CATALOG_URL → fallback sample) + helpers
    lib/seo.ts          Title/description/canonical/OG helpers
    lib/schema.ts       JSON-LD builders (AutoRental, Car+Offer, Service, BreadcrumbList, WebSite, FAQPage)
    content/            Markdown collections: areas, routes, services, guides (content.config.ts)
    data/catalog.sample.json
    layouts/            BaseLayout (head, header, footer, view transitions), PageLayout
    components/         Astro components; interactive islands in Svelte 5 (*.svelte)
    scripts/            motion.ts (GSAP/ScrollTrigger), smooth-scroll.ts (Lenis, desktop only), hero3d.ts (Three.js)
    pages/              Prerendered routes; pages/api/quote.ts is the only on-demand route
    styles/global.css   Tailwind 4 + design tokens
```

Rules:
- Every page is prerendered HTML containing all text, prices and links. Nothing important lives only inside a canvas or client JS.
- One `priority` image or the H1 text is the LCP element. 3D loads after first paint, only on capable devices (fine-pointer desktop, never phones/tablets; not `prefers-reduced-motion`, not Save-Data, `deviceMemory >= 4`, `hardwareConcurrency >= 4`), and pauses off-screen.
- JS budget: ≤ 50 KB gzip on content pages before interaction; Three.js only on pages that use it, loaded lazily.
- `lang="en-PK"`. Roman Urdu phrases used naturally where people search that way.
- No fabricated reviews, ratings, stats or awards. Numbers shown must come from the catalog or `site.ts`.
- No `AggregateRating`/`Review` schema on our own pages. No vehicle-listing schema. FAQPage is optional.
- Prices come only from the catalog (= control panel). Never hard-code a price in content.

## 5. Local development

```bash
# control panel (http://localhost:5173)
cd control-panel && npm install && npm run db:migrate:local && npm run db:seed:local && npm run dev

# website (http://localhost:4321)
cd website && npm install && npm run dev
```

## 6. Catalog JSON contract (`catalog/v1.json`)

```ts
type Catalog = {
  version: 1;
  generatedAt: string;                       // ISO
  currency: "PKR";
  categories: { slug: string; name: string; description: string }[];   // sedan, suv, hatchback, luxury, van, coaster, wedding ...
  models: CatalogModel[];
};

type CatalogModel = {
  slug: string;                              // "toyota-corolla"  → /cars/toyota-corolla/
  make: string; model: string; variant: string | null;
  category: string;                          // categories[].slug
  yearFrom: number | null; yearTo: number | null;
  seats: number; luggage: number | null;
  transmission: "automatic" | "manual";
  fuel: "petrol" | "hybrid" | "diesel" | "electric";
  engineCc: number | null;
  features: string[];                        // "Air conditioning", "Bluetooth", ...
  suitableFor: string[];                     // "wedding" | "outstation" | "airport" | "corporate" | "monthly" | "self_drive" | "family"
  shortDescription: string;                  // ≤ 160 chars
  description: string;                       // markdown, written by staff
  images: { src: string; width: number; height: number; alt: string; srcset: string }[]; // first = cover
  rates: {
    withDriver: { daily: number; outstationDaily: number | null; monthly: number | null; overtimeHourly: number | null } | null;
    selfDrive:  { daily: number; weekly: number | null; monthly: number | null; securityDeposit: number | null; kmPerDay: number | null } | null;
    driverNightAllowance: number | null;
    fromPrice: number;                       // lowest daily price shown as "from Rs X/day"
  };
  units: number;                             // how many cars of this model the fleet has
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null; seoDescription: string | null;
  updatedAt: string;
};
```

## 7. Quote request contract (website → control panel)

`POST /api/public/inquiries` (header `X-Internal-Key`)
```ts
{
  name: string; phone: string;               // phone normalised to +92…
  email?: string;
  modelSlug?: string; category?: string;
  serviceType: "with_driver" | "self_drive";
  tripType: "within_city" | "outstation" | "airport" | "wedding" | "monthly" | "corporate";
  pickupAt: number; returnAt: number;        // epoch ms
  pickupLocation?: string; destination?: string; passengers?: number;
  message?: string;
  estimateTotal?: number;                    // client-side estimate shown to the visitor (informational)
  landingPage?: string; utm?: Record<string, string>;
}
→ 201 { ref: "INQ-2610-0042" }
```

## 8. Media upload contract (control panel)

The browser resizes every image to WebP before upload (`src/lib/upload.ts`), so the Worker never processes pixels.

`POST /api/media` — `multipart/form-data`
- `kind`: one of `MEDIA_KINDS` (`shared/constants.ts`). `car_photo` goes to the public `MEDIA` bucket; every other kind goes to the `PRIVATE` bucket.
- `ownerType` (`model`, `vehicle`, `customer`, `booking`, `inspection`, `expense`, `payment`, `investor`, `staff`, `challan`, `incident`, `document`), `ownerId`
- `alt` (optional), `width`, `height` (of the largest file)
- `file`: the largest rendition (≤ 1600 px long edge, WebP q≈0.78; PDFs allowed for documents, ≤ 10 MB)
- `variant_480`, `variant_960` (optional smaller WebP renditions for car photos)

→ `201 { id, kind, url, width, height, variants: [{ w, url }], alt }` (`variants` lists every stored width including the main file, e.g. 480/960/1600; iOS Safari uploads a JPEG main file without variants)

- Public media URL: `${MEDIA_URL}/<key>` (R2 custom domain). In local dev `MEDIA_URL` points at `/api/media/public/<key>`, which streams from the local R2 simulator.
- Private media is only readable through `GET /api/media/:id/file` (authenticated, role-checked).
- `DELETE /api/media/:id` removes the object(s) and the row.

## 9. Control panel route map (SPA)

| Path | File | Purpose |
|---|---|---|
| `/` | `routes/index.tsx` | Dashboard |
| `/inquiries`, `/inquiries/$inquiryId` | `routes/inquiries/*` | Website/WhatsApp/phone leads inbox |
| `/bookings`, `/bookings/new`, `/bookings/$bookingId` | `routes/bookings/*` | Bookings |
| `/calendar` | `routes/calendar.tsx` | Fleet availability timeline |
| `/handover/$bookingId` | `routes/handover/$bookingId.tsx` | Mobile check-out / check-in checklist |
| `/customers`, `/customers/$customerId` | `routes/customers/*` | Customers & KYC |
| `/fleet`, `/fleet/new`, `/fleet/$vehicleId` | `routes/fleet/*` | Vehicles (units) |
| `/models`, `/models/$modelId` | `routes/models/*` | Car models, rates, photos, website publishing |
| `/renewals` | `routes/renewals.tsx` | Documents expiring (token tax, insurance, fitness...) |
| `/maintenance` | `routes/maintenance.tsx` | Service records & due list |
| `/challans` | `routes/challans.tsx` | Traffic fines |
| `/incidents` | `routes/incidents.tsx` | Accidents, damage, claims |
| `/payments` | `routes/payments.tsx` | All money in/out |
| `/deposits` | `routes/deposits.tsx` | Security deposits held/refunded |
| `/expenses` | `routes/expenses.tsx` | Car & office expenses |
| `/invoices`, `/invoices/$invoiceId` | `routes/invoices/*` | Invoices & receipts |
| `/accounts` | `routes/accounts.tsx` | Cash/bank/wallet accounts, journal, chart of accounts |
| `/investors`, `/investors/$investorId` | `routes/investors/*` | Investors & agreements |
| `/settlements` | `routes/settlements.tsx` | Monthly investor settlements |
| `/financing`, `/financing/$planId` | `routes/financing/*` | Loans / leases / installments |
| `/staff`, `/staff/$staffId` | `routes/staff/*` | Staff & drivers |
| `/payroll` | `routes/payroll.tsx` | Salaries & advances |
| `/vendors` | `routes/vendors.tsx` | Workshops, partner rental companies, landlords |
| `/reports` | `routes/reports.tsx` | P&L, cash flow, per-car, utilization, investor, receivables |
| `/settings`, `/settings/users`, `/settings/website` | `routes/settings/*` | Business info, pricing rules, tax, users, website publishing |
