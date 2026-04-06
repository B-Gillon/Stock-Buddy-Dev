import { NextResponse } from 'next/server';

/**
 * middleware.js
 * Runs on every request. Resolves the shop domain and attaches it
 * to the x-shop-domain header so API routes and server components
 * can call resolveTenant(request) without re-parsing the session.
 *
 * For now, shop domain is read from the x-shop-domain header directly
 * (set by Shopify's App Bridge or manually in dev). Later this will
 * parse a session token/JWT instead.
 */

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Pass through static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Read shop domain from header or query param (dev fallback)
  const shopDomain =
    request.headers.get('x-shop-domain') ||
    request.nextUrl.searchParams.get('shop') ||
    process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN;

  if (!shopDomain) {
    // In development without Shopify embedding, continue without tenant context.
    // In production this would redirect to an install/auth flow.
    return NextResponse.next();
  }

  // Forward the shop domain as a clean header for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-shop-domain', shopDomain);

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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
