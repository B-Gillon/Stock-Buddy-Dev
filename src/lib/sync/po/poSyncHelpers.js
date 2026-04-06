/**
 * poSyncHelpers.js
 * Shared utilities for PO → Shopify sync operations.
 * All functions are pure / side-effect-free except where noted.
 */

/**
 * Build the Shopify adjust_quantities payload for a set of line deltas.
 *
 * @param {Array} changes - [{ shopifyInventoryItemId, shopifyLocationId, delta }]
 * @param {string} reason - Shopify ledger reason (e.g. "received")
 * @returns {object} Shopify REST payload
 */
export function buildAdjustPayload(changes, reason = "received") {
  return {
    reason,
    changes: changes.map((c) => ({
      inventory_item_id: c.shopifyInventoryItemId,
      location_id: c.shopifyLocationId,
      delta: c.delta,
    })),
  };
}

/**
 * Call Shopify's adjust_quantities endpoint.
 * Uses the tenant's own credentials — never global.
 *
 * @param {object} opts
 * @param {string} opts.shopDomain
 * @param {string} opts.accessToken
 * @param {string} opts.apiVersion
 * @param {object} opts.payload  - result of buildAdjustPayload()
 * @returns {Promise<object>} Shopify response body
 */
export async function callShopifyAdjust({ shopDomain, accessToken, apiVersion, payload }) {
  const url = `https://${shopDomain}/admin/api/${apiVersion}/inventory_adjustments/adjust_quantities.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ inventory_adjustment: payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify adjust_quantities failed [${res.status}]: ${body}`);
  }

  return res.json();
}

/**
 * Write metafields to a Shopify inventory item.
 * Fire-and-forget friendly — caller decides whether to throw.
 */
export async function writeInventoryMetafields({
  shopDomain,
  accessToken,
  apiVersion,
  shopifyInventoryItemId,
  metafields,
}) {
  const url = `https://${shopDomain}/admin/api/${apiVersion}/inventory_items/${shopifyInventoryItemId}/metafields.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ metafield: metafields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify metafield write failed [${res.status}]: ${body}`);
  }

  return res.json();
}

/**
 * Log a successful Shopify incoming push to po_shopify_incoming.
 *
 * @param {object} supabase - server supabase client
 * @param {Array}  rows     - array of row objects matching po_shopify_incoming schema
 */
export async function logShopifyIncoming(supabase, rows) {
  const { error } = await supabase.from("po_shopify_incoming").insert(rows);
  if (error) throw new Error(`Failed to log po_shopify_incoming: ${error.message}`);
}

/**
 * Fetch existing po_shopify_incoming rows for a PO.
 * Used to detect retries (idempotency) and to compute reversal deltas.
 */
export async function getExistingIncoming(supabase, purchaseOrderId) {
  const { data, error } = await supabase
    .from("po_shopify_incoming")
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .is("reversed_at", null);

  if (error) throw new Error(`Failed to fetch po_shopify_incoming: ${error.message}`);
  return data ?? [];
}

/**
 * Mark po_shopify_incoming rows as reversed.
 */
export async function markIncomingReversed(supabase, ids, reason) {
  const { error } = await supabase
    .from("po_shopify_incoming")
    .update({ reversed_at: new Date().toISOString(), reversal_reason: reason })
    .in("id", ids);

  if (error) throw new Error(`Failed to mark incoming reversed: ${error.message}`);
}

/**
 * Resolve tenant Shopify credentials from the tenants table.
 */
export async function resolveTenantCredentials(supabase, tenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("shop_domain, access_token")
    .eq("id", tenantId)
    .single();

  if (error || !data) throw new Error(`Failed to resolve tenant credentials: ${error?.message}`);
  return {
    shopDomain: data.shop_domain,
    accessToken: data.access_token,
    apiVersion: process.env.SHOPIFY_API_VERSION,
  };
}
