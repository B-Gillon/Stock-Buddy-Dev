/**
 * releasePO.js
 * Orchestrates the full PO release flow:
 *   1. Validate PO is in a releasable state
 *   2. Update DB status + released_at
 *   3. Push incoming quantities to Shopify
 *   4. Stamp shopify_synced_at or shopify_sync_error
 *
 * If Shopify push fails, the DB status update is rolled back.
 */

import { pushIncoming } from "./pushIncoming.js";

/**
 * @param {object} opts
 * @param {object} opts.supabase   - server supabase client
 * @param {string} opts.poId       - purchase_orders.id (uuid)
 * @param {string} opts.tenantId
 * @returns {Promise<{ po: object, lines: Array }>}
 */
export async function releasePO({ supabase, poId, tenantId }) {
  // ── 1. Fetch PO ──────────────────────────────────────────────────────────
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      location:locations!ship_to_location_id (
        id,
        shopify_location_id
      )
    `)
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .single();

  if (poError || !po) throw new Error(`PO not found: ${poError?.message}`);
  if (po.status !== "draft") throw new Error(`PO cannot be released from status: ${po.status}`);

  // ── 2. Fetch lines with inventory item IDs ────────────────────────────────
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      *,
      inventory_item:inventory_items!inner (
        shopify_inventory_item_id
      )
    `)
    .eq("purchase_order_id", poId)
    .eq("tenant_id", tenantId);

  if (linesError) throw new Error(`Failed to fetch PO lines: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("Cannot release a PO with no line items.");

  // Flatten joined fields
  const shopifyLocationId = po.location?.shopify_location_id ?? null;
  const enrichedLines = lines.map((l) => ({
    ...l,
    shopify_inventory_item_id: l.inventory_item?.shopify_inventory_item_id ?? null,
    shopify_location_id: shopifyLocationId,
  }));

  // ── 3. Mark PO as released in DB ─────────────────────────────────────────
  const releasedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({ status: "released", released_at: releasedAt, updated_at: releasedAt })
    .eq("id", poId)
    .eq("tenant_id", tenantId);

  if (updateError) throw new Error(`Failed to update PO status: ${updateError.message}`);

  // ── 4. Push to Shopify ────────────────────────────────────────────────────
  try {
    await pushIncoming({
      supabase,
      po: { ...po, released_at: releasedAt },
      lines: enrichedLines,
      tenantId,
    });

    // Stamp successful sync
    await supabase
      .from("purchase_orders")
      .update({ shopify_synced_at: new Date().toISOString(), shopify_sync_error: null })
      .eq("id", poId);
  } catch (shopifyErr) {
    // Roll back status to draft so the user can retry
    await supabase
      .from("purchase_orders")
      .update({
        status: "draft",
        released_at: null,
        shopify_sync_error: shopifyErr.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);

    throw shopifyErr;
  }

  // Return updated PO
  const { data: updatedPO } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .single();

  return { po: updatedPO, lines: enrichedLines };
}
