# Deploying Cantt Rent a Car on Cloudflare (free plan)

Everything below runs on Cloudflare's free plan. The only paid item is the domain name (about $10/year for a .com, or Rs 2,100/year for a .pk).

You will end up with:

| Address | What | Cloudflare product |
|---|---|---|
| `canttrentacar.com` (+ `www`) | Public website | Worker `cantt-website` (static assets) |
| `admin.canttrentacar.com` | Control panel | Worker `cantt-control-panel` + D1 + R2, protected by Cloudflare Access |
| `media.canttrentacar.com` | Car photos + website catalog | R2 bucket `cantt-media` (public custom domain) |

Replace `canttrentacar.com` everywhere with your real domain.

---

## 1. Accounts and domain

1. Create a free Cloudflare account at dash.cloudflare.com.
2. Add your domain (**Add a site → Free plan**). If you buy the domain from Cloudflare Registrar it is added automatically; for a `.pk` domain from PKNIC, change its nameservers to the two Cloudflare nameservers shown.
3. Add a payment card under **Billing** (needed to turn on R2 storage and Zero Trust; nothing is charged within the free limits). Then set **Billing → Notifications** to alert you if usage ever creates a charge.
4. On your computer: install Node.js 22 or newer, then log in once:
   ```bash
   npx wrangler login
   ```

## 2. Control panel: database and storage

From the `control-panel` folder:

```bash
npm install
npx wrangler d1 create cantt-db
```

Copy the `database_id` it prints into `control-panel/wrangler.jsonc` (replace the zeros). Then:

```bash
npx wrangler r2 bucket create cantt-media
npx wrangler r2 bucket create cantt-private
npm run db:migrate:remote
npm run db:seed:remote
```

`db:seed:remote` only loads the chart of accounts, expense categories and default money accounts (no demo data).

In the dashboard: **R2 → cantt-media → Settings → Custom Domains → Connect domain** → `media.canttrentacar.com`. Leave `cantt-private` with **no** public access.

## 3. Control panel: secrets and settings

Edit the `vars` in `control-panel/wrangler.jsonc`:

- `SITE_URL`, `PANEL_URL`, `MEDIA_URL`: your real addresses (the local values in `control-panel/.dev.vars` are separate and assume the panel runs on port 5173: `MEDIA_URL=http://localhost:5173/api/media/public`; change them if you run it locally on another port)
- `OWNER_EMAIL`: the owner's email (gets the Owner role on first sign-in)
- `MAIL_FROM`: e.g. `Cantt Rent a Car <bookings@mail.canttrentacar.com>`
- `STAFF_ALERT_EMAIL`: the inbox that receives new-quote alerts (must be verified in Email Routing, step 6)

Set secrets (you will be prompted for each value):

```bash
npx wrangler secret put INTERNAL_API_KEY     # any long random string; the website uses the same value
npx wrangler secret put RESEND_API_KEY       # from resend.com (step 6)
npx wrangler secret put BREVO_API_KEY        # optional fallback, from brevo.com
npx wrangler secret put DEPLOY_HOOK_URL      # website deploy hook (step 8)
```

Deploy:

```bash
npm run deploy
```

Then **Workers & Pages → cantt-control-panel → Settings → Domains & Routes → Add → Custom domain** → `admin.canttrentacar.com`.

## 4. Protect the control panel with Cloudflare Access (free for up to 50 users)

1. **Zero Trust** (left menu) → pick a team name (e.g. `cantt`) → choose the **Free** plan.
2. **Access → Applications → Add an application → Self-hosted**
   - Application domain: `admin.canttrentacar.com`
   - Session duration: 24 hours
   - Policy "Staff": Action **Allow**, Include **Emails** → list every staff email (owner, managers, agents...)
   - Login methods: **One-time PIN** (email code) and optionally **Google**
   - Advanced settings → Cookie settings: **SameSite attribute: Lax** and **HTTP Only** on (the panel is same-origin, so nothing breaks; other sites can no longer ride the staff login cookie)
3. Add a **second** application for the public endpoints (website quotes and customer invoice links):
   - Application domain: `admin.canttrentacar.com`, path `api/public`
   - Policy: Action **Bypass**, Include **Everyone**
4. Copy the **Application Audience (AUD) tag** of the first application and your team domain (`https://cantt.cloudflareaccess.com`) into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, then `npm run deploy` again.
5. Add staff accounts inside the panel under **Settings → Users** (the email must also be in the Access policy).

## 5. Website

From the `website` folder, edit `src/config/site.ts` with the real phone, WhatsApp, address, hours and social links (every placeholder is listed in `PLACEHOLDER_FIELDS`). Then in `website/wrangler.jsonc`:

- set `SITE_URL` to your domain
- uncomment the `services` binding to `cantt-control-panel` (the control panel must already be deployed)

Before launch, the owner must confirm (or change) the values marked "CHOSEN DEFAULT" in `website/src/components/services/terms.ts`: the city day window, the self drive handover place, the self drive outstation rule, fuel with a driver, the wedding season and the wedding peak days. Every page reads them from that file and states them as fact.

Good to know: `astro build` copies `website/.dev.vars` (your local secrets) into `dist/server/.dev.vars`. It is used only by local `npm run preview` and is never uploaded (production secrets are the `wrangler secret put` values below), but it means a local preview keeps the old values until you build again, so rebuild after changing `CONTROL_PANEL_URL`.

Secrets:

```bash
npx wrangler secret put INTERNAL_API_KEY       # same value as the control panel
npx wrangler secret put TURNSTILE_SECRET_KEY   # step 7
```

