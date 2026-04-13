/**
 * src/app/api/shopify/token-exchange/route.js
 *
 * Called by AppBridgeProvider on every app load.
 * Verifies the App Bridge session token, exchanges it for an offline
 * access token, and upserts it into the tenants table.
 *
 * This ensures the tenants.access_token is always fresh without
 * requiring the legacy OAuth install/callback flow.
 */

import { NextResponse } from "next/server";
import { getShopFromSessionToken } from "@/lib/shopify/sessionToken";
import { exchangeTokenForAccess } from "@/lib/shopify/tokenExchange";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request) {
  // 1. Verify session token and extract shop domain
  const shop = await getShopFromSessionToken(request);

  if (!shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Extract the raw JWT from the Authorization header
  const authHeader = request.headers.get("authorization");
  const sessionToken = authHeader?.split(" ")[1];

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 });
  }

  try {
    // 3. Exchange session token for offline access token
    console.log("[TokenExchange] Exchanging token for shop:", shop);
    const accessToken = await exchangeTokenForAccess(shop, sessionToken);
    console.log("[TokenExchange] Token exchange successful, token prefix:", accessToken.slice(0, 10));

    // 4. Upsert tenant with fresh access token
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tenants")
      .upsert(
        {
          shop_domain:    shop,
          access_token:   accessToken,
          installed_at:   now,
          uninstalled_at: null,
          updated_at:     now,
        },
        { onConflict: "shop_domain", ignoreDuplicates: false }
      );

    if (error) {
      console.error("[TokenExchange] Supabase upsert failed:", error.message);
      return NextResponse.json({ error: "Failed to store token" }, { status: 500 });
    }

    console.log("[TokenExchange] Tenant upserted successfully for shop:", shop);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[TokenExchange] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
