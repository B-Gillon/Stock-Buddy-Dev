// src/app/api/shopify/set-shop-cookie/route.js
// Called by AppBridgeProvider on mount to set the sb-shop cookie
// server-side from the verified shop domain extracted from App Bridge.
// This ensures the correct tenant is resolved on all subsequent requests.

import { NextResponse } from 'next/server';

function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { shop } = body;

  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('sb-shop', shop, {
    httpOnly: true,
    secure:   true,
    sameSite: 'none', // required for Shopify iframe context
    path:     '/',
    maxAge:   60 * 60 * 8, // 8 hours
  });

  return response;
}
