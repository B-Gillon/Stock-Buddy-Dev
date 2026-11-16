import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionValue } from "@/lib/auth/session";
import { verifySessionToken } from "@/lib/shopify/sessionToken";
import {
  SHOP_COOKIE,
  createShopCookieValue,
  readShopCookieValue,
  shopCookieOptions,
  verifyShopifyLoadUrl,
} from "@/lib/shopify/shopSession";

/**
 * src/proxy.js
 *
 * Runs on every request. Does two things:
 *
 * 1. MOBILE REDIRECT — If the request is from a mobile device and is
 *    targeting a desktop route, redirect to /mobile (preserving shop/host
 *    query params so the sb-shop cookie can still be set).
 *
 * 2. SHOP DOMAIN RESOLUTION — Resolves the shop domain and attaches it
 *    to the x-shop-domain header so API routes and server components
 *    can call getTenantId(request) without re-parsing the session.
 *
 * Shop domain resolution (verified sources only, in order):
 *   1. Shopify session token (Authorization: Bearer, or ?id_token=)
 *   2. Shopify-signed app-load URL (?hmac=)
 *   3. Our signed sb-shop-v2 cookie, issued after 1 or 2
 *   4. NEXT_PUBLIC_DEV_SHOP_DOMAIN (non-production only)
 * ?shop, Referer, x-shop-domain and the old plain sb-shop cookie are ignored.
 */

/**
 * Returns true if the User-Agent string belongs to a mobile device.
 * Checks for phones and tablets — both should use the mobile UI since
 * the desktop app is embedded in the Shopify Admin iframe on desktop.
 */
function isMobileUserAgent(userAgent) {
  if (!userAgent) return false;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(
    userAgent
  );
}

/**
 * Desktop routes that should redirect to /mobile when accessed from a
 * mobile device. Matches the top-level app routes only — /mobile itself,
 * public routes, admin routes, and API routes are excluded.
 */
const DESKTOP_ROUTE_PREFIXES = [
  "/dashboard",
  "/products",
  "/product",
  "/inventory",
  "/purchase-orders",
  "/suppliers",
  "/vendors",
  "/locations",
  "/settings",
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Pass through static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    // Public image assets (logos) must load on the login page for signed-out visitors
    /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Public and admin routes that don't need tenant context — skip entirely
  const isPublicRoute =
    pathname.startsWith("/request-access") ||
    pathname.startsWith("/api/request-access") ||
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/acknowledge/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/set-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/acknowledge") ||
    pathname.startsWith("/api/shopify/set-shop-cookie") ||
    pathname.startsWith("/admin");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ── Website login session ──────────────────────────────────────────────────
  // Headers that say who the user is are only ever set here, from a verified session cookie.
  // Anything a visitor sends under those names is discarded.
  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api");

  if (session) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL(session.role === "supplier" ? "/supplier-portal" : "/dashboard", request.url));
    }
    // Supplier users only get the supplier portal. Everything else (the retailer's app) is closed to them.
    if (session.role === "supplier") {
      const allowed =
        pathname.startsWith("/supplier-portal") || pathname.startsWith("/api/supplier-portal");
      if (!allowed) {
        return isApi
          ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
          : NextResponse.redirect(new URL("/supplier-portal", request.url));
      }
    }

    const sessionHeaders = new Headers(request.headers);
    sessionHeaders.delete("x-auth-user");
    sessionHeaders.delete("x-auth-role");
    sessionHeaders.delete("x-auth-supplier");
    sessionHeaders.set("x-shop-domain", session.shop);
    sessionHeaders.set("x-auth-user", session.uid);
    sessionHeaders.set("x-auth-role", session.role);
    if (session.sid) sessionHeaders.set("x-auth-supplier", session.sid);

    // Retailer on a phone gets the mobile screens, as in Shopify
    if (
      session.role === "retailer" &&
      isMobileUserAgent(request.headers.get("user-agent")) &&
      DESKTOP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
      !isApi
    ) {
      return NextResponse.redirect(new URL("/mobile", request.url));
    }
    return NextResponse.next({ request: { headers: sessionHeaders } });
  }

  // ── Mobile redirect ────────────────────────────────────────────────────────
  // If the request is from a mobile device and targets a desktop route,
  // redirect to /mobile. We preserve ?shop and ?host so AppBridgeProvider
  // can still initialize and the sb-shop cookie can be set.
  //
  // We deliberately do NOT redirect:
  //   - /mobile/* routes (already mobile)
  //   - /api/* routes (not pages)
  //   - / root (handled by page.jsx redirect logic)

  const userAgent = request.headers.get("user-agent") ?? "";
  const isMobile = isMobileUserAgent(userAgent);
  const isDesktopRoute = DESKTOP_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAlreadyMobile = pathname.startsWith("/mobile");
  const isApiRoute = pathname.startsWith("/api");

  if (isMobile && isDesktopRoute && !isAlreadyMobile && !isApiRoute) {
    const mobileUrl = new URL("/mobile", request.url);

    // Forward shop and host params so AppBridgeProvider can initialize
    // and the proxy's shop resolution below can persist the sb-shop cookie.
    const shop = request.nextUrl.searchParams.get("shop");
    const host = request.nextUrl.searchParams.get("host");
    if (shop) mobileUrl.searchParams.set("shop", shop);
    if (host) mobileUrl.searchParams.set("host", host);

    return NextResponse.redirect(mobileUrl);
  }

  // ── Resolve shop domain (verified sources only) ───────────────────────────
  // The store is NEVER taken from ?shop, Referer, a client-sent x-shop-domain header, or a plain
  // cookie: anyone can forge those. It must come from something Shopify signed, or from our own
  // signed cookie that we only issue after such a check.
  let shopDomain = null;
  let via = null;

  const bearer = request.headers.get("authorization");
  const jwt =
    bearer && /^Bearer\s+/i.test(bearer)
      ? bearer.replace(/^Bearer\s+/i, "").trim()
      : request.nextUrl.searchParams.get("id_token");

  if (jwt) {
    shopDomain = await verifySessionToken(jwt);
    if (shopDomain) via = "session-token";
  }
  if (!shopDomain) {
    shopDomain = verifyShopifyLoadUrl(request.nextUrl.searchParams);
    if (shopDomain) via = "signed-url";
  }
  if (!shopDomain) {
    shopDomain = readShopCookieValue(request.cookies.get(SHOP_COOKIE)?.value);
    if (shopDomain) via = "signed-cookie";
  }
  // Local development only
  if (!shopDomain && process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN) {
    shopDomain = process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN;
    via = "dev";
  }

  // Read host param — App Bridge needs this to initialize in the iframe
  const host =
    request.headers.get("x-shopify-host") ||
    request.nextUrl.searchParams.get("host");

  // Never let a visitor supply identity headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-shop-domain");
  requestHeaders.delete("x-auth-user");
  requestHeaders.delete("x-auth-role");
  requestHeaders.delete("x-auth-supplier");

  if (!shopDomain) {
    // Not inside Shopify and not signed in: send page visits to the website login
    if (!isApi) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  requestHeaders.set("x-shop-domain", shopDomain);
  if (host) requestHeaders.set("x-shopify-host", host);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // After a Shopify-verified request, remember it with our own signed cookie
  if (via === "session-token" || via === "signed-url") {
    response.cookies.set(SHOP_COOKIE, createShopCookieValue(shopDomain), shopCookieOptions);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
