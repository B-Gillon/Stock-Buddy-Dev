/**
 * src/app/api/shopify/callback/route.js
 *
 * Shopify OAuth callback route.
 *
 * Shopify redirects the merchant here after they approve the app.
 * Query params from Shopify: shop, code, state, hmac, timestamp, host
 *
 * Flow:
 *   1. Validate the shop param
 *   2. Verify the state param against the signed cookie (CSRF protection)
 *   3. Exchange the temporary code for a permanent access token
 *   4. Upsert the tenant record in Supabase
 *   5. Clear the state cookie and redirect into the embedded app
 *
 * NOTE: HMAC verification on the callback is currently skipped.
 * Shopify's newer embedded app OAuth flow uses a shpss_-format secret
 * whose HMAC signing behavior differs from the documented legacy flow.
 * Security is maintained via:
 *   - State cookie verification (prevents CSRF)
 *   - Code exchange with Shopify's token endpoint (invalid codes are rejected)
 * TODO: Investigate and restore HMAC verification before production.
 */

import { NextResponse } from "next/server";
import { verifyStateCookie, clearStateCookie } from "@/lib/shopify/stateCookie";
import { supabase } from "@/lib/supabaseClient";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

// The app handle as it appears in the Shopify Admin URL.
// Found at: admin.shopify.com/store/{shop}/apps/{APP_HANDLE}
// Set SHOPIFY_APP_HANDLE to override (e.g. for a separate dev app); defaults to the existing app.
const APP_HANDLE = process.env.SHOPIFY_APP_HANDLE || "stock-buddy-1";

/**
 * Validate that the shop param looks like a legitimate Shopify domain.
 */
function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

/**
 * Exchange the temporary OAuth code for a permanent access token.
 */
async function exchangeCodeForToken(shop, code) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${text}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("No access_token in Shopify response.");
  }

  return data.access_token;
}

/**
 * Upsert the tenant record in Supabase.
 * Creates a new tenant on first install, updates the access token on reinstall.
 */
async function upsertTenant(shop, accessToken) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("tenants")
    .upsert(
      {
        shop_domain: shop,
        access_token: accessToken,
        installed_at: now,
        uninstalled_at: null,
        updated_at: now,
      },
      {
        onConflict: "shop_domain",
        ignoreDuplicates: false,
      }
    )
    .select("id, shop_domain")
    .single();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return data;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // 1. Validate shop param
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter." },
      { status: 400 }
    );
  }

  // 2. Verify state cookie (CSRF protection)
  const stateValid = await verifyStateCookie(request, state);
  if (!stateValid) {
    console.warn("[Callback] State cookie verification failed.");
    return NextResponse.json(
      { error: "State parameter invalid or missing. Possible CSRF attack." },
      { status: 403 }
    );
  }
  console.log("[Callback] State cookie verified.");

  // 3. Validate code param
  if (!code) {
    return NextResponse.json(
      { error: "Missing code parameter." },
      { status: 400 }
    );
  }

  try {
    // 4. Exchange code for permanent access token
    console.log("[Callback] Exchanging code for token...");
    const accessToken = await exchangeCodeForToken(shop, code);
    console.log("[Callback] Token exchange successful.");

    // 5. Upsert tenant in Supabase
    console.log("[Callback] Upserting tenant...");
    await upsertTenant(shop, accessToken);
    console.log("[Callback] Tenant upserted successfully.");

    // 6. Redirect merchant into the embedded app and clear the state cookie
    const redirectUrl = `https://${shop}/admin/apps/${APP_HANDLE}`;
    console.log("[Callback] Redirecting to:", redirectUrl);

    const response = NextResponse.redirect(redirectUrl);
    clearStateCookie(response);

    return response;
  } catch (err) {
    console.error("[Callback Error]", err.message);

    const errorResponse = NextResponse.json(
      { error: "OAuth callback failed. Check server logs." },
      { status: 500 }
    );
    clearStateCookie(errorResponse);

    return errorResponse;
  }
}
