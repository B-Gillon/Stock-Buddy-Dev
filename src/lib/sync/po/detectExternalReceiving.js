/**
 * detectExternalReceiving.js
 *
 * Periodically compares Shopify inventory_levels.available against the last
 * known SB available to detect external receiving (warehouse received items
 * without Stock Buddy's knowledge).
 *
 * When detected:
 *   - Reduces incoming_remaining by the delta
 *   - Sets receiving_source = 'external'
 *   - Sets auto_switched_to_external = TRUE
 *   - Stops future incoming/receiving pushes for that PO
 */

import { supabase } from "@/lib/supabaseClient";
import {
  resolveShopifyCredentials,
  getShopifyInventoryLevel,
  logShopifyIncoming,
} from "./poSyncHelpers";

// ─── Auto-Switch ──────────────────────────────────────────────────────────────

/**
 * Switch a PO to external receiving mode.
 * Called when external receiving is detected for any line on this PO.
 *
 * @param {string} poId
 * @param {string} tenantId
 */
export async function autoSwitchToExternal(poId, tenantId) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      receiving_source: "external",
      auto_switched_to_external: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`autoSwitchToExternal failed for PO ${poId}: ${error.message}`);
  }

  console.info(`[Stock Buddy] PO ${poId} auto-switched to external receiving.`);
}

// ─── Detect External Receiving ────────────────────────────────────────────────

/**
 * Detect external receiving for all active (released / partially_received) POs
 * across all tenants, or for a single tenant if tenantId is provided.
 *
 * For each PO line:
 *   - Fetch current Shopify available
 *   - Compare to last_known_available stored in po_shopify_incoming
 *   - If Shopify available increased and SB didn't push it → external receiving
 *
 * @param {string|null} tenantId - Scope to one tenant, or null for all
 * @returns {Promise<DetectionResult[]>}
 */
export async function detectExternalReceiving(tenantId = null) {
  const results = [];

  // Fetch all active POs scoped to stock_buddy receiving
  let poQuery = supabase
    .from("purchase_orders")
    .select("id, tenant_id, ship_to_location_id, receiving_source")
    .in("status", ["released", "partially_received"])
    .eq("receiving_source", "stock_buddy");

  if (tenantId) poQuery = poQuery.eq("tenant_id", tenantId);

  const { data: activePOs, error: poError } = await poQuery;
  if (poError) throw new Error(`Failed to fetch active POs: ${poError.message}`);
  if (!activePOs?.length) return results;

  for (const po of activePOs) {
    try {
      const poResult = await detectExternalReceivingForPO(po.id, po.tenant_id);
      results.push({ poId: po.id, tenantId: po.tenant_id, ...poResult });
    } catch (err) {
      results.push({ poId: po.id, tenantId: po.tenant_id, error: err.message });
    }
  }

  return results;
}

/**
 * Detect external receiving for a single PO.
 * Returns summary of lines where external receiving was detected.
 *
 * @param {string} poId
 * @param {string} tenantId
 * @returns {Promise<{ detectedLines: number, switchedToExternal: boolean }>}
 */
export async function detectExternalReceivingForPO(poId, tenantId) {
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, status, receiving_source, ship_to_location_id, tenant_id")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .single();

  if (!po || po.receiving_source !== "stock_buddy") {
    return { detectedLines: 0, switchedToExternal: false };
  }

  const { data: location } = await supabase
    .from("locations")
    .select("shopify_location_id")
    .eq("id", po.ship_to_location_id)
    .eq("tenant_id", tenantId)
    .single();

  if (!location?.shopify_location_id) {
    throw new Error(`No Shopify location ID for location ${po.ship_to_location_id}`);
  }

  const shopifyCreds = await resolveShopifyCredentials(tenantId);

  // Fetch PO lines with variant + inventory item info
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      id,
      variant_id,
      incoming_remaining,
      variants (
        inventory_items (
          shopify_inventory_item_id
        )
      )
    `)
    .eq("purchase_order_id", poId)
    .eq("tenant_id", tenantId)
    .gt("incoming_remaining", 0);

  if (linesError) throw new Error(`Lines fetch failed: ${linesError.message}`);
  if (!lines?.length) return { detectedLines: 0, switchedToExternal: false };

  // Fetch last known available from po_shopify_incoming
  const { data: incomingLogs } = await supabase
    .from("po_shopify_incoming")
    .select("purchase_order_line_id, incoming_qty, pushed_at")
    .eq("purchase_order_id", poId)
    .eq("tenant_id", tenantId)
    .order("pushed_at", { ascending: false });

  // Build a map: lineId → last known Shopify available
  // We derive last known available from the sum of pushes/reverses
  const lineLogMap = {};
  for (const log of incomingLogs || []) {
    if (!lineLogMap[log.purchase_order_line_id]) {
      lineLogMap[log.purchase_order_line_id] = log;
    }
  }

  let externalDetectedCount = 0;

  for (const line of lines) {
    const inventoryItem = line.variants?.inventory_items?.[0];
    if (!inventoryItem?.shopify_inventory_item_id) continue;

    let currentShopifyLevel;
    try {
      currentShopifyLevel = await getShopifyInventoryLevel(
        shopifyCreds,
        inventoryItem.shopify_inventory_item_id,
        location.shopify_location_id
      );
    } catch (err) {
      console.warn(`Could not fetch Shopify level for line ${line.id}:`, err.message);
      continue;
    }

    if (!currentShopifyLevel) continue;

    const currentAvailable = currentShopifyLevel.available ?? 0;

    // Retrieve last SB-known available snapshot for this line
    const lastLog = lineLogMap[line.id];
    const lastKnownAvailable = lastLog?.last_known_available ?? null;

    // If we have no baseline, we can't detect a delta — skip
    if (lastKnownAvailable === null) continue;

    const delta = currentAvailable - lastKnownAvailable;

    if (delta > 0) {
      // Shopify available increased — SB didn't push it → external receiving
      console.info(
        `[Stock Buddy] External receiving detected on line ${line.id}: ` +
          `Shopify available +${delta} (${lastKnownAvailable} → ${currentAvailable})`
      );

      // Reduce incoming_remaining by delta (floor at 0)
      const newRemaining = Math.max(0, line.incoming_remaining - delta);

      await supabase
        .from("purchase_order_lines")
        .update({
          incoming_remaining: newRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("id", line.id)
        .eq("tenant_id", tenantId);

      // Log the external detection
      await logShopifyIncoming({
        tenantId,
        poId,
        lineId: line.id,
        variantId: line.variant_id,
        locationId: po.ship_to_location_id,
        incomingQty: -delta,
        action: "reverse",
      });

      externalDetectedCount++;
    }

    // Case C: Shopify available decreased — log discrepancy, do NOT adjust incoming_remaining
    if (delta < 0) {
      console.warn(
        `[Stock Buddy] Shopify available decreased unexpectedly on line ${line.id}: ` +
          `${lastKnownAvailable} → ${currentAvailable}. Logging for review.`
      );
      // Future: insert into a discrepancy log table
    }
  }

  // If any external receiving was detected, auto-switch the PO
  let switchedToExternal = false;
  if (externalDetectedCount > 0) {
    await autoSwitchToExternal(poId, tenantId);
    switchedToExternal = true;
  }

  return { detectedLines: externalDetectedCount, switchedToExternal };
}
