/**
 * receivePO.js
 * Orchestrates partial or full receiving against a released PO:
 *   1. Validate PO is receivable
 *   2. Update line received quantities
 *   3. Recalculate PO status (partially_received / received)
 *   4. Adjust Shopify: decrease incoming, increase available
 *   5. Mark po_shopify_incoming rows as reversed
 */

import {
  buildAdjustPayload,
  callShopifyAdjust,
  getExistingIncoming,
  markIncomingReversed,
  resolveTenantCredentials,
} from "./poSyncHelpers.js";

const RECEIVABLE_STATUSES = ["released", "partially_received"];

/**
 * @param {object} opts
 * @param {object} opts.supabase    - server supabase client
 * @param {string} opts.poId        - purchase_orders.id
 * @param {string} opts.tenantId
 * @param {Array}  opts.receipts    - [{ lineId: uuid, receivedQty: number }]
 *                                    Only lines being received now; omit untouched lines.
 */
export async function receivePO({ supabase, poId, tenantId, receipts }) {
  if (!receipts || receipts.length === 0) throw new Error("No receipt quantities provided.");

  // ── 1. Fetch PO ───────────────────────────────────────────────────────────
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .single();

  if (poError || !po) throw new Error(`PO not found: ${poError?.message}`);
  if (!RECEIVABLE_STATUSES.includes(po.status)) {
    throw new Error(`PO cannot be received from status: ${po.status}`);
  }

  // ── 2. Fetch all lines ────────────────────────────────────────────────────
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

  const lineMap = Object.fromEntries(lines.map((l) => [l.id, l]));

  // ── 3. Update each received line ──────────────────────────────────────────
  const now = new Date().toISOString();

  for (const { lineId, receivedQty } of receipts) {
    const line = lineMap[lineId];
    if (!line) throw new Error(`Line ${lineId} not found on this PO.`);

    const newTotal = (line.received_qty_units ?? 0) + receivedQty;

    const { error } = await supabase
      .from("purchase_order_lines")
      .update({
        received_qty_units: newTotal,
        received_at: now,
        updated_at: now,
      })
      .eq("id", lineId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`Failed to update line ${lineId}: ${error.message}`);

    // Update our local map for status calc below
    lineMap[lineId] = { ...line, received_qty_units: newTotal };
  }

  // ── 4. Recalculate PO status ──────────────────────────────────────────────
  const allLines = Object.values(lineMap);
  const fullyReceived = allLines.every(
    (l) => (l.received_qty_units ?? 0) >= l.order_qty_units
  );
  const anyReceived = allLines.some((l) => (l.received_qty_units ?? 0) > 0);

  const newStatus = fullyReceived
    ? "received"
    : anyReceived
    ? "partially_received"
    : po.status;

  const poUpdate = {
    status: newStatus,
    updated_at: now,
    ...(fullyReceived && !po.received_at ? { received_at: now } : {}),
  };

  const { error: poUpdateError } = await supabase
    .from("purchase_orders")
    .update(poUpdate)
    .eq("id", poId)
    .eq("tenant_id", tenantId);

  if (poUpdateError) throw new Error(`Failed to update PO status: ${poUpdateError.message}`);

  // ── 5. Adjust Shopify ─────────────────────────────────────────────────────
  try {
    const credentials = await resolveTenantCredentials(supabase, tenantId);
    const existingIncoming = await getExistingIncoming(supabase, poId);

    // Build a map of line → pushed quantity for reversal calculation
    const pushedByLine = {};
    for (const row of existingIncoming) {
      pushedByLine[row.purchase_order_line_id] =
        (pushedByLine[row.purchase_order_line_id] ?? 0) + row.quantity_pushed;
    }

    const changes = [];
    const rowsToReverse = [];

    for (const { lineId, receivedQty } of receipts) {
      const line = lineMap[lineId];
      const shopifyItemId = line.inventory_item?.shopify_inventory_item_id;
      const shopifyLocationId = existingIncoming.find(
        (r) => r.purchase_order_line_id === lineId
      )?.shopify_location_id;

      if (!shopifyItemId || !shopifyLocationId) continue;

      // Decrease incoming by received qty, increase available by received qty
      changes.push(
        { shopifyInventoryItemId: shopifyItemId, shopifyLocationId, delta: -receivedQty },  // incoming
        { shopifyInventoryItemId: shopifyItemId, shopifyLocationId, delta: receivedQty }    // available
      );

      // Collect incoming log rows affected by this line for reversal marking
      const affected = existingIncoming.filter(
        (r) => r.purchase_order_line_id === lineId
      );
      rowsToReverse.push(...affected.map((r) => r.id));
    }

    if (changes.length > 0) {
      const payload = buildAdjustPayload(changes, "received");
      await callShopifyAdjust({ ...credentials, payload });
    }

    if (rowsToReverse.length > 0) {
      await markIncomingReversed(supabase, rowsToReverse, "received");
    }

    await supabase
      .from("purchase_orders")
      .update({ shopify_synced_at: now, shopify_sync_error: null })
      .eq("id", poId);
  } catch (shopifyErr) {
    // DB is already updated — log error but don't roll back receiving
    // Shopify can be re-synced; we don't want to lose received quantities
    await supabase
      .from("purchase_orders")
      .update({ shopify_sync_error: shopifyErr.message })
      .eq("id", poId);

    console.error("Shopify sync failed during receive:", shopifyErr.message);
  }

  // ── 6. Return updated state ───────────────────────────────────────────────
  const { data: updatedPO } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .single();

  const { data: updatedLines } = await supabase
    .from("purchase_order_lines")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("line_no", { ascending: true });

  return { po: updatedPO, lines: updatedLines };
}
