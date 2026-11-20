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
import { exchangeTokenForAccess, exchangeTokenForOnlineUser } from "@/lib/shopify/tokenExchange";
import { setUserCookie } from "@/lib/shopify/userCookie";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    // 3. Exchange session token for an expiring offline access token (+ refresh token).
    //    Shopify keeps only one expiring offline token per app/store, so a new exchange retires the
    //    previous one. If the stored token is still good, keep it instead of replacing it on every load.
    const { data: existing } = await supabase
      .from("tenants")
      .select("access_token_expires_at, refresh_token, uninstalled_at")
      .eq("shop_domain", shop)
      .maybeSingle();
    const storedIsGood =
      existing?.refresh_token &&
      !existing.uninstalled_at &&
      existing.access_token_expires_at &&
      new Date(existing.access_token_expires_at).getTime() - Date.now() > 10 * 60 * 1000;

    if (!storedIsGood) {
      console.log("[TokenExchange] Exchanging token for shop:", shop);
      const tokens = await exchangeTokenForAccess(shop, sessionToken);
      console.log("[TokenExchange] Token exchange successful.");

      // 4. Upsert tenant with the new token pair
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("tenants")
        .upsert(
          {
            shop_domain:              shop,
            access_token:             tokens.accessToken,
            access_token_expires_at:  tokens.expiresAt,
            refresh_token:            tokens.refreshToken,
            refresh_token_expires_at: tokens.refreshTokenExpiresAt,
            installed_at:             now,
            uninstalled_at:           null,
            updated_at:               now,
          },
          { onConflict: "shop_domain", ignoreDuplicates: false }
        );

      if (error) {
        console.error("[TokenExchange] Supabase upsert failed:", error.message);
        return NextResponse.json({ error: "Failed to store token" }, { status: 500 });
      }
    }

    console.log("[TokenExchange] Tenant upserted successfully for shop:", shop);
    const response = NextResponse.json({ success: true });

    // 5. Record which staff user is using the app (for PO activity history).
    //    Non-fatal: history falls back to "Unknown user" if this fails.
    try {
      const user = await exchangeTokenForOnlineUser(shop, sessionToken);
      if (user) {
        setUserCookie(response, user);
        // Also keep the name on the server, so it can be found from the session token alone
        // (the cookie is not available when the browser blocks third-party cookies).
        if (user.id) {
          await supabaseAdmin.from("shop_users").upsert(
            { shop_domain: shop, user_id: user.id, name: user.name, email: user.email ?? null, updated_at: new Date().toISOString() },
            { onConflict: "shop_domain,user_id" }
          );
        }
        console.log("[TokenExchange] User resolved; sb-user cookie set.");
      }
    } catch (userErr) {
      console.warn("[TokenExchange] Could not resolve user:", userErr.message);
    }

    return response;

  } catch (err) {
    console.error("[TokenExchange] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
