# Stock Buddy — Setup & Infrastructure Reference

This file tracks how every external service, tool, and environment is configured.
Update this file whenever a new service is connected or a configuration changes.

---

## Project Overview

**App Name:** Stock Buddy
**Description:** Multi-tenant SaaS inventory and purchase order management, embedded in Shopify
**Framework:** Next.js 16.2, App Router, Turbopack
**Database:** Supabase
**Styling:** Tailwind CSS
**Icons:** Polaris

---

## Repository — GitHub

**Account:** github.com/B-Gillon
**Repo:** github.com/B-Gillon/Stock-Buddy
**Default Branch:** main
**Local Path:** C:\Users\bgill\Desktop\Buddy-System\Stock-Buddy

### Git Workflow
```powershell
git add .
git commit -m "Brief description of what you just did"
git push origin main
```
Run this at the end of every work session, or after any meaningful completed change.

### Checking Status
```powershell
git status        # shows what has changed since last commit
git log --oneline # shows commit history
```

---

## Database — Supabase

**Project Name:** Stock-Buddy (renamed from PO-Builder on 2026-04-11)
**Project ID:** hodcgkltyymkiktfqekk
**Dashboard:** https://supabase.com/dashboard/project/hodcgkltyymkiktfqekk

### Security Status (as of 2026-04-11)
- RLS is enabled on all tables
- Service role bypass policy applied to all tables — allows server-side queries to work normally
- All queries are manually scoped by tenant_id as an additional safety layer
- Full RLS/JWT enforcement is deferred to pre-launch (see TECH_DEBT.md #1)

### Environment Variables (stored in .env.local — never commit this file)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        ← must be the service_role key, NOT the anon key
```

### Important Note
The SUPABASE_SERVICE_ROLE_KEY must be the service_role secret from Supabase →
Project Settings → API → "service_role secret". It is NOT the same as the anon key.
These were accidentally set to the same value once — double-check if auth issues arise.

### Dev Tenant
- Shop domain: brandongtest.myshopify.com
- Set via NEXT_PUBLIC_DEV_SHOP_DOMAIN and DEV_SHOP_DOMAIN in .env.local
- Must be removed before production (see TECH_DEBT.md #2)

---

## Shopify

**Dev Store:** brandongtest.myshopify.com
**App handle:** stock-buddy-1
**Embedding:** Embedded in Shopify Admin iframe (App Bridge v4)
**OAuth status:** Fully implemented and tested as of 2026-04-12

### Shopify Dev Dashboard
**URL:** https://dev.shopify.com
**Organization:** Brandon Test Account
**App:** Stock Buddy
App configuration (App URL, redirect URLs, scopes) is managed in the Dev Dashboard.
NOT in the Partners Dashboard — Shopify moved app config to the Dev Dashboard.

### Current App Configuration (production)
- **App URL:** https://stock-buddy.brandongillon.com
- **Allowed redirect URL:** https://stock-buddy.brandongillon.com/api/shopify/callback

### Current App Configuration (local dev with ngrok)
- **App URL:** https://{ngrok-url}/api/shopify/install
- **Allowed redirect URL:** https://{ngrok-url}/api/shopify/callback
- Create a new version in Dev Dashboard every time the ngrok URL changes

### API Scopes
```
read_products
read_locations
read_inventory
read_merchant_managed_fulfillment_orders
write_inventory
```

### Environment Variables (stored in .env.local)
```
SHOPIFY_STORE_DOMAIN
SHOPIFY_ADMIN_API_TOKEN          ← rotated 2026-04-11 after accidental exposure
SHOPIFY_API_VERSION
SHOPIFY_API_KEY                  ← Client ID from Dev Dashboard Settings → Credentials
NEXT_PUBLIC_SHOPIFY_API_KEY      ← Same value as SHOPIFY_API_KEY (needs NEXT_PUBLIC_ for browser)
SHOPIFY_API_SECRET               ← Client secret from Dev Dashboard Settings → Credentials (shpss_ format)
SHOPIFY_APP_URL                  ← https://stock-buddy.brandongillon.com in production
```

### ngrok (local dev tunnel)
**Installed at:** C:\ngrok\ngrok.exe
**Account:** B-Gillon (free plan)
**Auth token:** configured via `ngrok config add-authtoken`
**Usage:**
```powershell
ngrok http 3000 --request-header-add "ngrok-skip-browser-warning: true"
```
Note: Free plan generates a new URL on every restart. Update Dev Dashboard and
.env.local SHOPIFY_APP_URL every time the URL changes.

### Cloudflare Tunnel
**Status:** Installed but unreliable on Windows due to DNS issues
**Installed via:** `npm install -g cloudflared`
**Not recommended** for local dev on Windows — use ngrok or deploy to Vercel instead.

### OAuth Flow
Stock Buddy uses Shopify OAuth 2.0 for app installation.
See Engineering_Specs.txt Sections 21-23 for full architecture documentation.

Key files:
- src/lib/shopify/hmac.js — HMAC verification
- src/lib/shopify/sessionToken.js — JWT session token verification
- src/lib/shopify/stateCookie.js — Signed cookie for CSRF protection
- src/app/api/shopify/install/route.js — OAuth install entry point
- src/app/api/shopify/callback/route.js — OAuth callback, token exchange

### Approved Tester Install URL
There is no public install form. Approved beta testers receive a direct OAuth URL:
  https://stock-buddy.brandongillon.com/api/shopify/install?shop=their-store.myshopify.com
This URL only works for the exact shop domain in the query param.

---

## Public-Facing Flow (Request Access)

The root URL (stock-buddy.brandongillon.com) redirects to /request-access.
This is the public entry point for potential beta testers.

### Entry points
- **/request-access** — intro page: app description, private beta notice, feature list
- **/request-access/form** — application form: collects store/contact/business info
- **/** — redirects to /request-access (or /dashboard if inside Shopify iframe)

### Contact form
"Have Questions?" on the intro page opens an inline modal (no OS email client).
Submissions are sent to hello@brandongillon.com via SMTP using the same
nodemailer transporter as PO emails. The submitter's email is set as replyTo.

### Beta tester approval workflow (manual)
1. Review submissions in Supabase: access_requests table (status = 'pending')
2. Update status to 'approved' or 'rejected', set reviewed_at
3. Manually add approved applicant to beta_testers table
4. Send them the direct OAuth install URL for their shop domain
5. After install, their tenant record is created automatically

See Engineering_Specs.txt Section 24 for full public flow documentation.

---

## Hosting — Vercel

**Status:** Live as of 2026-04-11
**Account:** vercel.com (b-gillon's projects, Hobby plan)
**Dashboard:** https://vercel.com/b-gillons-projects
**Vercel URL:** https://stock-buddy-delta.vercel.app
**Live URL:** https://stock-buddy.brandongillon.com (live as of 2026-04-11)

### How Deployment Works
Every push to the main branch on GitHub automatically triggers a new deployment on Vercel.
No manual action needed — just push and Vercel rebuilds the app.

### Environment Variables
All .env.local variables are copied into Vercel's environment variable settings.
To update a variable: Vercel dashboard → Stock-Buddy project → Settings → Environment Variables.
After changing any variable, redeploy for changes to take effect.

### Variables Configured in Vercel
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SHOPIFY_STORE_DOMAIN
SHOPIFY_ADMIN_API_TOKEN
SHOPIFY_API_VERSION
SHOPIFY_API_KEY
NEXT_PUBLIC_SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
NEXT_PUBLIC_DEV_SHOP_DOMAIN
DEV_SHOP_DOMAIN
```
Note: Remove DEV_SHOP_DOMAIN and NEXT_PUBLIC_DEV_SHOP_DOMAIN from Vercel before
public launch. See TECH_DEBT.md #2.

---

## Domain — brandongillon.com

**Registrar/Host:** Hostinger
**Site builder:** Mobirise
**Current use:** Portfolio website at brandongillon.com
**Stock Buddy:** stock-buddy.brandongillon.com (live)

### Subdomain Strategy
Each Buddy System app gets its own subdomain under brandongillon.com:
- stock-buddy.brandongillon.com — Stock Buddy (live)
- transfer-buddy.brandongillon.com — future
- [name]-buddy.brandongillon.com — future

### DNS Configuration (Hostinger)
- Type: CNAME
- Name: stock-buddy
- Points to: d6465572e024230f.vercel-dns-017.com.
- TTL: 14400
- SSL certificate provisioned automatically by Vercel
- Live and verified as of 2026-04-11

---

## Email (SMTP)

**Purpose:** Sending PO emails to suppliers; contact form submissions to hello@brandongillon.com
**Provider:** Hostinger
**Sender address:** brandon@brandongillon.com
**Status:** Configured in .env.local and Vercel environment variables
**Password rotated:** 2026-04-11 after accidental exposure

### Environment Variables
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=brandon@brandongillon.com
SMTP_PASS                        ← rotated 2026-04-11
```

### Usage
- PO emails to suppliers: src/lib/sendPOEmail.js
- Contact form submissions: src/app/api/contact/route.js → hello@brandongillon.com

---

## Local Development

**Shell:** PowerShell (Windows)
**Local Path:** C:\Users\bgill\Desktop\Buddy-System\Stock-Buddy
**Start dev server:**
```powershell
cd "C:\Users\bgill\Desktop\Buddy-System\Stock-Buddy"
npm run dev
```
**Local URL:** http://localhost:3000

### Running with ngrok (for OAuth testing)
Open two terminals:
1. Terminal 1: `npm run dev`
2. Terminal 2: `ngrok http 3000 --request-header-add "ngrok-skip-browser-warning: true"`

Then update SHOPIFY_APP_URL in .env.local and the Dev Dashboard with the ngrok URL.

### Troubleshooting
- If you see a Tailwind resolve error: `Remove-Item -Recurse -Force .next` then `npm run dev`
- If tenant lookup fails, verify SUPABASE_SERVICE_ROLE_KEY is the service_role key not the anon key
- If Shopify sync fails, verify SHOPIFY_ADMIN_API_TOKEN is current (was rotated 2026-04-11)
- If OAuth HMAC fails, verify SHOPIFY_API_SECRET is the Client secret (shpss_ format) from Dev Dashboard
- If ngrok URL changes, update SHOPIFY_APP_URL in .env.local AND create a new version in Dev Dashboard

---

## Key Files Reference

| File | Purpose |
|------|---------|
| src/lib/supabaseClient.js | Supabase client — server-side only |
| src/lib/supabaseAdmin.js | Supabase admin client — tenant lookups only |
| src/lib/tenants.js | Tenant resolution helpers |
| src/lib/shopify/hmac.js | HMAC verification for OAuth and webhooks |
| src/lib/shopify/sessionToken.js | JWT session token verification for embedded app |
| src/lib/shopify/stateCookie.js | Signed cookie utility for OAuth CSRF protection |
| src/app/api/shopify/install/route.js | Shopify OAuth install entry point |
| src/app/api/shopify/callback/route.js | Shopify OAuth callback and token exchange |
| src/app/components/AppBridgeProvider.jsx | App Bridge v4 initializer |
| src/app/components/InstallPage.jsx | Install form — retained but not currently used at root |
| src/app/page.jsx | Root route — redirects to /request-access or /dashboard |
| src/app/request-access/page.jsx | Public landing page (intro) |
| src/app/request-access/components/RequestAccessIntro.jsx | Intro client component |
| src/app/request-access/form/page.jsx | Request access form page |
| src/app/request-access/form/components/RequestAccessForm.jsx | Form client component |
| src/app/api/request-access/route.js | Form submission → access_requests table |
| src/app/api/contact/route.js | Contact modal submission → SMTP email |
| src/proxy.js | Next.js proxy (formerly middleware) |
| .env.local | Local environment variables — never commit |
| .gitignore | Files excluded from Git |
| TECH_DEBT.md | Deferred decisions and pre-launch checklist |
| Engineering_Specs.txt | Architecture rules and patterns |
| Schema_Reference.md | Database schema reference |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Git initialized, connected to GitHub |
| 2026-04-11 | Supabase project renamed from PO-Builder to Stock-Buddy |
| 2026-04-11 | RLS enabled on all tables with service role bypass policy |
| 2026-04-11 | Shopify Admin API token rotated after accidental exposure |
| 2026-04-11 | Hostinger email password rotated after accidental exposure |
| 2026-04-11 | Vercel account created, app deployed to stock-buddy-delta.vercel.app |
| 2026-04-11 | Custom domain configured — live at stock-buddy.brandongillon.com |
| 2026-04-12 | Shopify OAuth flow fully implemented and tested |
| 2026-04-12 | App Bridge v4 wired up in app shell |
| 2026-04-12 | Stock Buddy successfully loading inside Shopify Admin iframe |
| 2026-04-12 | ngrok installed for local OAuth testing |
| 2026-04-12 | New Shopify API credentials added to .env.local and Vercel |
| 2026-04-16 | Public-facing request-access flow built and deployed |
| 2026-04-16 | Root route redirects to /request-access (no public install form) |
| 2026-04-16 | Contact form modal added — SMTP via /api/contact |
| 2026-04-16 | access_requests table created in Supabase |
| 2026-04-16 | Admin activity page: standard header, bulk error delete, combined stats table |
| 2026-04-16 | Schema_Reference.md updated: added beta_testers, beta_tester_sessions, access_requests |

---

*Last updated: 2026-04-16*
