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

### 3. Shopify OAuth — Wire Per-Tenant Credentials into All Sync Routes
**Status:** Complete for products and inventory — PO sync files remain
**Risk:** PO sync files in `src/lib/sync/po/` still use env var credentials.
This means PO syncs will fail for any tenant other than the dev store.

**What was done (2026-04-13):**
- `shopifyHelpers.js` updated to accept credentials as parameters (falls back to env vars)
- `fetchLocations.js`, `syncLocations.js`, and `src/app/api/sync/locations/route.js`
  updated to look up tenant credentials from the `tenants` table and pass them through

**What was done (2026-04-17):**
- `processProducts.js`, `syncProducts.js`, `src/app/api/sync/products/route.js` updated
- `processVariants.js`, `processInventoryItems.js`, `processInventoryLevels.js` updated
- `syncInventoryItems.js`, `syncInventoryLevels.js`, `src/app/api/sync/inventory/route.js` updated
- `supabaseHelpers.js` updated: `insertRows` now stamps `tenant_id` on every row
- `sync_status` unique constraint updated to `(sync_type, tenant_id)`

**What still needs to happen:**
- Apply the same credentials + tenant_id pattern to all PO sync files in `src/lib/sync/po/`
- Remove `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_API_TOKEN` from env vars once complete

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
**Risk:** API routes currently rely on a cookie-based shop resolution for tenant lookup.
The cookie is shared across all tabs in the same browser, meaning two different stores
open simultaneously in the same browser will interfere with each other.

**Context (2026-04-13):** Investigated App Bridge v4 token exchange. Found that
`window.shopify.idToken()` is unavailable — App Bridge CDN script loads but idToken()
returns nothing. Token exchange route was built but is not yet functional.

**Context (2026-04-17):** Implemented cookie-based shop resolution as a beta interim.
The proxy reads the shop domain from (in order): x-shop-domain header, ?shop query param,
Referer header ?shop param, sb-shop cookie, dev fallback. AppBridgeProvider decodes the
`host` param and calls `/api/shopify/set-shop-cookie` to persist it. This works correctly
for single-store use but breaks when two stores are open in the same browser simultaneously
because they share the same cookie. This is accepted as a known beta limitation — beta
testers will only ever have one store, so they will never hit this issue.

**What needs to happen before launch:**
- Resolve App Bridge v4 `window.shopify.idToken()` returning null
- Wire session token verification so each request carries its own signed JWT
- Update all API routes to call `getShopFromSessionToken(request)` before `getTenantId()`
- Remove cookie-based shop resolution from proxy.js
- Remove DEV_SHOP_DOMAIN fallback from sessionToken.js and tenants.js

---

### 7. Next.js Page Caching — force-dynamic Added to All Pages
**Status:** Resolved for known pages — verify sub-pages are covered
**What was done (2026-04-13):**
- Added `export const dynamic = "force-dynamic"` to all main server pages:
  products, inventory, suppliers, vendors, purchase-orders, settings, dashboard,
  locations, and all sub-pages under /products and /admin
**Risk:** Any new server page added in the future must also include this export or
it may serve stale cached data after a sync.

---

### 8. beta_testers.tenant_id Not Written at Install Time
**Status:** Deferred — resolved at render time via domain match
**Risk:** If a beta tester's shopify_domain doesn't exactly match their tenants.shop_domain,
the admin page will show them as "not connected" even after a successful install.
**What was done for beta:**
- The admin activity page (page.jsx) resolves tenant_id at render time by matching
  beta_testers.shopify_domain against tenants.shop_domain
