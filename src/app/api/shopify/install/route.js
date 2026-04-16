/**
 * src/app/api/shopify/install/route.js
 *
 * Shopify OAuth install route.
 *
 * Shopify hits this route when a merchant installs the app.
 * Query params from Shopify: shop, hmac, timestamp, id_token, host, embedded, locale, session
 *
 * Flow:
 *   1. Validate the shop param
 *   2. Check that the shop domain is approved in beta_testers (notes = 'Approved')
 *   3. Verify the id_token JWT (embedded app flow) or fall through for dev
 *   4. Generate a nonce and store it in a signed cookie (CSRF protection)
 *   5. Build the authorization URL and redirect the merchant to Shopify
 */

import { NextResponse } from "next/server";
import { getShopFromSessionToken } from "@/lib/shopify/sessionToken";
import { setStateCookie } from "@/lib/shopify/stateCookie";
import { supabase } from "@/lib/supabaseClient";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;

const SCOPES = [
  "read_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_merchant_managed_fulfillment_orders",
].join(",");

function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

async function verifyIdToken(idToken) {
  if (!idToken) return null;
  const syntheticRequest = new Request("https://placeholder.com", {
    headers: { authorization: `Bearer ${idToken}` },
  });
  return await getShopFromSessionToken(syntheticRequest);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop    = searchParams.get("shop");
  const idToken = searchParams.get("id_token");

  // 1. Validate shop param
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter." },
      { status: 400 }
    );
  }

  // 2. Check that this shop domain is approved in beta_testers
  // Allow the dev store to bypass this check so local development still works.
  const isDevShop = shop === process.env.DEV_SHOP_DOMAIN ||
                    shop === process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN;

  if (!isDevShop) {
    const { data: approvedTester } = await supabase
      .from('beta_testers')
      .select('id')
      .eq('shopify_domain', shop)
      .eq('notes', 'Approved')
      .maybeSingle();

    if (!approvedTester) {
      console.warn(`[Install] Blocked install attempt for unapproved shop: ${shop}`);
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;">
          <h2>Access Restricted</h2>
          <p>This app is currently in private beta. Your store has not been approved for access.</p>
          <p>To request access, visit <a href="https://stock-buddy.brandongillon.com/request-access">stock-buddy.brandongillon.com/request-access</a>.</p>
        </body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }
  }

  // 3. Verify id_token if present (embedded app OAuth flow)
  if (idToken) {
    const tokenShop = await verifyIdToken(idToken);
    if (!tokenShop) {
      console.warn("[Install] id_token verification failed.");
      return NextResponse.json(
        { error: "id_token verification failed." },
        { status: 401 }
      );
    }
    if (tokenShop !== shop) {
      console.warn("[Install] id_token shop mismatch:", tokenShop, "vs", shop);
      return NextResponse.json(
        { error: "Shop domain mismatch in id_token." },
        { status: 401 }
      );
    }
    console.log("[Install] id_token verified for shop:", tokenShop);
  } else {
    console.log("[Install] No id_token present — proceeding without verification (dev mode).");
  }

  // 4. Generate nonce and build the authorization URL
  const nonce       = crypto.randomUUID();
  const redirectUri = `${SHOPIFY_APP_URL}/api/shopify/callback`;

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", SHOPIFY_API_KEY);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", nonce);

  // 5. Redirect to Shopify with signed state cookie for CSRF protection
  const response = NextResponse.redirect(authUrl.toString());
  await setStateCookie(response, nonce);

  return response;
}
