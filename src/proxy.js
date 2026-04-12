import { NextResponse } from "next/server";

/**
 * src/proxy.js
 *
 * Runs on every request. Resolves the shop domain and attaches it
 * to the x-shop-domain header so API routes and server components
 * can call getTenantId(request) without re-parsing the session.
 *
 * Also forwards the `host` param, which Shopify App Bridge requires
 * to initialize correctly inside the embedded app iframe.
 *
 * Shop domain resolution order:
 *   1. x-shop-domain header (set by App Bridge on embedded requests)
 *   2. ?shop query param (present on OAuth install/callback)
 *   3. NEXT_PUBLIC_DEV_SHOP_DOMAIN env var (local dev fallback — remove before production)
 *
 * BEFORE GOING TO PRODUCTION:
 * - Remove the NEXT_PUBLIC_DEV_SHOP_DOMAIN fallback
 * - Enforce rejection of requests with no shop domain
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

  // Resolve shop domain
  const shopDomain =
    request.headers.get("x-shop-domain") ||
    request.nextUrl.searchParams.get("shop") ||
    process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN;

  // Read host param — App Bridge needs this to initialize in the iframe
  const host =
    request.headers.get("x-shopify-host") ||
    request.nextUrl.searchParams.get("host");

  if (!shopDomain) {
    // In development without Shopify embedding, continue without tenant context.
    // In production this should redirect to the install flow instead.
    return NextResponse.next();
  }

  // Forward shop domain and host as clean headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shop-domain", shopDomain);

  if (host) {
    requestHeaders.set("x-shopify-host", host);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
