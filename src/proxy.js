import { NextResponse } from "next/server";

/**
 * src/proxy.js
 *
 * Runs on every request. Resolves the shop domain and attaches it
 * to the x-shop-domain header so API routes and server components
 * can call getTenantId(request) without re-parsing the session.
 *
 * Shop domain resolution order:
 *   1. x-shop-domain header (set by upstream or prior middleware)
 *   2. ?shop query param (present on initial Shopify embed load)
 *   3. sb-shop cookie (persisted from a prior resolution this session)
 *   4. NEXT_PUBLIC_DEV_SHOP_DOMAIN env var (local dev fallback — remove before production)
 *
 * When the shop is resolved from ?shop or the header, it is written
 * into the sb-shop cookie so subsequent navigations (which don't carry
 * ?shop) still resolve the correct tenant.
 *
 * BEFORE GOING TO PRODUCTION:
 * - Remove the NEXT_PUBLIC_DEV_SHOP_DOMAIN fallback
 * - Enforce rejection of requests with no shop domain
 * - Replace cookie-based resolution with full session token verification (TECH_DEBT #6)
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Pass through static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Public routes that don't need tenant context — skip shop resolution
  const isPublicRoute =
    pathname.startsWith("/request-access") ||
    pathname.startsWith("/api/request-access") ||
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/shopify/set-shop-cookie") ||
    pathname.startsWith("/admin");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ── Resolve shop domain ────────────────────────────────────────────────────

  // 1. Explicit header (set by App Bridge or prior pass)
  const headerShop = request.headers.get("x-shop-domain");

  // 2. ?shop query param (Shopify sets this on initial iframe load)
  const queryShop = request.nextUrl.searchParams.get("shop");

  // 3. Extract ?shop from Referer header (present on RSC and client nav requests)
  let refererShop = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const shopParam = refererUrl.searchParams.get("shop");
      if (shopParam && /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shopParam)) {
        refererShop = shopParam;
      }
    } catch { /* ignore malformed referer */ }
  }

  // 4. Cookie (persisted from a prior resolution)
  const cookieShop = request.cookies.get("sb-shop")?.value;

  // 5. Dev fallback
  const devShop = process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN;

  const shopDomain = headerShop || queryShop || refererShop || cookieShop || devShop;

  // Read host param — App Bridge needs this to initialize in the iframe
  const host =
    request.headers.get("x-shopify-host") ||
    request.nextUrl.searchParams.get("host");

  if (!shopDomain) {
    return NextResponse.next();
  }

  // Forward shop domain and host as clean headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shop-domain", shopDomain);

  if (host) {
    requestHeaders.set("x-shopify-host", host);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Persist the shop domain in a cookie whenever we have a fresh source
  // (header or query param), so subsequent navigations resolve correctly.
  // Cookie-based resolution alone is not secure — replace with session
  // token verification before public launch (TECH_DEBT #6).
  if (headerShop || queryShop || refererShop) {
    response.cookies.set("sb-shop", shopDomain, {
      httpOnly: true,
      secure:   true,
      sameSite: "none",   // required for Shopify iframe context
      path:     "/",
      maxAge:   60 * 60 * 8, // 8 hours — matches a typical work session
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
