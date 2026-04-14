/**
 * poSyncHelpers.js
 * Shared utilities for PO sync pipeline.
 * Handles Shopify API calls, credential resolution, and DB logging.
 */

import { supabase } from "@/lib/supabaseClient";

// ─── Credential Resolution ────────────────────────────────────────────────────

/**
 * Resolve Shopify credentials for a tenant.
 * Returns { storeDomain, accessToken, apiVersion }
 */
export async function resolveShopifyCredentials(tenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("shop_domain, access_token")
    .eq("id", tenantId)
    .single();

  if (error || !data) throw new Error(`Tenant not found: ${tenantId}`);
  if (!data.access_token) throw new Error(`No access token for tenant: ${tenantId}`);

  return {
    storeDomain: data.shop_domain,
    accessToken: data.access_token,
    apiVersion: process.env.SHOPIFY_API_VERSION || "2024-01",
  };
}

// ─── Shopify Inventory API ────────────────────────────────────────────────────

/**
 * Fetch current inventory level from Shopify for a given
 * inventory_item_id + location_id (Shopify IDs).
 */
export async function getShopifyInventoryLevel(
  { storeDomain, accessToken, apiVersion },
  shopifyInventoryItemId,
  shopifyLocationId
) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/inventory_levels.json?inventory_item_ids=${shopifyInventoryItemId}&location_ids=${shopifyLocationId}`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  if (!res.ok) throw new Error(`Shopify inventory_levels fetch failed: ${res.status}`);
  const json = await res.json();
  return json.inventory_levels?.[0] ?? null;
}

/**
 * Adjust the Shopify available quantity by a delta.
 * Use positive delta to increase, negative to decrease.
 */
export async function adjustShopifyAvailable(
  { storeDomain, accessToken, apiVersion },
  shopifyInventoryItemId,
  shopifyLocationId,
  delta
) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/inventory_levels/adjust.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location_id: shopifyLocationId,
      inventory_item_id: shopifyInventoryItemId,
      available_adjustment: delta,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify adjust failed (${res.status}): ${body}`);
  }
  return await res.json();
}

/**
 * Set Shopify available to an absolute value.
 */
export async function setShopifyAvailable(
  { storeDomain, accessToken, apiVersion },
  shopifyInventoryItemId,
  shopifyLocationId,
  available
) {
  const url = `https://${storeDomain}/admin/api/${apiVersion}/inventory_levels/set.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location_id: shopifyLocationId,
      inventory_item_id: shopifyInventoryItemId,
      available,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify set failed (${res.status}): ${body}`);
  }
  return await res.json();
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

/**
 * Fetch a purchase order with its lines and variant/inventory data.
 */
export async function fetchPOWithLines(poId, tenantId) {
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .single();

  if (poError || !po) throw new Error(`PO not found: ${poId}`);

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      *,
      variants!variant_id (
        id,
        shopify_variant_id,
        inventory_items (
          id,
          shopify_inventory_item_id
        )
      )
    `)
    .eq("purchase_order_id", poId)
    .eq("tenant_id", tenantId);

  if (linesError) throw new Error(`PO lines fetch failed: ${linesError.message}`);

  return { po, lines: lines || [] };
}

/**
 * Fetch the Shopify location ID for a given SB location UUID.
 */
export async function getShopifyLocationId(locationId, tenantId) {
  const { data, error } = await supabase
    .from("locations")
    .select("shopify_location_id")
    .eq("id", locationId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) throw new Error(`Location not found: ${locationId}`);
  if (!data.shopify_location_id) throw new Error(`No Shopify location ID for: ${locationId}`);

  return data.shopify_location_id;
}

/**
 * Log a push to po_shopify_incoming.
 */
export async function logShopifyIncoming({
  tenantId,
  poId,
  lineId,
  variantId,
  locationId,
  incomingQty,
  action = "push", // 'push' | 'reverse' | 'zero_out'
}) {
  const { error } = await supabase.from("po_shopify_incoming").insert({
    tenant_id: tenantId,
    purchase_order_id: poId,
    purchase_order_line_id: lineId,
    variant_id: variantId,
    quantity_pushed: incomingQty,
    action,
    pushed_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to log po_shopify_incoming:", error.message);
    // Non-fatal — log and continue
  }
}

/**
 * Update a PO line's incoming_qty and incoming_remaining.
 */
export async function updatePOLineIncoming(lineId, tenantId, incomingQty, incomingRemaining) {
  const { error } = await supabase
    .from("purchase_order_lines")
    .update({
      incoming_qty: incomingQty,
      incoming_remaining: incomingRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Failed to update PO line incoming: ${error.message}`);
}

/**
 * Update PO status and optional timestamps.
 */
export async function updatePOStatus(poId, tenantId, status, extraFields = {}) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status,
      ...extraFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Failed to update PO status: ${error.message}`);
}
