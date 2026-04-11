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
- RLS is enabled on all 22 tables
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
**Connection type:** Hardcoded single-store credentials (dev only)
**Status:** OAuth onboarding flow not yet built — beta testers use dev store only

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
```

### Note
Before public launch, hardcoded credentials must be replaced with per-tenant OAuth
credentials stored in the tenants table. See TECH_DEBT.md #3.

---

## Hosting — Vercel

**Status:** Live as of 2026-04-11
**Account:** vercel.com (b-gillon's projects, Hobby plan)
**Dashboard:** https://vercel.com/b-gillons-projects
**Current URL:** https://stock-buddy-delta.vercel.app
**Target URL:** app.brandongillon.com (custom domain — configuration in progress)

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
**Current use:** Portfolio website
**Stock Buddy target:** app.brandongillon.com (subdomain)

### DNS Setup (in progress)
- A CNAME record needs to be added in Hostinger pointing app.brandongillon.com to Vercel
- Steps to be documented once configuration is complete

---

## Email (SMTP)

**Purpose:** Sending PO emails to suppliers
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

### Troubleshooting
- If you see a Tailwind resolve error: `Remove-Item -Recurse -Force .next` then `npm run dev`
- If tenant lookup fails, verify SUPABASE_SERVICE_ROLE_KEY is the service_role key not the anon key
- If Shopify sync fails, verify SHOPIFY_ADMIN_API_TOKEN is current (was rotated 2026-04-11)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| src/lib/supabaseClient.js | Supabase client — server-side only |
| src/lib/supabaseAdmin.js | Supabase admin client — tenant lookups only |
| src/lib/tenants.js | Tenant resolution helpers |
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
| 2026-04-11 | RLS enabled on all 22 tables with service role bypass policy |
| 2026-04-11 | Shopify Admin API token rotated after accidental exposure |
| 2026-04-11 | Hostinger email password rotated after accidental exposure |
| 2026-04-11 | Vercel account created, app deployed to stock-buddy-delta.vercel.app |
| 2026-04-11 | Custom domain configuration in progress (app.brandongillon.com) |

---

*Last updated: 2026-04-11*
