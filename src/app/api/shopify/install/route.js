/**
 * src/app/api/shopify/install/route.js
 *
 * Shopify OAuth install route.
 *
 * Shopify hits this route when a merchant installs the app.
 * Query params from Shopify: shop, hmac, timestamp, id_token, host, embedded, locale, session
 *
 * Newer Shopify embedded app flows send an id_token JWT instead of
 * relying on HMAC for install verification. We verify the id_token
 * using our session token utility, which validates the signature,
 * expiry, audience, and shop domain.
 *
 * Flow:
 *   1. Validate the shop param
 *   2. Verify the id_token JWT (embedded app flow) or fall through for dev
 *   3. Generate a nonce and store it in a signed cookie (CSRF protection)
 *   4. Build the authorization URL and redirect the merchant to Shopify
 */

import { NextResponse } from "next/server";
import { getShopFromSessionToken } from "@/lib/shopify/sessionToken";
import { setStateCookie } from "@/lib/shopify/stateCookie";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;

const SCOPES = [
  "read_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_merchant_managed_fulfillment_orders",
].join(",");

/**
 * Validate that the shop param looks like a legitimate Shopify domain.
 * Prevents open redirect attacks.
 */
function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

/**
 * Verify the id_token JWT sent by Shopify in the embedded app install flow.
 * Reuses the session token verification logic since the token format is identical.
 */
async function verifyIdToken(idToken) {
  if (!idToken) return null;

  // Create a synthetic request with the id_token as a Bearer token
  // so we can reuse getShopFromSessionToken()
  const syntheticRequest = new Request("https://placeholder.com", {
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });

  return await getShopFromSessionToken(syntheticRequest);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const idToken = searchParams.get("id_token");

  // 1. Validate shop param
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter." },
      { status: 400 }
    );
  }

  // 2. Verify id_token if present (embedded app OAuth flow)
  // If id_token is present, verify it and confirm the shop matches.
  // If absent (non-embedded or dev install), proceed without verification.
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

  // 3. Generate nonce and build the authorization URL
  const nonce = crypto.randomUUID();
  const redirectUri = `${SHOPIFY_APP_URL}/api/shopify/callback`;

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", SHOPIFY_API_KEY);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", nonce);

  // 4. Redirect to Shopify, storing the nonce in a signed cookie for
  //    CSRF verification in the callback route
  const response = NextResponse.redirect(authUrl.toString());
  await setStateCookie(response, nonce);

  return response;
}
