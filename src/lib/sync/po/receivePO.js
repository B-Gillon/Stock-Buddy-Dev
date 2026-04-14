/**
 * receivePO.js
 *
 * Records receiving in Stock Buddy and adjusts Shopify available inventory.
 *
 * Rules:
 * - Only push to Shopify if receiving_source === 'stock_buddy'
 * - FAIL-SAFE: Block if incoming_remaining < qty_to_receive
 * - Reduces incoming_remaining by qty_to_receive
 * - Increases Shopify available by qty_to_receive
 * - Marks po_shopify_incoming rows as reversed (partial or full)
 * - Recalculates PO status: partially_received or received
 * - Does NOT roll back DB on Shopify failure (received qty is ground truth)
 */

import { supabase } from "@/lib/supabaseClient";
import {
  resolveShopifyCredentials,
  fetchPOWithLines,
  getShopifyLocationId,
  adjustShopifyAvailable,
  logShopifyIncoming,
} from "./poSyncHelpers";

/**
 * Record receiving for a single PO line.
 *
 * @param {string} poId        - UUID of the purchase order
 * @param {string} lineId      - UUID of the purchase_order_line
 * @param {number} qtyToReceive - Number of units being received
 * @param {string} tenantId    - UUID of the tenant
 * @returns {Promise<{ success: boolean, newPOStatus?: string, error?: string }>}
 */
export async function receiveInStockBuddy({ poId, lineId, qtyToReceive, tenantId }) {
  if (!Number.isInteger(qtyToReceive) || qtyToReceive <= 0) {
    return { success: false, error: "qty_to_receive must be a positive integer" };
  }

  try {
    const { po, lines } = await fetchPOWithLines(poId, tenantId);

    // Guard: must be in a receivable status
    if (!["released", "partially_received"].includes(po.status)) {
      return {
        success: false,
        error: `PO status '${po.status}' is not receivable`,
      };
    }

    // Find the specific line
    const line = lines.find((l) => l.id === lineId);
    if (!line) return { success: false, error: `PO line not found: ${lineId}` };

    // ── FAIL-SAFE ─────────────────────────────────────────────────────────────
    if (line.incoming_remaining < qtyToReceive) {
      return {
        success: false,
        error: `Cannot receive ${qtyToReceive} units — only ${line.incoming_remaining} remaining. Operation blocked.`,
        failSafe: true,
      };
    }

    // Guard: if receiving_source is external, block Shopify push
    const willPushToShopify = po.receiving_source === "stock_buddy";

    const inventoryItem = line.variants?.inventory_items?.[0];
    if (willPushToShopify && !inventoryItem?.shopify_inventory_item_id) {
      return { success: false, error: `No inventory item found for line ${lineId}` };
    }

    // ── Update internal state ─────────────────────────────────────────────────
    const newRemaining = line.incoming_remaining - qtyToReceive;

const { error: lineUpdateError } = await supabase
  .from("purchase_order_lines")
  .update({
    incoming_remaining: newRemaining,
    received_qty_units: (line.received_qty_units ?? 0) + qtyToReceive,
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", lineId)
  .eq("tenant_id", tenantId);

    if (lineUpdateError) throw new Error(`Line update failed: ${lineUpdateError.message}`);

    // ── Recalculate PO status ─────────────────────────────────────────────────
    // Re-fetch all lines to get fresh remaining values
    const { data: freshLines } = await supabase
      .from("purchase_order_lines")
      .select("incoming_remaining, order_qty_units")
      .eq("purchase_order_id", poId)
      .eq("tenant_id", tenantId);

    const allReceived = freshLines.every((l) => l.incoming_remaining === 0);
    const newPOStatus = allReceived ? "received" : "partially_received";

    const poUpdate = {
      status: newPOStatus,
      updated_at: new Date().toISOString(),
    };
    if (newPOStatus === "received") {
      poUpdate.received_at = new Date().toISOString();
    }

    const { error: poUpdateError } = await supabase
      .from("purchase_orders")
      .update(poUpdate)
      .eq("id", poId)
      .eq("tenant_id", tenantId);

    if (poUpdateError) throw new Error(`PO status update failed: ${poUpdateError.message}`);

    // ── Push to Shopify (if stock_buddy mode) ─────────────────────────────────
    if (willPushToShopify) {
      try {
        const shopifyCreds = await resolveShopifyCredentials(tenantId);
        const shopifyLocationId = await getShopifyLocationId(po.ship_to_location_id, tenantId);

        await adjustShopifyAvailable(
          shopifyCreds,
          inventoryItem.shopify_inventory_item_id,
          shopifyLocationId,
          qtyToReceive // positive delta → increase available
        );

        await logShopifyIncoming({
          tenantId,
          poId,
          lineId,
          variantId: line.variant_id,
          locationId: po.ship_to_location_id,
          incomingQty: -qtyToReceive, // negative = reduction of incoming
          action: "reverse",
        });

        // Stamp sync success
        await supabase
          .from("purchase_orders")
          .update({ shopify_synced_at: new Date().toISOString(), shopify_sync_error: null })
          .eq("id", poId)
          .eq("tenant_id", tenantId);
      } catch (shopifyErr) {
        // DB is already updated — do NOT roll back
        // Log the Shopify error but report partial success
        await supabase
          .from("purchase_orders")
          .update({ shopify_sync_error: shopifyErr.message })
          .eq("id", poId)
          .eq("tenant_id", tenantId);

        return {
          success: true, // DB succeeded
          newPOStatus,
          shopifyError: shopifyErr.message,
          warning: "Receiving recorded in Stock Buddy. Shopify sync failed — reconcile manually.",
        };
      }
    }

    return { success: true, newPOStatus };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
