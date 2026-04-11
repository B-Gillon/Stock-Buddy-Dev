/**
 * determineReceivingSource.js
 *
 * Determines the default receiving_source for a new PO using priority:
 *   1. supplier_location_receiving_defaults (supplier + location match)
 *   2. locations.warehouse_type
 *       retailer_owned → 'stock_buddy'
 *       any 3PL type   → 'external'
 *   3. Fallback: 'stock_buddy'
 *
 * Used during PO creation to pre-fill receiving_source.
 * The user may override this value on the PO form.
 */

import { supabase } from "@/lib/supabaseClient";

const EXTERNAL_WAREHOUSE_TYPES = ["shipbob", "deliverr", "shiphero", "flexport", "other_3pl"];

/**
 * @param {string} supplierId - UUID of the supplier
 * @param {string|null} locationId - UUID of the ship-to location (nullable)
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<'stock_buddy'|'external'>}
 */
export async function determineDefaultReceivingSource(supplierId, locationId, tenantId) {
  // ── Priority 1: supplier_location_receiving_defaults ────────────────────────
  if (supplierId && locationId) {
    const { data: slrd } = await supabase
      .from("supplier_location_receiving_defaults")
      .select("default_receiving_source")
      .eq("supplier_id", supplierId)
      .eq("location_id", locationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (slrd?.default_receiving_source) {
      return slrd.default_receiving_source;
    }
  }

  // ── Priority 2: locations.warehouse_type ────────────────────────────────────
  if (locationId) {
    const { data: location } = await supabase
      .from("locations")
      .select("warehouse_type")
      .eq("id", locationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (location?.warehouse_type) {
      if (EXTERNAL_WAREHOUSE_TYPES.includes(location.warehouse_type)) {
        return "external";
      }
      if (location.warehouse_type === "retailer_owned") {
        return "stock_buddy";
      }
    }
  }

  // ── Priority 3: Fallback ────────────────────────────────────────────────────
  return "stock_buddy";
}
