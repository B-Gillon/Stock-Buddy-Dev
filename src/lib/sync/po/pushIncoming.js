/**
 * pushIncoming.js
 *
 * Pushes incoming quantities to Shopify when a PO is released or edited.
 *
 * Rules:
 * - Only push if receiving_source === 'stock_buddy'
 * - Sets purchase_order_lines.incoming_qty = order_qty_units
 * - Sets purchase_order_lines.incoming_remaining = incoming_qty
 * - Adjusts Shopify available to reflect incoming (Stock Buddy tracks
 *   incoming internally; Shopify available is adjusted on receive)
 * - Logs every push to po_shopify_incoming
 * - Stamps shopify_synced_at on the PO on success
 *
 * NOTE ON SHOPIFY "INCOMING":
 * Shopify's inventory_levels do not have a native writable "incoming" field
 * via REST. Stock Buddy tracks incoming internally in purchase_order_lines
 * and only adjusts Shopify `available` when items are actually received.
 * This function prepares the internal state for receiving.
 */

import { supabase } from "@/lib/supabaseClient";
import {
  resolveShopifyCredentials,
  fetchPOWithLines,
  getShopifyLocationId,
  updatePOLineIncoming,
  logShopifyIncoming,
} from "./poSyncHelpers";

/**
 * Push incoming quantities for a PO to internal DB state.
 * Called on PO release and on PO edit (when order_qty_units changes).
 *
 * @param {string} poId - UUID of the purchase order
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<{ success: boolean, linesProcessed: number, error?: string }>}
 */
export async function pushIncomingToShopify(poId, tenantId) {
  let shopifyCreds;
  let shopifyLocationId;

  try {
    const { po, lines } = await fetchPOWithLines(poId, tenantId);

    // Guard: only push for stock_buddy receiving source
    if (po.receiving_source !== "stock_buddy") {
      return {
        success: true,
        linesProcessed: 0,
        skipped: true,
        reason: "receiving_source is external — skipping incoming push",
      };
    }

    if (!po.ship_to_location_id) {
      throw new Error("PO has no ship_to_location_id — cannot push incoming");
    }

    shopifyCreds = await resolveShopifyCredentials(tenantId);
    shopifyLocationId = await getShopifyLocationId(po.ship_to_location_id, tenantId);

    let linesProcessed = 0;

    for (const line of lines) {
      const incomingQty = line.order_qty_units;
      const variantId = line.variant_id;
      const inventoryItem = line.variants?.inventory_items?.[0];

      if (!inventoryItem?.shopify_inventory_item_id) {
        console.warn(`No inventory item for PO line ${line.id} — skipping`);
        continue;
      }

      // Update internal incoming state
      await updatePOLineIncoming(line.id, tenantId, incomingQty, incomingQty);

      // Log the push
      await logShopifyIncoming({
        tenantId,
        poId,
        lineId: line.id,
        variantId,
        locationId: po.ship_to_location_id,
        incomingQty,
        action: "push",
      });

      linesProcessed++;
    }

    // Stamp shopify_synced_at on the PO
    await supabase
      .from("purchase_orders")
      .update({
        shopify_synced_at: new Date().toISOString(),
        shopify_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId)
      .eq("tenant_id", tenantId);

    return { success: true, linesProcessed };
  } catch (err) {
    // Stamp sync error on PO
    await supabase
      .from("purchase_orders")
      .update({
        shopify_sync_error: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId)
      .eq("tenant_id", tenantId);

    return { success: false, linesProcessed: 0, error: err.message };
  }
}
