# Stock Buddy — Technical Debt & Pre-Launch Checklist

This file tracks every intentional shortcut, deferred decision, and known issue
that must be resolved before public launch. Update this file whenever a new
shortcut is taken during development.

---

## CRITICAL — Must Fix Before Public Launch

### 1. Row Level Security (RLS) — Supabase
**Status:** Deferred — pragmatic bypass in place for beta  
**Risk:** Without RLS, a misconfigured query could expose one tenant's data to another  
**What was done for beta:**
- Service role key is used server-side (bypasses RLS entirely)
- Manual `tenant_id` filtering added to all queries as a safety layer
- RLS enabled in Supabase dashboard with a service role bypass policy

**What needs to happen before launch:**
- Switch `supabaseClient.js` to use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of service role key
- Implement JWT claims so Supabase knows which tenant each request belongs to
- Make `setTenantContext()` in `supabaseClient.js` actually call `set_tenant_id()` RPC
- Re-enable RLS enforcement on all tables
- Grant execute on `set_tenant_id()` to anon and authenticated roles
- Remove `setTenantContext` no-op and replace with real implementation
- Test cross-tenant isolation thoroughly before opening to public

**Reference:** Engineering_Specs.txt Sections 15, 16, 17

---

### 2. Dev Tenant Fallback — Remove Before Production
**Status:** Active in dev, must be removed  
**Risk:** If left in production, all requests without an x-shop-domain header will resolve to the dev tenant  
**Location:** `src/lib/tenants.js` — all four functions contain fallback logic  
**What to remove:**
```
process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN
process.env.DEV_SHOP_DOMAIN
```
Also remove `NEXT_PUBLIC_DEV_SHOP_DOMAIN` and `DEV_SHOP_DOMAIN` from production environment variables in Vercel.

**Reference:** Engineering_Specs.txt Section 15

---

### 3. Shopify OAuth — Replace Hardcoded Credentials
**Status:** Not built  
**Risk:** Current setup uses a single hardcoded Shopify store connection. Beta testers cannot connect their own stores.  
**What needs to happen:**
- Build the Shopify OAuth onboarding flow so merchants can install the app and connect their own store
- Replace hardcoded `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_API_TOKEN` env vars with per-tenant credentials stored in the `tenants` table
- All Shopify API calls must read credentials from the tenant record, not env vars

---

### 4. Supabase Client Uses Service Role Key in Browser Context
**Status:** Current — intentional for dev  
**Risk:** Service role key must NEVER be exposed to the browser  
**Current state:** The key is only used server-side (API routes and server components), but the architecture should be formally locked down  
**What to verify before launch:**
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is never referenced in any client component
- Confirm it is never included in any `NEXT_PUBLIC_` prefixed variable
- Audit all `supabase` imports to ensure none appear in `"use client"` files

---

## MODERATE — Should Fix Before or Shortly After Launch

### 5. PO Number Format is Hardcoded
**Status:** Deferred  
**What to do:** Make PO number format config-driven via the Settings page (Purchase Orders tab)  
**Reference:** Engineering_Specs.txt Section 20

---

### 6. Supabase Project Display Name
**Status:** Done — renamed from "PO-Builder" to "Stock-Buddy" on 2026-04-11  
**Note:** This was a display name only — no connection strings or env vars were affected

---

## LOW — Nice to Have Before Launch

### 7. Git Branch Cleanup
**Status:** A `sandbox` branch exists locally but is now identical to `main`  
**What to do:** Delete the sandbox branch when convenient  
```powershell
git branch -d sandbox
```

---

## Completed Items

| Item | Resolved | Notes |
|------|----------|-------|
| Supabase project renamed | 2026-04-11 | Display name only, no code changes |
| Git initialized and connected to GitHub | 2026-04-11 | github.com/B-Gillon/Stock-Buddy |

---

*Last updated: 2026-04-11*
