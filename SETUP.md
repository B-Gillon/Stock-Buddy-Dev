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

### Environment Variables (stored in .env.local — never commit this file)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Current Security State
- RLS is enabled in the dashboard with a service role bypass policy
- All queries are manually scoped by tenant_id as a safety layer
- Full RLS/JWT enforcement is deferred to pre-launch (see TECH_DEBT.md #1)

### Dev Tenant
- Shop domain: brandongtest.myshopify.com
- Set via `NEXT_PUBLIC_DEV_SHOP_DOMAIN` and `DEV_SHOP_DOMAIN` in .env.local
- Must be removed before production (see TECH_DEBT.md #2)

---

## Shopify

**Dev Store:** brandongtest.myshopify.com  
**Connection type:** Hardcoded single-store credentials (dev only)  
**Status:** OAuth onboarding flow not yet built — beta testers use dev store only  

### Environment Variables (stored in .env.local)
```
SHOPIFY_STORE_DOMAIN
SHOPIFY_ADMIN_API_TOKEN
SHOPIFY_API_VERSION
```

### Note
Before public launch, hardcoded credentials must be replaced with per-tenant OAuth credentials stored in the tenants table. See TECH_DEBT.md #3.

---

## Hosting — Vercel

**Status:** Not yet configured  
**Account:** (to be created)  
**Dashboard:** https://vercel.com  
**Target URL:** (to be determined — likely app.brandongillon.com or brandongillon.com/stock-buddy)  

### Environment Variables to Add in Vercel
When setting up Vercel, copy all values from .env.local into the Vercel environment variables dashboard:
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
```
Do NOT add DEV_SHOP_DOMAIN or NEXT_PUBLIC_DEV_SHOP_DOMAIN to Vercel production environment.

---

## Domain — brandongillon.com

**Registrar/Host:** Hostinger  
**Site builder:** Mobirise  
**Current use:** Portfolio website  
**Stock Buddy target:** app.brandongillon.com (subdomain — to be configured)  

### DNS Setup (pending)
- Will require adding a CNAME record in Hostinger pointing to Vercel's servers
- Steps to be documented once Vercel is configured

---

## Email (SMTP)

**Purpose:** Sending PO emails to suppliers  
**Status:** Configured in .env.local  
**Variables:**
```
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
```

---

## Local Development

**Node version:** (check with `node --version`)  
**Package manager:** npm  
**Start dev server:**
```powershell
cd "C:\Users\bgill\Desktop\Buddy-System\Stock-Buddy"
npm run dev
```
**Local URL:** http://localhost:3000  

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

*Last updated: 2026-04-11*
