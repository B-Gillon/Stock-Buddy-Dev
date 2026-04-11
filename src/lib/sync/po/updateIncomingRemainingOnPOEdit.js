/**
 * updateIncomingRemainingOnPOEdit.js
 *
 * When a PO is edited and order_qty_units changes on a line,
 * recalculate incoming_qty and incoming_remaining and update
 * internal DB state.
 *
 * Rules:
 * - Only runs if receiving_source === 'stock_buddy'
 * - incoming_qty = new order_qty_units
 * - incoming_remaining = incoming_qty - qty_already_received
 *   where qty_already_received = original incoming_qty - original incoming_remaining
 * - Floors incoming_remaining at 0 (cannot go negative)
 * - Does NOT push to Shopify available (that happens only on receive)
 */

import { supabase } from "@/lib/supabaseClient";
import { logShopifyIncoming } from "./poSyncHelpers";

/**
 * Update incoming_qty and incoming_remaining for all lines on a PO after an edit.
 *
 * @param {string} poId - UUID of the purchase order
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<{ success: boolean, linesUpdated: number, error?: string }>}
 */
export async function updateIncomingRemainingOnPOEdit(poId, tenantId) {
  try {
    // Fetch PO to check receiving_source
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("id, status, receiving_source, ship_to_location_id")
      .eq("id", poId)
      .eq("tenant_id", tenantId)
      .single();

    if (poError || !po) throw new Error(`PO not found: ${poId}`);

    // Only relevant for stock_buddy POs in an active state
    if (po.receiving_source !== "stock_buddy") {
      return { success: true, linesUpdated: 0, skipped: true };
    }

    if (!["draft", "released", "partially_received"].includes(po.status)) {
      return { success: true, linesUpdated: 0, skipped: true };
    }

    // Fetch current lines
    const { data: lines, error: linesError } = await supabase
      .from("purchase_order_lines")
      .select("id, variant_id, order_qty_units, incoming_qty, incoming_remaining")
      .eq("purchase_order_id", poId)
      .eq("tenant_id", tenantId);

    if (linesError) throw new Error(`Lines fetch failed: ${linesError.message}`);

    let linesUpdated = 0;

    for (const line of lines || []) {
      const newIncomingQty = line.order_qty_units;

      // qty already received = original incoming_qty - original incoming_remaining
      const qtyAlreadyReceived = Math.max(0, (line.incoming_qty ?? 0) - (line.incoming_remaining ?? 0));

      // New remaining = new total - already received, floored at 0
      const newIncomingRemaining = Math.max(0, newIncomingQty - qtyAlreadyReceived);

      // Skip if nothing changed
      if (
        line.incoming_qty === newIncomingQty &&
        line.incoming_remaining === newIncomingRemaining
      ) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("purchase_order_lines")
        .update({
          incoming_qty: newIncomingQty,
          incoming_remaining: newIncomingRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("id", line.id)
        .eq("tenant_id", tenantId);

      if (updateError) {
        console.error(`Failed to update line ${line.id}:`, updateError.message);
        continue;
      }

      // Log the adjustment to po_shopify_incoming
      const delta = newIncomingQty - (line.incoming_qty ?? 0);
      if (delta !== 0) {
        await logShopifyIncoming({
          tenantId,
          poId,
          lineId: line.id,
          variantId: line.variant_id,
          locationId: po.ship_to_location_id,
          incomingQty: delta,
          action: delta > 0 ? "push" : "reverse",
        });
      }

      linesUpdated++;
    }

    return { success: true, linesUpdated };
  } catch (err) {
    return { success: false, linesUpdated: 0, error: err.message };
  }
}