- This is fragile — domain format mismatches (e.g. with https:// prefix or trailing slash)
  will break the match silently
- AddTesterModal now normalizes shopify_domain on save (strips protocol and trailing slash)

**What needs to happen before launch:**
- On successful OAuth install (callback route), look up the beta_testers row by
  shop_domain and write the resolved tenant_id back to beta_testers.tenant_id
- This makes the relationship explicit in the database rather than inferred at render time
- Location: `src/app/api/shopify/callback/route.js` — after the tenant upsert, add:
  ```js
  await supabase
    .from('beta_testers')
    .update({ tenant_id: tenant.id, installed_at: new Date().toISOString() })
    .eq('shopify_domain', shop)
    .is('tenant_id', null);
  ```

---

## MODERATE — Should Fix Before or Shortly After Launch

### 9. App Handle is Hardcoded
**Status:** Deferred
**Location:** src/app/api/shopify/callback/route.js — `const APP_HANDLE = "stock-buddy-1"`
**Risk:** If the app handle changes in the Dev Dashboard, the post-OAuth redirect breaks
**What to do:** Make APP_HANDLE config-driven via an environment variable:
```
SHOPIFY_APP_HANDLE=stock-buddy-1
```

---

### 10. Debug Console Logs in OAuth and Sync Routes
**Status:** Active — added during debugging on 2026-04-13
**Locations:**
- `src/app/api/shopify/install/route.js`
- `src/app/api/shopify/callback/route.js`
- `src/app/api/sync/locations/route.js`
- `src/lib/sync/fetchLocations.js`
**What to do:** Remove all `console.log` and `console.error` debug statements before
production to avoid leaking sensitive information (shop domains, token prefixes,
credentials) to server logs.

---

### 11. ngrok-skip-browser-warning Header in next.config.mjs
**Status:** Active — required for local dev with ngrok
**Risk:** Should not be sent in production responses
**Location:** next.config.mjs headers() function
**What to do:** Remove the `ngrok-skip-browser-warning` header entry before production.

---

### 12. PO Number Format is Hardcoded
**Status:** Deferred
**What to do:** Make PO number format config-driven via the Settings page (Purchase Orders tab)
**Reference:** Engineering_Specs.txt Section 20

---

### 13. Signed Cookie CSRF — Test in Production
**Status:** Implemented but untested in production
**Location:** src/lib/shopify/stateCookie.js
**Note:** SameSite=None cookies require HTTPS and behave differently across browsers.
Verify the state cookie is set and read correctly in the production OAuth flow.

---

### 14. Shopify App Icon
**Status:** Using default Shopify app icon
**What to do:** Upload the SB logo as the app icon in the Shopify Dev Dashboard:
dev.shopify.com → Stock Buddy → Configuration → App icon
This icon appears in the Shopify Admin title bar, sidebar, and app listing.

---

## LOW — Nice to Have Before Launch

### 15. Git Branch Cleanup
**Status:** A `sandbox` branch exists locally but is now identical to `main`
**What to do:** Delete the sandbox branch when convenient
```powershell
git branch -d sandbox
```

---

### 16. Multi-Tab Store Isolation — Cookie Limitation
**Status:** Known beta limitation — accepted for now
**Risk:** Opening two different Shopify stores in the same browser simultaneously causes
the sb-shop cookie to be overwritten by whichever store loaded last, resulting in the
wrong store's data being shown until the page is refreshed.
**Why it's acceptable for beta:** Beta testers each have one store and will never need
to have two stores open simultaneously. Only affects the developer during testing.
**What needs to happen before launch:** Resolved automatically when session token
verification (item #6) is implemented — session tokens are per-request and don't rely
on a shared cookie.

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
| Iframe side-scroll fixed | 2026-04-13 | Added w-full overflow-x-hidden to AppLayout outer wrapper |
| Header nav clipping fixed | 2026-04-13 | Abbreviated "Purchase Orders" to "POs", reduced nav padding |
| Install landing page | 2026-04-13 | src/app/page.jsx + src/app/components/InstallPage.jsx |
| Root route redirects to dashboard inside Shopify | 2026-04-13 | Detects host+shop params and redirects |
| Location sync tenant_id fix | 2026-04-13 | processLocations now writes tenant_id on every row |
| Sync credentials fixed for locations | 2026-04-13 | Reads shop_domain + access_token from tenants table |
| supabaseHelpers env var corrected | 2026-04-13 | SUPABASE_URL → NEXT_PUBLIC_SUPABASE_URL |
| inventory_levels conflict column fixed | 2026-04-13 | Now uses composite key inventory_item_id,location_id |
| force-dynamic added to all server pages | 2026-04-13 | Prevents stale cache after sync operations |
| Legacy install flow enabled | 2026-04-13 | App URL set to /api/shopify/install in Dev Dashboard |
| Token exchange route built | 2026-04-13 | src/app/api/shopify/token-exchange/route.js — not yet functional |
| Public request-access flow built | 2026-04-16 | Two-page flow: intro + form; access_requests table |
| Root route changed to redirect to /request-access | 2026-04-16 | No public install form |
| Contact form modal added | 2026-04-16 | Replaces mailto link; sends via SMTP to hello@brandongillon.com |
| Admin activity page overhauled | 2026-04-16 | Standard header, combined stats table, bulk error delete |
| Schema_Reference.md updated | 2026-04-16 | Added beta_testers, beta_tester_sessions, access_requests |
| shopify_domain normalization on beta tester add | 2026-04-16 | Strips protocol and trailing slash in AddTesterModal |

| Product/inventory/variant sync tenant isolation | 2026-04-17 | tenant_id stamped through full sync chain; supabaseHelpers insertRows updated |
| sync_status unique constraint updated | 2026-04-17 | Now unique on (sync_type, tenant_id) |
| Cookie-based shop resolution | 2026-04-17 | proxy.js reads shop from Referer/?shop/cookie; AppBridgeProvider sets cookie via /api/shopify/set-shop-cookie |
| Install route locked to approved beta testers | 2026-04-17 | Checks beta_testers.notes = 'Approved' before starting OAuth |

---

*Last updated: 2026-04-17*
