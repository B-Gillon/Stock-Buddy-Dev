// src/app/api/shopify/set-shop-cookie/route.js
// Called by AppBridgeProvider on mount. Requires a valid Shopify session token; the store is
// taken from the token, never from the request body. Sets our signed shop cookie.
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/shopify/sessionToken';
import { SHOP_COOKIE, createShopCookieValue, shopCookieOptions } from '@/lib/shopify/shopSession';

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const shop = token ? await verifySessionToken(token) : null;
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SHOP_COOKIE, createShopCookieValue(shop), shopCookieOptions);
  return response;
}
