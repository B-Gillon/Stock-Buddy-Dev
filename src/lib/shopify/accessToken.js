/**
 * src/lib/shopify/accessToken.js
 *
 * The one place that hands out a usable Shopify Admin API token for a tenant.
 * Offline tokens expire after 1 hour. If the stored token is missing or about to
 * expire, it is refreshed with the stored refresh token and the new pair is saved.
 *
 * Shopify replaces the refresh token every time it is used, so refreshes are
 * guarded: the save only succeeds if the refresh token in the database is still
 * the one we used. If another request refreshed first, we use its result instead.
 *
 * Tokens issued before expiring tokens existed have no expiry; they are used as-is
 * until the merchant next opens the app (which swaps them for an expiring token).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { refreshOfflineToken } from "@/lib/shopify/tokenExchange";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readTenant(tenantId) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("shop_domain, access_token, access_token_expires_at, refresh_token")
    .eq("id", tenantId)
    .single();
  if (error || !data) throw new Error(`Tenant not found: ${tenantId}`);
  return data;
}

const isFresh = (t) =>
  t.access_token &&
  (!t.access_token_expires_at || new Date(t.access_token_expires_at).getTime() - Date.now() > REFRESH_MARGIN_MS);

/**
 * @returns {Promise<{ shopDomain: string, accessToken: string }>}
 */
export async function getShopifyCredentials(tenantId) {
  let tenant = await readTenant(tenantId);
  if (isFresh(tenant)) return { shopDomain: tenant.shop_domain, accessToken: tenant.access_token };

  if (!tenant.refresh_token) {
    throw new Error("Shopify token expired and no refresh token is stored. Open Stock Buddy from the Shopify admin to reconnect.");
  }

  const usedRefreshToken = tenant.refresh_token;
  let fresh;
  try {
    fresh = await refreshOfflineToken(tenant.shop_domain, usedRefreshToken);
  } catch (err) {
    // Another request may have refreshed just before us; use theirs if so.
    tenant = await readTenant(tenantId);
    if (tenant.refresh_token !== usedRefreshToken && isFresh(tenant)) {
      return { shopDomain: tenant.shop_domain, accessToken: tenant.access_token };
    }
    if (err.status === 401) {
      throw new Error("Shopify connection expired. Open Stock Buddy from the Shopify admin to reconnect.");
    }
    throw err;
  }

  const { data: saved, error } = await supabaseAdmin
    .from("tenants")
    .update({
      access_token:             fresh.accessToken,
      access_token_expires_at:  fresh.expiresAt,
      refresh_token:            fresh.refreshToken,
      refresh_token_expires_at: fresh.refreshTokenExpiresAt,
      updated_at:               new Date().toISOString(),
    })
    .eq("id", tenantId)
    .eq("refresh_token", usedRefreshToken)
    .select("id");
  if (error) throw new Error(`Could not save refreshed Shopify token: ${error.message}`);

  if (!saved?.length) {
    // Lost the race: someone else saved a newer pair. Use theirs.
    tenant = await readTenant(tenantId);
    return { shopDomain: tenant.shop_domain, accessToken: tenant.access_token };
  }
  return { shopDomain: tenant.shop_domain, accessToken: fresh.accessToken };
}
