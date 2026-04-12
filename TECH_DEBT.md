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
**Location:** `src/lib/tenants.js` and `src/lib/shopify/sessionToken.js`
**What to remove:**
```
process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN
process.env.DEV_SHOP_DOMAIN
```
Also remove `NEXT_PUBLIC_DEV_SHOP_DOMAIN` and `DEV_SHOP_DOMAIN` from production
environment variables in Vercel.

**Reference:** Engineering_Specs.txt Section 15

---

### 3. Shopify OAuth — Wire Per-Tenant Credentials into API Calls
**Status:** OAuth install flow is built and working. API calls still use hardcoded env vars.
**Risk:** Current setup exchanges OAuth tokens and stores them in the tenants table correctly,
but all Shopify API calls (sync, inventory updates, etc.) still read from hardcoded
SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN env vars instead of the tenant record.
**What needs to happen:**
- Update all Shopify API calls in src/lib/sync/ and src/lib/sync/po/ to read
  credentials from the tenants table instead of env vars
- Remove SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN from env vars once complete

---

### 4. Callback HMAC Verification — Investigate and Restore
**Status:** Skipped — Shopify's newer shpss_-format secret signs differently than documented
**Risk:** Without HMAC verification on the callback, a forged callback could theoretically
be submitted (mitigated by state cookie CSRF protection and Shopify's code exchange validation)
**Location:** src/app/api/shopify/callback/route.js
**What needs to happen:**
- Investigate how Shopify signs the callback request with the shpss_ format secret
- Restore HMAC verification on the callback route
- Remove the TODO comment once resolved

---

### 5. Supabase Client Uses Service Role Key in Browser Context
**Status:** Current — intentional for dev
**Risk:** Service role key must NEVER be exposed to the browser
**Current state:** The key is only used server-side (API routes and server components),
but the architecture should be formally locked down
**What to verify before launch:**
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is never referenced in any client component
- Confirm it is never included in any `NEXT_PUBLIC_` prefixed variable
- Audit all `supabase` imports to ensure none appear in `"use client"` files

---

### 6. Session Token Verification — Wire into API Routes
**Status:** Utility built (src/lib/shopify/sessionToken.js) but not yet called by API routes
**Risk:** API routes currently rely on the dev fallback (DEV_SHOP_DOMAIN) for tenant resolution.
In production, every API route must verify the App Bridge session token.
**What needs to happen:**
- Update all API routes to call `getShopFromSessionToken(request)` before getTenantId()
- Remove DEV_SHOP_DOMAIN fallback from sessionToken.js
- Verify session tokens are being sent correctly from App Bridge v4

---

## MODERATE — Should Fix Before or Shortly After Launch

### 7. App Handle is Hardcoded
**Status:** Deferred
**Location:** src/app/api/shopify/callback/route.js — `const APP_HANDLE = "stock-buddy-1"`
**Risk:** If the app handle changes in the Dev Dashboard, the post-OAuth redirect breaks
**What to do:** Make APP_HANDLE config-driven via an environment variable:
```
SHOPIFY_APP_HANDLE=stock-buddy-1
```

---

### 8. Debug Console Logs in OAuth Routes
**Status:** Active — added during debugging
**Location:** src/app/api/shopify/install/route.js and src/app/api/shopify/callback/route.js
**What to do:** Remove all `console.log` statements before production to avoid
leaking sensitive information (shop domains, token exchange details) to server logs.

---

### 9. ngrok-skip-browser-warning Header in next.config.mjs
**Status:** Active — required for local dev with ngrok
**Risk:** Should not be sent in production responses
**Location:** next.config.mjs headers() function
**What to do:** Remove the `ngrok-skip-browser-warning` header entry before production.

---

### 10. App Width in Shopify Admin Iframe
**Status:** Known issue — app renders too wide inside the Shopify Admin iframe
**Risk:** Poor UX for merchants — app shares horizontal space with the Admin sidebar
**What to do:** Audit and update CSS/layout to account for the reduced iframe width.
The Shopify Admin sidebar takes approximately 240px on the left.

---

### 11. PO Number Format is Hardcoded
**Status:** Deferred
**What to do:** Make PO number format config-driven via the Settings page (Purchase Orders tab)
**Reference:** Engineering_Specs.txt Section 20

---

### 12. Signed Cookie CSRF — Test in Production
**Status:** Implemented but untested in production
**Location:** src/lib/shopify/stateCookie.js
**Note:** SameSite=None cookies require HTTPS and behave differently across browsers.
Verify the state cookie is set and read correctly in the production OAuth flow.

---

## LOW — Nice to Have Before Launch

### 13. Git Branch Cleanup
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
| Shopify OAuth install flow | 2026-04-12 | Install + callback routes built and tested |
| App Bridge v4 wiring | 2026-04-12 | AppBridgeProvider.jsx in app shell |
| HMAC verification utility | 2026-04-12 | src/lib/shopify/hmac.js |
| Session token verification utility | 2026-04-12 | src/lib/shopify/sessionToken.js |
| Signed state cookie CSRF protection | 2026-04-12 | src/lib/shopify/stateCookie.js |
| Stock Buddy loading in Shopify Admin iframe | 2026-04-12 | Via Vercel production URL |

---

*Last updated: 2026-04-12*
