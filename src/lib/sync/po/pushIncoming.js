/**
 * pushIncoming.js
 * Pushes incoming inventory quantities to Shopify when a PO is released.
 * Also writes PO metafields to each affected inventory item.
 *
 * Idempotent: checks po_shopify_incoming for existing pushes before acting.
 */

import {
  buildAdjustPayload,
  callShopifyAdjust,
  writeInventoryMetafields,
  logShopifyIncoming,
  getExistingIncoming,
  resolveTenantCredentials,
} from "./poSyncHelpers.js";

/**
 * @param {object} opts
 * @param {object} opts.supabase         - server supabase client (tenant-scoped)
 * @param {object} opts.po               - full purchase_orders row
 * @param {Array}  opts.lines            - purchase_order_lines rows, each must include:
 *                                          variant_id, order_qty_units,
 *                                          shopify_inventory_item_id (joined),
 *                                          shopify_location_id (joined from ship_to_location)
 * @param {string} opts.tenantId
 */
export async function pushIncoming({ supabase, po, lines, tenantId }) {
  // Idempotency: skip lines already pushed and not yet reversed
  const existingRows = await getExistingIncoming(supabase, po.id);
  const alreadyPushedLineIds = new Set(existingRows.map((r) => r.purchase_order_line_id));

  const linesToPush = lines.filter(
    (l) => !alreadyPushedLineIds.has(l.id) && l.order_qty_units > 0
  );

  if (linesToPush.length === 0) return { skipped: true };

  // Validate all lines have the required Shopify IDs
  const missing = linesToPush.filter(
    (l) => !l.shopify_inventory_item_id || !l.shopify_location_id
  );
  if (missing.length > 0) {
    const skus = missing.map((l) => l.sku).join(", ");
    throw new Error(
      `Cannot push to Shopify: missing inventory item or location IDs for SKUs: ${skus}`
    );
  }

  const credentials = await resolveTenantCredentials(supabase, tenantId);

  // Build adjust payload — positive delta on "incoming" ledger
  const changes = linesToPush.map((l) => ({
    shopifyInventoryItemId: l.shopify_inventory_item_id,
    shopifyLocationId: l.shopify_location_id,
    delta: l.order_qty_units,
  }));

  const payload = buildAdjustPayload(changes, "received");
  await callShopifyAdjust({ ...credentials, payload });

  // Write PO metafields to each affected inventory item (best-effort)
  await Promise.allSettled(
    linesToPush.map((l) =>
      writeInventoryMetafields({
        ...credentials,
        shopifyInventoryItemId: l.shopify_inventory_item_id,
        metafields: [
          { namespace: "stock_buddy", key: "po_number", value: po.po_number, type: "single_line_text_field" },
          { namespace: "stock_buddy", key: "po_released_at", value: po.released_at ?? new Date().toISOString(), type: "single_line_text_field" },
          { namespace: "stock_buddy", key: "expected_date", value: po.expected_date ?? "", type: "single_line_text_field" },
        ],
      })
    )
  );

  // Log to po_shopify_incoming for audit + future reversal
  const now = new Date().toISOString();
  const incomingRows = linesToPush.map((l) => ({
    tenant_id: tenantId,
    purchase_order_id: po.id,
    purchase_order_line_id: l.id,
    variant_id: l.variant_id,
    shopify_inventory_item_id: l.shopify_inventory_item_id,
    shopify_location_id: l.shopify_location_id,
    quantity_pushed: l.order_qty_units,
    pushed_at: now,
  }));

  await logShopifyIncoming(supabase, incomingRows);

  return { pushed: linesToPush.length };
}
