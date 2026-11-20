/**
 * poSyncHelpers.js
 * Shared utilities for PO sync pipeline.
 * Handles Shopify API calls, credential resolution, and DB logging.
 */

import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabaseClient";
import { getShopifyCredentials } from "@/lib/shopify/accessToken";
import { shopifyGraphQL } from "@/lib/sync/shopifyHelpers";

// ─── Credential Resolution ────────────────────────────────────────────────────

/**
 * Resolve Shopify credentials for a tenant.
 * Returns { storeDomain, accessToken }
 */
export async function resolveShopifyCredentials(tenantId) {
  const { shopDomain, accessToken } = await getShopifyCredentials(tenantId);
  return { storeDomain: shopDomain, accessToken };
}

// ─── Shopify Inventory API (Admin GraphQL) ────────────────────────────────────

const toGid = (type, id) =>
  String(id).startsWith("gid://") ? String(id) : `gid://shopify/${type}/${id}`;

const gqlCreds = ({ storeDomain, accessToken }) => ({
  shopDomain: storeDomain,
  accessToken,
});

function throwOnUserErrors(label, userErrors) {
  if (userErrors?.length) {
    throw new Error(`Shopify ${label} failed: ${userErrors.map((e) => e.message).join("; ")}`);
  }
}

const INVENTORY_LEVEL_QUERY = `
  query InventoryLevel($itemId: ID!, $locationId: ID!) {
    inventoryItem(id: $itemId) {
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) { name quantity }
      }
    }
  }
`;

const INVENTORY_ADJUST_MUTATION = `
  mutation InventoryAdjust($input: InventoryAdjustQuantitiesInput!, $key: String!) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
      inventoryAdjustmentGroup { id }
      userErrors { code field message }
    }
  }
`;

const INVENTORY_SET_MUTATION = `
  mutation InventorySet($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { id }
      userErrors { code field message }
    }
  }
`;

const isStale = (userErrors) => userErrors?.some((e) => e.code === "CHANGE_FROM_QUANTITY_STALE");

/**
 * Fetch current inventory level from Shopify for a given
 * inventory_item_id + location_id (numeric ids or GIDs).
 * Returns { available } or null when the item has no level at the location.
 */
export async function getShopifyInventoryLevel(
  creds,
  shopifyInventoryItemId,
  shopifyLocationId
) {
  const data = await shopifyGraphQL(
    INVENTORY_LEVEL_QUERY,
    {
      itemId: toGid("InventoryItem", shopifyInventoryItemId),
      locationId: toGid("Location", shopifyLocationId),
    },
    gqlCreds(creds)
  );
  const level = data?.inventoryItem?.inventoryLevel;
  if (!level) return null;
  const available = level.quantities?.find((q) => q.name === "available")?.quantity ?? 0;
  return { available };
}

/**
 * Run an inventory mutation that needs the expected current quantity (changeFromQuantity, required
 * from API 2026-04). Reads the current available, sends it as the expected value, and retries once
 * if someone else changed the quantity in between.
 */
async function withExpectedQuantity(creds, itemId, locationId, label, run) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const level = await getShopifyInventoryLevel(creds, itemId, locationId);
    if (!level) throw new Error(`Shopify ${label} failed: item is not stocked at this location`);
    const result = await run(level.available);
    if (!isStale(result.userErrors)) {
      throwOnUserErrors(label, result.userErrors);
      return result;
    }
  }
  throw new Error(`Shopify ${label} failed: quantity kept changing, try again`);
}

/**
 * Adjust the Shopify available quantity by a delta.
 * Use positive delta to increase, negative to decrease.
 */
export async function adjustShopifyAvailable(
  creds,
  shopifyInventoryItemId,
  shopifyLocationId,
  delta
) {
  return withExpectedQuantity(creds, shopifyInventoryItemId, shopifyLocationId, "adjust", async (current) => {
    const data = await shopifyGraphQL(
      INVENTORY_ADJUST_MUTATION,
      {
        key: randomUUID(),
        input: {
          reason: "received",
          name: "available",
          changes: [
            {
              delta,
              changeFromQuantity: current,
              inventoryItemId: toGid("InventoryItem", shopifyInventoryItemId),
              locationId: toGid("Location", shopifyLocationId),
            },
          ],
        },
      },
      gqlCreds(creds)
    );
    return data.inventoryAdjustQuantities;
  });
}

/**
 * Set Shopify available to an absolute value.
 */
export async function setShopifyAvailable(
  creds,
  shopifyInventoryItemId,
  shopifyLocationId,
  available
) {
  return withExpectedQuantity(creds, shopifyInventoryItemId, shopifyLocationId, "set", async (current) => {
    const data = await shopifyGraphQL(
      INVENTORY_SET_MUTATION,
      {
        input: {
          name: "available",
          reason: "correction",
          quantities: [
            {
              inventoryItemId: toGid("InventoryItem", shopifyInventoryItemId),
              locationId: toGid("Location", shopifyLocationId),
              quantity: available,
              changeFromQuantity: current,
            },
          ],
        },
      },
      gqlCreds(creds)
    );
    return data.inventorySetQuantities;
  });
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