Deploy and attach the domain:

```bash
npm install
npm run deploy
```

**Workers & Pages → cantt-website → Settings → Domains & Routes** → add custom domains `canttrentacar.com` and `www.canttrentacar.com`. Add a **Redirect Rule** (Rules → Redirect Rules) from `www` to the apex (301) so there is one canonical address.

## 6. Email

**Receiving (free):** **Email → Email Routing** → enable → create addresses such as `info@` and `bookings@` that forward to the owner's Gmail. Verify the destination inbox; that same verified address can be used as `STAFF_ALERT_EMAIL`.

**Sending to customers (free):**
1. Create a free account at resend.com → **Domains → Add** `mail.canttrentacar.com` → use the automatic Cloudflare setup (or copy the DNS records; keep them "DNS only", grey cloud).
2. Create an API key → `npx wrangler secret put RESEND_API_KEY` in `control-panel`.
3. Optional fallback: brevo.com free plan, authenticate the same domain, API key → `BREVO_API_KEY`.
4. DMARC: add a TXT record `_dmarc` with `v=DMARC1; p=none; rua=mailto:<your Cloudflare DMARC address>` and turn on **Email → DMARC Management**. After 2–4 weeks of clean reports change `p=none` to `p=quarantine`.

## 7. Turnstile (spam protection on the quote form, free)

**Turnstile → Add widget** → domain `canttrentacar.com`, mode **Managed**. Put the **site key** in the website build environment as `PUBLIC_TURNSTILE_SITE_KEY` (step 8) and the **secret key** with `npx wrangler secret put TURNSTILE_SECRET_KEY`.

## 8. Automatic website rebuilds when you publish from the control panel

1. Push the project to a private GitHub repository.
2. **Workers & Pages → cantt-website → Settings → Builds → Connect** your repository, root directory `website`, build command `npm run build`, deploy command `npx wrangler deploy`.
3. Build variables: `SITE_URL=https://canttrentacar.com`, `CATALOG_URL=https://media.canttrentacar.com/catalog/v1.json`, `CATALOG_REQUIRED=true`, `PUBLIC_TURNSTILE_SITE_KEY=<site key>`. `CATALOG_REQUIRED=true` makes a build fail instead of silently publishing the sample fleet and its placeholder prices when the catalog cannot be fetched, so press **Control panel → Settings → Website → Publish** once (it works before the deploy hook exists) so `catalog/v1.json` is in R2 before you connect the build.
4. **Deploy hooks → Create** → copy the URL → in `control-panel`: `npx wrangler secret put DEPLOY_HOOK_URL`.

Now **Control panel → Settings → Website → Publish** writes the latest cars, prices and photos and rebuilds the site (free plan: 3,000 build minutes/month; each build takes a few minutes).

## 9. Security and bot settings

- **Security → WAF → Rate limiting rules** (1 free rule): **URI Path starts with** `/api/quote`, 5 requests per 10 seconds per IP → Block for 10 minutes.
- **Security → WAF → Custom rules**: block common scanner paths (`/wp-login.php`, `/xmlrpc.php`, `/.env`). Defence in depth only: `assets.run_worker_first: ["/api/*"]` in `website/wrangler.jsonc` already makes the asset layer answer every other unknown URL with the 404 page without running the Worker. Check after deploy: `curl -sI https://canttrentacar.com/does-not-exist-123/` returns 404 and the Worker request count in the Workers metrics does not go up.
- **Security → Bots**: keep **Bot Fight Mode off** (it can interfere with Googlebot). Under **AI Crawl Control**, keep search and AI assistant crawlers **allowed**; do not enable "Block AI bots".
- Leave **Workers Caching off** on the free plan.

## 10. Analytics and Google

- **Web Analytics** (free): add the site manually and paste the snippet only into the website (not the control panel).
- **Google Search Console**: add the domain property (verify via a DNS TXT record), submit `https://canttrentacar.com/sitemap-index.xml`.
- **Bing Webmaster Tools**: import from Search Console (ChatGPT search uses Bing's index).
- **Google Business Profile**: create or claim "Cantt Rent a Car" at the real office address in Lahore Cantt (the office needs permanent signage with the same name), primary category **Car rental agency**, add the website, WhatsApp, hours, real photos of the office and fleet, and every car model under Products with prices. This matters more than anything else for appearing on the map.

## 11. Backups

Cloudflare D1 keeps 30 days of point-in-time history on paid plans and 7 days on free. Add a weekly export as well:

```bash
cd control-panel
npx wrangler d1 export cantt-db --remote --output=backup-$(date +%F).sql
```

Run it at night (it briefly pauses other database requests), encrypt the file (it contains customer CNIC numbers and phone numbers), and keep it somewhere private.

## 12. Free-plan limits to keep in mind

| Limit (free) | Our usage at 30–80 cars | What happens if exceeded |
|---|---|---|
| 100,000 Worker requests/day (both apps) | ~20–40k | API pauses until 05:00 PKT; static pages keep working |
| D1: 5M rows read, 100k written per day | Designed for well under | Database errors until 05:00 PKT |
| R2: 10 GB storage | Photos are compressed to WebP; handover photos can be deleted after deposits are settled | Billed at about $0.015/GB/month |
| Resend: 100 emails/day | Confirmations + invoices only | Brevo fallback takes over |
| Access: 50 users | Staff only | New logins blocked |

If the business grows past these, Cloudflare's Workers Paid plan ($5/month) removes almost all of them.
